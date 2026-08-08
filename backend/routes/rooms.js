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

    if (room.participants.length >= room.maxParticipants)
      return res.status(400).json({ message: 'Room is full' });

    if (!room.participants.includes(req.user._id)) {
      room.participants.push(req.user._id);
      await room.save();
    }

    res.json({ message: 'Joined room', room });
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
