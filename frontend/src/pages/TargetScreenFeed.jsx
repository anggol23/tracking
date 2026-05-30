import React, { useEffect } from 'react';
import { RefreshCcw } from 'lucide-react';

export default function TargetScreenFeed({ feed, remoteStreams, socket }) {
  const stream = remoteStreams[feed.deviceId];

  // Join room on mount and on refresh
  const joinRoom = () => {
    if (feed.deviceId && socket) {
      const room = `camera-${feed.deviceId}`;
      socket.emit('webrtc:join_room', room);
    }
  };

  useEffect(() => {
    joinRoom();
  }, [feed.deviceId, socket]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-900/30">
      {stream ? (
        <video autoPlay muted className="w-full h-full object-cover rounded-xl" ref={el => { if (el) el.srcObject = stream; }} />
      ) : (
        <canvas ref={canvas => {
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#050c18';
            ctx.fillRect(0, 0, 384, 216);
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(`ID: ${feed.name}`, 15, 25);
            ctx.fillText(`STATUS: ${feed.status.toUpperCase()}`, 15, 40);
          }
        }} width={384} height={216} className="w-full h-full object-cover rounded-xl" />
      )}
      {/* Refresh Mirror Button */}
      <button onClick={joinRoom} className="absolute top-2 right-2 p-1 rounded bg-slate-800/70 hover:bg-slate-700/70 transition">
        <RefreshCcw className="w-4 h-4 text-slate-300" />
      </button>
    </div>
  );
}
