import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: String,
  content: String,
  type: { type: String, enum: ['text', 'file', 'system'], default: 'text' },
  fileUrl: String,
  fileName: String,
  timestamp: { type: Date, default: Date.now },
});

const joinRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
}, { _id: true });

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  joinRequests: [joinRequestSchema],
  isPrivate: { type: Boolean, default: false },
  password: { type: String, default: '' },
  maxParticipants: { type: Number, default: 10 },
  messages: [messageSchema],
  isActive: { type: Boolean, default: true },
  roomId: { type: String, unique: true, required: true },
  whiteboardData: { type: String, default: '' },
}, { timestamps: true });

const Room = mongoose.model('Room', roomSchema);
export default Room;
