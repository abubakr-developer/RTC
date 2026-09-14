import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import Room from '../models/Room.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Create room
router.post('/create', auth, async (req, res) => {
  try {
    const { name, description, isPrivate, password, maxParticipants } = req.body;
    const roomId = uuidv4().slice(0, 8).toUpperCase();

    const room = new Room({
      name,
      description,
      host: req.user._id,
      participants: [req.user._id],
      isPrivate: isPrivate || false,
      password: password || '',
      maxParticipants: maxParticipants || 10,
      roomId,
    });

    await room.save();
    await room.populate('host', 'username avatar');
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all public rooms
router.get('/', auth, async (req, res) => {
  try {
    const rooms = await Room.find({ isPrivate: false, isActive: true })
      .populate('host', 'username avatar')
      .populate('participants', 'username avatar')
      .sort({ createdAt: -1 });
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get room by roomId
router.get('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate('host', 'username avatar')
      .populate('participants', 'username avatar')
      .populate('messages.sender', 'username avatar');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Join room
router.post('/:roomId/join', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const alreadyParticipant = room.participants.some(p => p.toString() === req.user._id.toString());
    if (alreadyParticipant) {
      return res.json({ message: 'Already joined room', room, status: 'approved' });
    }

    if (room.participants.length >= room.maxParticipants) {
      return res.status(400).json({ message: 'Room is full' });
    }

    if (room.isPrivate) {
      const existingRequest = room.joinRequests.find(r => r.user.toString() === req.user._id.toString());
      if (!existingRequest) {
        room.joinRequests.push({ user: req.user._id, status: 'pending' });
        await room.save();
        return res.status(202).json({ message: 'Join request sent to room host for approval', status: 'pending' });
      }

      if (existingRequest.status === 'pending') {
        return res.status(202).json({ message: 'Join request is still pending approval', status: 'pending' });
      }
    }

    room.participants.push(req.user._id);
    await room.save();
    res.json({ message: 'Joined room', room, status: 'approved' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get pending join requests for the host
router.get('/:roomId/requests', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId })
      .populate('joinRequests.user', 'username avatar email');

    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can view join requests' });
    }

    res.json(room.joinRequests.filter(r => r.status === 'pending'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve a pending join request
router.post('/:roomId/requests/:userId/approve', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can approve join requests' });
    }

    const request = room.joinRequests.find(r => r.user.toString() === req.params.userId);
    if (!request) return res.status(404).json({ message: 'Join request not found' });

    if (room.participants.length >= room.maxParticipants) {
      return res.status(400).json({ message: 'Room is full' });
    }

    request.status = 'approved';
    if (!room.participants.some(p => p.toString() === req.params.userId)) {
      room.participants.push(req.params.userId);
    }

    await room.save();
    res.json({ message: 'User approved into room', room });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete room
router.delete('/:roomId', auth, async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.host.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Only host can delete the room' });

    await Room.findByIdAndDelete(room._id);
    res.json({ message: 'Room deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
