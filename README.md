# ConnectRTC — Real-Time Video Conferencing & Collaboration

A full-stack video conferencing app with WebRTC, Socket.io, React, and MongoDB.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React.js, Tailwind CSS |
| Backend | Node.js, Express.js |
| Real-time | Socket.io (signaling), WebRTC (peer-to-peer media) |
| Database | MongoDB Atlas |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| File uploads | Multer |

## Features

- ✅ **HD Video Calling** (multi-user, WebRTC mesh)
- ✅ **Screen Sharing** (replaces video track live)
- ✅ **File Sharing** (in-room chat, up to 50MB)
- ✅ **Whiteboard** (collaborative real-time drawing via socket)
- ✅ **Data Encryption** (JWT auth, bcrypt passwords)
- ✅ **User Authentication** (register/login)
- ✅ **Chat** (real-time in-room messaging)
- ✅ **Room Management** (create, join, public/private)
- ✅ **User Profiles** (follow/unfollow, posts, comments)
- ✅ **Online Status** (real-time presence)

## Project Structure

```
rtc-app/
├── backend/
│   ├── models/          # User, Room, Post schemas
│   ├── routes/          # auth, users, rooms, files
│   ├── middleware/       # JWT auth middleware
│   ├── socket/          # Socket.io + WebRTC signaling
│   ├── uploads/         # File upload directory
│   ├── .env             # Environment variables
│   └── server.js        # Express + Socket.io + MongoDB
└── frontend/
    ├── src/
    │   ├── components/  # Chat, Whiteboard, Layout
    │   ├── context/     # AuthContext, SocketContext
    │   ├── hooks/       # useWebRTC
    │   ├── pages/       # AuthPage, Dashboard, RoomPage
    │   └── utils/       # axios api instance
    ├── .env             # React env vars
    └── public/
```

## Setup & Run

### 1. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Environment variables

**backend/.env** (already configured):
```
MONGODB_URI=mongodb+srv://abubakrdeveloper00_db_user:OfHrwcvmDfNY4MpG@cluster0.e4w4b2c.mongodb.net/?appName=Cluster0
JWT_SECRET=rtc_super_secret_jwt_key_2024_abubakr
PORT=5000
CLIENT_URL=http://localhost:3000
```

**frontend/.env** (already configured):
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

### 3. Run the app

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
```

Visit: **http://localhost:3000**

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/users | Get all users |
| GET | /api/users/:id | Get user profile |
| PUT | /api/users/profile | Update profile |
| POST | /api/users/:id/follow | Follow/unfollow |
| GET | /api/users/:id/posts | Get user posts |
| POST | /api/users/posts/create | Create post |

### Rooms
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/rooms/create | Create room |
| GET | /api/rooms | Get public rooms |
| GET | /api/rooms/:roomId | Get room details |
| POST | /api/rooms/:roomId/join | Join room |
| DELETE | /api/rooms/:roomId | Delete room (host only) |

### Files
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/files/upload | Upload file (50MB max) |

## Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| room:join | Client→Server | Join video room |
| room:peers | Server→Client | List of existing peers |
| peer:new | Server→Client | New peer joined |
| peer:left | Server→Client | Peer disconnected |
| webrtc:offer | Bidirectional | SDP offer |
| webrtc:answer | Bidirectional | SDP answer |
| webrtc:ice-candidate | Bidirectional | ICE candidate |
| media:toggle | Bidirectional | Audio/video toggle |
| screen:share-start | Client→Room | Screen share started |
| screen:share-stop | Client→Room | Screen share stopped |
| chat:message | Bidirectional | Room chat message |
| whiteboard:draw | Bidirectional | Drawing data |
| whiteboard:clear | Bidirectional | Clear canvas |
| user:online | Server→All | User came online |
| user:offline | Server→All | User went offline |

## Notes

- WebRTC uses a **mesh topology** — each peer connects directly to every other peer (good for up to ~6 users; for larger scale, a media server like mediasoup would be needed)
- STUN servers from Google are used for NAT traversal (no TURN needed for most LAN scenarios)
- All file uploads are stored in `backend/uploads/` — in production, use S3 or similar
- JWT tokens expire after 7 days
