import React, { useState, useEffect, useRef } from 'react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';
import { Video, Grid, Maximize, Play, Pause, Camera, Download, Tv, AlertTriangle, MonitorPlay } from 'lucide-react';

export default function CameraMonitor() {
  const { devices, socket } = useRealtimeData();
  const [gridLayout, setGridLayout] = useState(2); // 1 = 1x1, 2 = 2x2, 3 = 3x3
  const [activeFeeds, setActiveFeeds] = useState([
    { id: 0, name: 'TARGET SCREEN (Mirrored)', deviceId: null, status: 'online' },
  ]);

  const [webcamActive, setWebcamActive] = useState(false);
  const [recordingFeedId, setRecordingFeedId] = useState(null);

  const videoRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // deviceId -> RTCPeerConnection
  const [remoteStreams, setRemoteStreams] = useState({}); // deviceId -> MediaStream
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Bind feeds to devices and join WebRTC rooms
  useEffect(() => {
    setActiveFeeds((prev) =>
      prev.map((feed, idx) => {
        const dev = devices[idx];
        return { ...feed, deviceId: dev ? dev.id : null, deviceName: dev ? dev.name : null };
      })
    );
  }, [devices]);

  // Join signaling rooms for each device
  useEffect(() => {
    if (!socket) return;
    activeFeeds.forEach((feed) => {
      if (feed.deviceId) {
        const room = `camera-${feed.deviceId}`;
        socket.emit('webrtc:join_room', room);
      }
    });
  }, [socket, activeFeeds]);

  // Handle incoming WebRTC signals
  useEffect(() => {
    if (!socket) return;
    const handleSignal = async (payload) => {
      const { senderSocketId, signal, deviceId } = payload;
      const id = deviceId || senderSocketId;
      let pc = peerConnectionsRef.current.get(id);
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnectionsRef.current.set(id, pc);
        pc.ontrack = (event) => {
          setRemoteStreams((prev) => ({ ...prev, [id]: event.streams[0] }));
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:signal', { deviceId: id, signal: { type: 'candidate', candidate: event.candidate } });
          }
        };
      }

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:signal', { deviceId: id, signal: { type: 'answer', sdp: pc.localDescription } });
      } else if (signal.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    };
    socket.on('webrtc:signal', handleSignal);
    return () => socket.off('webrtc:signal', handleSignal);
  }, [socket]);

  // Cleanup peer connections on component unmount
  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => {
        pc.close();
      });
    };
  }, []);

  const handleToggleWebcam = async () => {
    if (webcamActive) {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
      setWebcamActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) videoRef.current.srcObject = stream;
        setWebcamActive(true);
      } catch (err) {
        console.error('Error starting webcam:', err);
      }
    }
  };

  const handleStartRecording = (feedId) => {
    setRecordingFeedId(feedId);
    setTimeout(() => handleStopRecording(feedId), 5000);
  };

  const handleStopRecording = (feedId) => {
    alert(`Recording of CAM-0${feedId} completed. Downloading file...`);
    setRecordingFeedId(null);
  };

  const CanvasStream = ({ feed }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
      const ctx = canvasRef.current.getContext('2d');
      const render = () => {
        ctx.fillStyle = '#050c18';
        ctx.fillRect(0, 0, 384, 216);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`ID: ${feed.name}`, 15, 25);
        ctx.fillText(`STATUS: OFFLINE / SIMULATED`, 15, 40);
        requestAnimationFrame(render);
      };
      render();
    }, [feed]);
    return <canvas ref={canvasRef} width={384} height={216} className="w-full h-full object-cover rounded-xl" />;
  };

  const VideoStream = ({ stream }) => {
    const vidRef = useRef(null);
    useEffect(() => {
      if (vidRef.current) {
        vidRef.current.srcObject = stream;
      }
    }, [stream]);
    return <video ref={vidRef} autoPlay muted className="w-full h-full object-cover rounded-xl" />;
  };

  const captureSnapshot = (feedId) => {
    alert(`Snapshot from CAM-0${feedId} captured.`);
  };

  const displayedFeeds = activeFeeds.slice(0, gridLayout * gridLayout);

  return (
    <div className="space-y-6">
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-mono">
          <MonitorPlay className="w-5 h-5 text-sky-400" />
          <span className="text-slate-400">Stream Status:</span>
          <span className="text-emerald-400 font-bold bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/30 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> SECURE WSS
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={handleToggleWebcam} className="px-3 py-1.5 rounded-lg border font-mono text-xs text-sky-400">
            {webcamActive ? 'Disconnect Webcam' : 'Mount Local Webcam'}
          </button>
          <div className="flex items-center bg-slate-900 rounded-lg p-1">
            {[1, 2, 3].map((grid) => (
              <button key={grid} onClick={() => setGridLayout(grid)} className={`p-1.5 rounded-md ${gridLayout === grid ? 'bg-sky-500/15 text-sky-400' : 'text-slate-500'}`}>{grid}x{grid}</button>
            ))}
          </div>
        </div>
      </div>

      {displayedFeeds.map(feed => (
        <div key={feed.id} className="relative rounded-xl overflow-hidden bg-slate-900/30">
          {remoteStreams[feed.deviceId] ? (
            <VideoStream stream={remoteStreams[feed.deviceId]} />
          ) : (
            <CanvasStream feed={feed} />
          )}
          {/* Simulated Webcam Overlay HUD on CAM-01 */}
          {webcamActive && (
            <div className="absolute inset-0 p-4 flex flex-col justify-between font-mono text-[10px] text-sky-400 pointer-events-none bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/40">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="font-bold">ID: {feed.name} (LIVE WEBCAM)</span>
                  <span className="block text-slate-300">WEBRTC SIGNAL STABLE</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="text-rose-500 font-bold">REC</span>
                </div>
              </div>
              <div className="flex justify-between items-end text-slate-300">
                <div>
                  {feed.deviceLat ? (
                    <>
                      <span>LAT: {feed.deviceLat.toFixed(5)}</span>
                      <span className="block">LNG: {feed.deviceLng.toFixed(5)}</span>
                    </>
                  ) : (
                    <span>LAT/LNG CALIBRATING</span>
                  )}
                </div>
                <span>{new Date().toISOString()}</span>
              </div>
            </div>
          )}
          {/* Feed Metadata and Controls */}
          <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-900 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="font-bold font-mono text-xs text-slate-300">{feed.name}</span>
              <span className="text-[10px] font-mono text-slate-500">
                {feed.deviceName ? `Bind: ${feed.deviceName}` : 'Internal CCTV'}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => captureSnapshot(feed.id)} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-500/30 transition-all cursor-pointer" title="Take Snapshot">
                <Camera className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => recordingFeedId === feed.id ? handleStopRecording(feed.id) : handleStartRecording(feed.id)}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${recordingFeedId === feed.id ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30'}`}
                title={recordingFeedId === feed.id ? 'Stop Recording' : 'Record Stream'}>
                <Play className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>


  );
}
