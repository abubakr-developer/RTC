import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, Users, Clock, Search, Globe, Lock,
  LogOut, User, Bell, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('rooms');
  const [newRoom, setNewRoom] = useState({
    name: '',
    description: '',
    isPrivate: false,
    maxParticipants: 10,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [roomsRes, usersRes] = await Promise.all([
        api.get('/rooms'),
        api.get('/users'),
      ]);
      setRooms(roomsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/rooms/create', newRoom);
      setRooms(prev => [data, ...prev]);
      setShowCreate(false);
      setNewRoom({ name: '', description: '', isPrivate: false, maxParticipants: 10 });
      toast.success('Room created!');
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    }
  };

  const joinRoom = async (roomId) => {
    try {
      await api.post(`/rooms/${roomId}/join`);
      navigate(`/room/${roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join room');
    }
  };

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900/80 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg">ConnectRTC</span>
          </div>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold relative">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                user?.username?.[0]?.toUpperCase()
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'rooms', label: 'Video Rooms', icon: Video },
            { id: 'users', label: 'People', icon: Users },
            { id: 'profile', label: 'My Profile', icon: User },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-600/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gray-900/60 border-b border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">
                {activeTab === 'rooms' && 'Video Rooms'}
                {activeTab === 'users' && 'Community'}
                {activeTab === 'profile' && 'My Profile'}
              </h1>
              <p className="text-sm text-gray-500">
                {activeTab === 'rooms' && `${rooms.length} active rooms`}
                {activeTab === 'users' && `${users.length} members`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder={activeTab === 'rooms' ? 'Search rooms...' : 'Search people...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input-field pl-9 w-52 py-2 text-sm"
                />
              </div>

              {activeTab === 'rooms' && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="btn-primary flex items-center gap-2 py-2"
                >
                  <Plus className="w-4 h-4" />
                  New Room
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Rooms Tab */}
              {activeTab === 'rooms' && (
                <div>
                  {/* Quick join */}
                  <div className="card mb-6 bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-indigo-600/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Start Instantly</h3>
                        <p className="text-gray-400 text-sm mt-1">Create a new room and invite others to join</p>
                      </div>
                      <button
                        onClick={() => setShowCreate(true)}
                        className="btn-primary flex items-center gap-2"
                      >
                        <Video className="w-4 h-4" />
                        New Meeting
                      </button>
                    </div>
                  </div>

                  {/* Rooms grid */}
                  {filteredRooms.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <Video className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="text-lg">No rooms available</p>
                      <p className="text-sm mt-1">Create one to get started</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredRooms.map(room => (
                        <RoomCard key={room._id} room={room} onJoin={joinRoom} currentUser={user} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map(u => (
                    <UserCard key={u._id} user={u} currentUser={user} />
                  ))}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <ProfileSection user={user} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Create Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Create New Room</h2>
            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Room Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Team Standup"
                  value={newRoom.name}
                  onChange={e => setNewRoom(p => ({ ...p, name: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Description</label>
                <input
                  type="text"
                  placeholder="What's this room for?"
                  value={newRoom.description}
                  onChange={e => setNewRoom(p => ({ ...p, description: e.target.value }))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Max Participants</label>
                <input
                  type="number"
                  min="2" max="20"
                  value={newRoom.maxParticipants}
                  onChange={e => setNewRoom(p => ({ ...p, maxParticipants: Number(e.target.value) }))}
                  className="input-field"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="private"
                  checked={newRoom.isPrivate}
                  onChange={e => setNewRoom(p => ({ ...p, isPrivate: e.target.checked }))}
                  className="w-4 h-4 rounded accent-indigo-600"
                />
                <label htmlFor="private" className="text-sm text-gray-300">Private Room</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Create Room</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const RoomCard = ({ room, onJoin, currentUser }) => {
  const isHost = room.host?._id === currentUser?._id;
  const participantCount = room.participants?.length || 0;
  const isFull = participantCount >= room.maxParticipants;

  return (
    <div className="card hover:border-indigo-600/40 transition-all group cursor-pointer" onClick={() => !isFull && onJoin(room.roomId)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">{room.name}</h3>
            {room.isPrivate ? (
              <Lock className="w-3 h-3 text-gray-500" />
            ) : (
              <Globe className="w-3 h-3 text-gray-500" />
            )}
            {isHost && <span className="text-xs bg-indigo-600/20 text-indigo-400 px-1.5 py-0.5 rounded">Host</span>}
          </div>
          {room.description && (
            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{room.description}</p>
          )}
        </div>
        <div className={`w-2.5 h-2.5 rounded-full mt-1 ${room.isActive ? 'bg-green-500' : 'bg-gray-600'}`} />
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Users className="w-3.5 h-3.5" />
          <span>{participantCount}/{room.maxParticipants}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded font-mono">{room.roomId}</span>
        </div>
      </div>

      {/* Participants avatars */}
      <div className="flex items-center gap-1 mt-3">
        {room.participants?.slice(0, 5).map((p, i) => (
          <div key={p._id || i} className="w-6 h-6 rounded-full bg-indigo-600 border-2 border-gray-900 flex items-center justify-center text-xs text-white -ml-1 first:ml-0">
            {p.username?.[0]?.toUpperCase() || '?'}
          </div>
        ))}
        {participantCount > 5 && (
          <span className="text-xs text-gray-500 ml-1">+{participantCount - 5}</span>
        )}
      </div>

      <button
        disabled={isFull}
        className={`mt-4 w-full py-2 rounded-lg text-sm font-medium transition-all ${
          isFull ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-600/30'
        }`}
      >
        {isFull ? 'Room Full' : 'Join Room'}
      </button>
    </div>
  );
};

const UserCard = ({ user, currentUser }) => (
  <div className="card flex items-center gap-4">
    <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0 relative">
      {user.avatar ? (
        <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
      ) : (
        user.username?.[0]?.toUpperCase()
      )}
      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-800 ${user.isOnline ? 'bg-green-500' : 'bg-gray-600'}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-white truncate">{user.username}</p>
      <p className="text-sm text-gray-500 truncate">{user.bio || 'No bio yet'}</p>
      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
        <span>{user.followers?.length || 0} followers</span>
        <span>{user.following?.length || 0} following</span>
      </div>
    </div>
  </div>
);

const ProfileSection = ({ user }) => (
  <div className="max-w-2xl">
    <div className="card">
      <div className="flex items-center gap-6 mb-6">
        <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-bold">
          {user?.username?.[0]?.toUpperCase()}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">{user?.username}</h2>
          <p className="text-gray-400">{user?.email}</p>
          <p className="text-gray-500 text-sm mt-1">{user?.bio || 'No bio yet'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900/60 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-white">{user?.followers?.length || 0}</p>
          <p className="text-sm text-gray-500">Followers</p>
        </div>
        <div className="bg-gray-900/60 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-white">{user?.following?.length || 0}</p>
          <p className="text-sm text-gray-500">Following</p>
        </div>
      </div>
    </div>
  </div>
);

export default Dashboard;
