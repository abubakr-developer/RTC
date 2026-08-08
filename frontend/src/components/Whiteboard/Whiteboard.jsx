import { useRef, useEffect, useState, useCallback } from 'react';
import { Pencil, Eraser, Square, Circle, Minus, Trash2, Download, Palette } from 'lucide-react';

const Whiteboard = ({ socket, roomId }) => {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('whiteboard:draw', ({ data }) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      drawFromData(ctx, data);
    });

    socket.on('whiteboard:clear', () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0f0f1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      socket.off('whiteboard:draw');
      socket.off('whiteboard:clear');
    };
  }, [socket]);

  const drawFromData = (ctx, data) => {
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (data.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    if (data.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
    } else if (data.type === 'move') {
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
    }
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = useCallback((e) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getPos(e);
    lastPos.current = pos;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const data = { type: 'start', x: pos.x, y: pos.y, tool, color, lineWidth };
    drawFromData(ctx, data);
    socket?.emit('whiteboard:draw', { roomId, data });
  }, [tool, color, lineWidth, socket, roomId]);

  const draw = useCallback((e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const data = { type: 'move', x: pos.x, y: pos.y, tool, color, lineWidth };
    drawFromData(ctx, data);
    socket?.emit('whiteboard:draw', { roomId, data });
    lastPos.current = pos;
  }, [tool, color, lineWidth, socket, roomId]);

  const stopDraw = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const clearBoard = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    socket?.emit('whiteboard:clear', { roomId });
  };

  const downloadBoard = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#ffffff', '#94a3b8'];
  const tools = [
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'eraser', icon: Eraser, label: 'Eraser' },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-900/80">
      {/* Toolbar */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-700 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              title={label}
              onClick={() => setTool(id)}
              className={`p-2 rounded-md transition-all ${tool === id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1.5">
          {colors.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label title="Custom color">
            <Palette className="w-5 h-5 text-gray-400 hover:text-white cursor-pointer ml-1" />
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="sr-only" />
          </label>
        </div>

        {/* Line width */}
        <div className="flex items-center gap-2">
          <Minus className="w-3 h-3 text-gray-500" />
          <input
            type="range" min="1" max="20" value={lineWidth}
            onChange={e => setLineWidth(Number(e.target.value))}
            className="w-20 accent-indigo-600"
          />
          <span className="text-xs text-gray-500 w-4">{lineWidth}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={clearBoard} className="btn-danger py-1.5 px-3 text-sm flex items-center gap-1.5">
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button onClick={downloadBoard} className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;
