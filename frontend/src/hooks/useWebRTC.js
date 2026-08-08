import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

const useWebRTC = (socket, roomId, user) => {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState({}); // peerId -> { stream, user, audioEnabled, videoEnabled }
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

  const peerConnections = useRef({}); // peerId -> RTCPeerConnection
  const iceCandidateQueue = useRef({}); // peerId -> RTCIceCandidateInit[]
  const localStreamRef = useRef(null);

  const drainIceQueue = useCallback(async (peerId) => {
    const pc = peerConnections.current[peerId];
    const queue = iceCandidateQueue.current[peerId];
    if (!pc || !queue?.length) return;

    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Failed to add queued ICE candidate', err, peerId);
      }
    }

    delete iceCandidateQueue.current[peerId];
  }, []);

  // Get user media
  const initLocalStream = useCallback(async (video = true, audio = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Error accessing media:', err);
      // Try audio only if video fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (e) {
        console.error('Cannot access any media:', e);
        return null;
      }
    }
  }, []);

  const createPeerConnection = useCallback((peerId) => {
    if (peerConnections.current[peerId]) {
      return peerConnections.current[peerId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && socket) {
        socket.emit('webrtc:ice-candidate', { peerId, candidate });
      }
    };

    // Remote stream
    pc.ontrack = ({ streams }) => {
      if (streams[0]) {
        setPeers(prev => ({
          ...prev,
          [peerId]: { ...prev[peerId], stream: streams[0] },
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setPeers(prev => {
          const updated = { ...prev };
          delete updated[peerId];
          return updated;
        });
        delete peerConnections.current[peerId];
      }
    };

    peerConnections.current[peerId] = pc;
    return pc;
  }, [socket]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on('room:peers', async (existingPeers) => {
      for (const { peerId } of existingPeers) {
        const pc = createPeerConnection(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', { peerId, offer });
      }
    });

    socket.on('peer:new', async ({ peerId, userId, username, avatar }) => {
      setPeers(prev => ({
        ...prev,
        [peerId]: { stream: null, userId, username, avatar, audioEnabled: true, videoEnabled: true },
      }));
    });

    socket.on('webrtc:offer', async ({ offer, fromId, fromUser }) => {
      const pc = createPeerConnection(fromId);
      setPeers(prev => ({
        ...prev,
        [fromId]: { stream: null, ...fromUser, audioEnabled: true, videoEnabled: true },
      }));

      if (pc.signalingState !== 'stable') {
        console.warn('Skipped incoming offer because peer connection is in wrong state:', pc.signalingState, fromId);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await drainIceQueue(fromId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:answer', { peerId: fromId, answer });
    });

    socket.on('webrtc:answer', async ({ answer, fromId }) => {
      const pc = peerConnections.current[fromId];
      if (!pc) return;

      if (pc.signalingState !== 'have-local-offer') {
        console.warn('Skipped remote answer because peer connection is in wrong state:', pc.signalingState, fromId);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await drainIceQueue(fromId);
    });

    socket.on('webrtc:ice-candidate', async ({ candidate, fromId }) => {
      const pc = peerConnections.current[fromId];
      if (!pc) return;

      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        if (!iceCandidateQueue.current[fromId]) {
          iceCandidateQueue.current[fromId] = [];
        }
        iceCandidateQueue.current[fromId].push(candidate);
      }
    });

    socket.on('peer:left', ({ peerId }) => {
      if (peerConnections.current[peerId]) {
        peerConnections.current[peerId].close();
        delete peerConnections.current[peerId];
      }
      setPeers(prev => {
        const updated = { ...prev };
        delete updated[peerId];
        return updated;
      });
    });

    socket.on('media:toggle', ({ peerId, type, enabled }) => {
      setPeers(prev => ({
        ...prev,
        [peerId]: {
          ...prev[peerId],
          audioEnabled: type === 'audio' ? enabled : prev[peerId]?.audioEnabled,
          videoEnabled: type === 'video' ? enabled : prev[peerId]?.videoEnabled,
        },
      }));
    });

    return () => {
      socket.off('room:peers');
      socket.off('peer:new');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      socket.off('peer:left');
      socket.off('media:toggle');
    };
  }, [socket, roomId, createPeerConnection]);

  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsAudioEnabled(audioTrack.enabled);
      socket?.emit('media:toggle', { roomId, type: 'audio', enabled: audioTrack.enabled });
    }
  }, [socket, roomId]);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoEnabled(videoTrack.enabled);
      socket?.emit('media:toggle', { roomId, type: 'video', enabled: videoTrack.enabled });
    }
  }, [socket, roomId]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      setIsScreenSharing(true);

      const videoTrack = stream.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      socket?.emit('screen:share-start', { roomId });

      videoTrack.onended = () => stopScreenShare();
    } catch (err) {
      console.error('Screen share error:', err);
    }
  }, [socket, roomId]);

  const stopScreenShare = useCallback(async () => {
    if (!screenStream) return;
    screenStream.getTracks().forEach(t => t.stop());
    setScreenStream(null);
    setIsScreenSharing(false);

    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });
    }
    socket?.emit('screen:share-stop', { roomId });
  }, [screenStream, socket, roomId]);

  const cleanup = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStream?.getTracks().forEach(t => t.stop());
    Object.values(peerConnections.current).forEach(pc => pc.close());
    peerConnections.current = {};
    setLocalStream(null);
    setPeers({});
  }, [screenStream]);

  return {
    localStream,
    peers,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    initLocalStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    cleanup,
  };
};

export default useWebRTC;
