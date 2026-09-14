import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Room from '../models/Room.js';

// Store active rooms and their peers
const activeRooms = new Map(); // roomId -> Set of socket ids
const socketUsers = new Map(); // socketId -> userId

export const socketHandler = (io) => {
  // Auth middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`✅ User connected: ${socket.user.username} [${socket.id}]`);
    socketUsers.set(socket.id, socket.user._id.toString());

    // Update user online status
    await User.findByIdAndUpdate(socket.user._id, {
      isOnline: true,
      socketId: socket.id,
    });

    // Broadcast user online
    socket.broadcast.emit('user:online', { userId: socket.user._id, username: socket.user.username });

    // ─── ROOM EVENTS ───────────────────────────────────────────────────────

    socket.on('room:join', async ({ roomId }) => {
      const normalizedRoomId = String(roomId || '').trim().toUpperCase();
      if (!normalizedRoomId) return;

      if (socket.roomId && socket.roomId !== normalizedRoomId) {
        handleLeaveRoom(socket, socket.roomId, io);
      }

      socket.join(normalizedRoomId);

      if (!activeRooms.has(normalizedRoomId)) activeRooms.set(normalizedRoomId, new Set());
      const room = activeRooms.get(normalizedRoomId);
      room.add(socket.id);
      socket.roomId = normalizedRoomId;

      const existingPeers = Array.from(room)
        .filter((peerId) => peerId !== socket.id)
        .map((peerId) => ({ peerId, socketId: peerId }));

      // Notify everyone already in the room about the new user
      existingPeers.forEach(({ peerId }) => {
        io.to(peerId).emit('peer:new', {
          peerId: socket.id,
          userId: socket.user._id,
          username: socket.user.username,
          avatar: socket.user.avatar,
        });
      });

      // Send current peers to the new user
      socket.emit('room:peers', existingPeers);

      // Send system message to the room
      socket.to(normalizedRoomId).emit('chat:message', {
        type: 'system',
        content: `${socket.user.username} joined the room`,
        timestamp: new Date(),
      });

      console.log(`Room ${normalizedRoomId}: ${room.size} participants`);
    });

    socket.on('room:leave', async ({ roomId }) => {
      handleLeaveRoom(socket, roomId, io);
    });

    // ─── WEBRTC SIGNALING ──────────────────────────────────────────────────

    socket.on('webrtc:offer', ({ peerId, offer }) => {
      io.to(peerId).emit('webrtc:offer', {
        offer,
        fromId: socket.id,
        fromUser: {
          userId: socket.user._id,
          username: socket.user.username,
          avatar: socket.user.avatar,
        },
      });
    });

    socket.on('webrtc:answer', ({ peerId, answer }) => {
      io.to(peerId).emit('webrtc:answer', { answer, fromId: socket.id });
    });

    socket.on('webrtc:ice-candidate', ({ peerId, candidate }) => {
      io.to(peerId).emit('webrtc:ice-candidate', { candidate, fromId: socket.id });
    });

    // ─── MEDIA CONTROLS ────────────────────────────────────────────────────

    socket.on('media:toggle', ({ roomId, type, enabled }) => {
      socket.to(roomId).emit('media:toggle', {
        peerId: socket.id,
        type,
        enabled,
      });
    });

    socket.on('screen:share-start', ({ roomId }) => {
      socket.to(roomId).emit('screen:share-start', { peerId: socket.id, username: socket.user.username });
    });

    socket.on('screen:share-stop', ({ roomId }) => {
      socket.to(roomId).emit('screen:share-stop', { peerId: socket.id });
    });

    // ─── CHAT ──────────────────────────────────────────────────────────────

    socket.on('chat:message', async ({ roomId, content, type = 'text', fileUrl, fileName }) => {
      const message = {
        _id: Date.now().toString(),
        sender: socket.user._id,
        senderName: socket.user.username,
        senderAvatar: socket.user.avatar,
        content,
        type,
        fileUrl,
        fileName,
        timestamp: new Date(),
      };

      // Save to DB
      await Room.findOneAndUpdate(
        { roomId },
        {
          $push: {
            messages: {
              sender: socket.user._id,
              senderName: socket.user.username,
              content,
              type,
              fileUrl,
              fileName,
            },
          },
        }
      );

      io.to(roomId).emit('chat:message', message);
    });

    // ─── WHITEBOARD ────────────────────────────────────────────────────────

    socket.on('whiteboard:draw', ({ roomId, data }) => {
      socket.to(roomId).emit('whiteboard:draw', { data, userId: socket.user._id });
    });

    socket.on('whiteboard:clear', ({ roomId }) => {
      socket.to(roomId).emit('whiteboard:clear');
      Room.findOneAndUpdate({ roomId }, { whiteboardData: '' }).exec();
    });

    socket.on('whiteboard:save', async ({ roomId, data }) => {
      await Room.findOneAndUpdate({ roomId }, { whiteboardData: data });
    });

    // ─── DISCONNECT ────────────────────────────────────────────────────────

    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.user.username}`);
      socketUsers.delete(socket.id);

      if (socket.roomId) {
        handleLeaveRoom(socket, socket.roomId, io);
      }

      await User.findByIdAndUpdate(socket.user._id, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: '',
      });

      socket.broadcast.emit('user:offline', { userId: socket.user._id });
    });
  });
};

function handleLeaveRoom(socket, roomId, io) {
  socket.leave(roomId);
  const room = activeRooms.get(roomId);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) activeRooms.delete(roomId);
  }

  io.to(roomId).emit('peer:left', { peerId: socket.id, userId: socket.user._id });
  socket.to(roomId).emit('chat:message', {
    type: 'system',
    content: `${socket.user.username} left the room`,
    timestamp: new Date(),
  });
}
