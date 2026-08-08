import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, File, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const Chat = ({ socket, roomId, user }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat:message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    return () => socket.off('chat:message');
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() && !selectedFile) return;

    if (selectedFile) {
      sendFile();
      return;
    }

    socket?.emit('chat:message', { roomId, content: input.trim() });
    setInput('');
  };

  const sendFile = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const { data } = await api.post('/files/upload', formData);
      socket?.emit('chat:message', {
        roomId,
        content: input.trim() || selectedFile.name,
        type: 'file',
        fileUrl: data.fileUrl,
        fileName: selectedFile.name,
      });
      setInput('');
      setSelectedFile(null);
    } catch (err) {
      toast.error('File upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900/80">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white">Room Chat</h3>
        <p className="text-xs text-gray-500">{messages.length} messages</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center text-gray-600 text-sm py-8">
            <p>No messages yet.</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.sender?.toString() === user?._id?.toString() || msg.senderName === user?.username;
          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={i} className="text-center">
                <span className="text-xs text-gray-600 bg-gray-800/50 px-3 py-1 rounded-full">{msg.content}</span>
              </div>
            );
          }

          return (
            <div key={i} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} fade-in`}>
              {!isOwn && (
                <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white flex-shrink-0 mt-auto">
                  {msg.senderName?.[0]?.toUpperCase()}
                </div>
              )}
              <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isOwn && (
                  <span className="text-xs text-gray-500 px-1">{msg.senderName}</span>
                )}
                <div className={`rounded-xl px-3 py-2 text-sm break-words ${isOwn ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'}`}>
                  {msg.type === 'file' ? (
                    <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 underline">
                      <File className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{msg.fileName || 'Download file'}</span>
                    </a>
                  ) : (
                    msg.content
                  )}
                </div>
                <span className="text-xs text-gray-600 px-1">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* File preview */}
      {selectedFile && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 text-sm">
            <File className="w-4 h-4 text-indigo-400" />
            <span className="text-gray-300 truncate flex-1">{selectedFile.name}</span>
            <button onClick={() => setSelectedFile(null)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 border-t border-gray-700 flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={e => setSelectedFile(e.target.files[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-gray-500 hover:text-white transition-colors p-2"
          title="Attach file"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
        />
        <button
          type="submit"
          disabled={(!input.trim() && !selectedFile) || uploading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
};

export default Chat;
