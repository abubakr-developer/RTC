import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Monitor, MonitorOff, MessageSquare, PenTool,
  Users, Copy, Check, MoreVertical
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import useWebRTC from '../hooks/useWebRTC';
import Chat from '../components/Chat/Chat';
import Whiteboard from '../components/Whiteboard/Whiteboard';
import api from '../utils/api';

const RoomPage = () => {
  const { roomId: rawRoomId } = useParams();
  const roomId = rawRoomId?.trim().toUpperCase();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [room, setRoom] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [sidePanel, setSidePanel] = useState(null); // 'chat' | 'whiteboard' | null
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const localVideoRef = useRef(null);

  const {
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
  } = useWebRTC(socket, roomId, user);

  useEffect(() => {
    if (!socket || !roomId) return;

    const init = async () => {
      try {
        const { data } = await api.post(`/rooms/${roomId}/join`);

        if (data.status === 'pending') {
          toast('Your join request is waiting for host approval.', { icon: '⏳' });
          setLoading(false);
          navigate('/dashboard');
          return;
        }

        const { data: roomData } = await api.get(`/rooms/${roomId}`);
        setRoom(roomData);

        const stream = await initLocalStream();
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
        }

        socket.emit('room:join', { roomId });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to join room');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      socket.emit('room:leave', { roomId });
      cleanup();
    };
  }, [socket, roomId]);

  // Update local video when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const leaveRoom = () => {
    socket?.emit('room:leave', { roomId });
    cleanup();
    navigate('/dashboard');
  };

  const copyInviteLink = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Invite link copied!');
  };

  const peerCount = Object.keys(peers).length;

  const loadJoinRequests = async () => {
    if (!roomId || !user || !room || room.host?._id !== user._id) return;

    try {
      const { data } = await api.get(`/rooms/${roomId}/requests`);
      setJoinRequests(data);
    } catch (err) {
      console.error('Failed to load join requests', err);
    }
  };

  const handleApproveRequest = async (targetUserId) => {
    try {
      await api.post(`/rooms/${roomId}/requests/${targetUserId}/approve`);
      toast.success('User approved and can join the room.');
      await loadJoinRequests();
      const { data: roomData } = await api.get(`/rooms/${roomId}`);
      setRoom(roomData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to approve user');
    }
  };

  useEffect(() => {
    if (!room) return;
    loadJoinRequests();
  }, [room, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Joining room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Top bar */}
      <header className="bg-gray-900/90 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-white font-semibold text-sm">{room?.name || 'Meeting Room'}</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-mono">{roomId}</span>
              <button onClick={copyInviteLink} className="text-gray-600 hover:text-indigo-400 transition-colors" title="Copy invite link">
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-400 bg-gray-800 px-3 py-1.5 rounded-lg">
            <Users className="w-3.5 h-3.5" />
            <span>{peerCount + 1} participants</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-gray-500">LIVE</span>
        </div>
      </header>

      {room?.host?._id === user?._id && joinRequests.length > 0 && (
        <div className="border-b border-indigo-500/30 bg-indigo-900/20 px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-200">Join requests</p>
              <p className="text-xs text-indigo-300/80">Approve people before they can enter the room</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {joinRequests.map(req => (
                <div key={req.user._id} className="flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-gray-900/60 px-3 py-2">
                  <span className="text-sm text-white">{req.user.username}</span>
                  <button
                    onClick={() => handleApproveRequest(req.user._id)}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500"
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-3 overflow-auto">
            <div className={`video-grid h-full peers-${Math.min(peerCount + 1, 6)}`}>
              {/* Local video */}
              <VideoTile
                videoRef={localVideoRef}
                label={`${user?.username} (You)`}
                isLocal={true}
                audioEnabled={isAudioEnabled}
                videoEnabled={isVideoEnabled}
                user={user}
              />

              {/* Remote peers */}
              {Object.entries(peers).map(([peerId, peer]) => (
                <PeerVideoTile
                  key={peerId}
                  peer={peer}
                  label={peer.username}
                />
              ))}
            </div>
          </div>

          {/* Controls bar */}
          <div className="bg-gray-900/90 border-t border-gray-800 py-4 px-6">
            <div className="flex items-center justify-center gap-3">
              {/* Audio */}
              <ControlBtn
                onClick={toggleAudio}
                active={!isAudioEnabled}
                danger={!isAudioEnabled}
                icon={isAudioEnabled ? Mic : MicOff}
                label={isAudioEnabled ? 'Mute' : 'Unmute'}
              />

              {/* Video */}
              <ControlBtn
                onClick={toggleVideo}
                active={!isVideoEnabled}
                danger={!isVideoEnabled}
                icon={isVideoEnabled ? Video : VideoOff}
                label={isVideoEnabled ? 'Stop Video' : 'Start Video'}
              />

              {/* Screen share */}
              <ControlBtn
                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                active={isScreenSharing}
                icon={isScreenSharing ? MonitorOff : Monitor}
                label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
              />

              {/* Chat */}
              <ControlBtn
                onClick={() => setSidePanel(p => p === 'chat' ? null : 'chat')}
                active={sidePanel === 'chat'}
                icon={MessageSquare}
                label="Chat"
              />

              {/* Whiteboard */}
              <ControlBtn
                onClick={() => setSidePanel(p => p === 'whiteboard' ? null : 'whiteboard')}
                active={sidePanel === 'whiteboard'}
                icon={PenTool}
                label="Whiteboard"
              />

              {/* Leave */}
              <button
                onClick={leaveRoom}
                className="flex flex-col items-center gap-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-xl transition-all"
                title="Leave"
              >
                <PhoneOff className="w-5 h-5 text-white" />
                <span className="text-xs text-white">Leave</span>
              </button>
            </div>
          </div>
        </div>

        {/* Side panel */}
        {sidePanel && (
          <div className="w-80 border-l border-gray-800 flex flex-col">
            {/* Panel tabs */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setSidePanel('chat')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${sidePanel === 'chat' ? 'text-white border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Chat
              </button>
              <button
                onClick={() => setSidePanel('whiteboard')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${sidePanel === 'whiteboard' ? 'text-white border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Whiteboard
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              {sidePanel === 'chat' && <Chat socket={socket} roomId={roomId} user={user} />}
              {sidePanel === 'whiteboard' && <Whiteboard socket={socket} roomId={roomId} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const VideoTile = ({ videoRef, label, isLocal, audioEnabled, videoEnabled, user }) => (
  <div className="video-tile relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className={`w-full h-full object-cover ${!videoEnabled ? 'hidden' : ''}`}
    />
    {!videoEnabled && (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
        <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold">
          {user?.username?.[0]?.toUpperCase() || '?'}
        </div>
      </div>
    )}
    <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
      <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">{label}</span>
      {!audioEnabled && <MicOff className="w-3.5 h-3.5 text-red-400" />}
    </div>
    {isLocal && (
      <div className="absolute top-2 right-2 text-xs bg-indigo-600/80 text-white px-1.5 py-0.5 rounded">You</div>
    )}
  </div>
);

const PeerVideoTile = ({ peer, label }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div className="video-tile relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${!peer.videoEnabled ? 'hidden' : ''}`}
      />
      {(!peer.videoEnabled || !peer.stream) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="w-16 h-16 rounded-full bg-purple-600 flex items-center justify-center text-white text-2xl font-bold">
            {label?.[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-sm">{label}</span>
        {!peer.audioEnabled && <MicOff className="w-3.5 h-3.5 text-red-400" />}
      </div>
    </div>
  );
};

const ControlBtn = ({ onClick, icon: Icon, label, active, danger }) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl transition-all ${
      danger ? 'bg-red-900/40 text-red-400 hover:bg-red-900/60' :
      active ? 'bg-indigo-600/30 text-indigo-400 hover:bg-indigo-600/50' :
      'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="text-xs">{label}</span>
  </button>
);

export default RoomPage;
