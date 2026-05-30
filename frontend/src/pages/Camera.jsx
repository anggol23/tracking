import React, { useState, useEffect, useRef } from 'react';
import { Video, Grid, Maximize, Play, Pause, Camera, Download, Tv, AlertTriangle, MonitorPlay } from 'lucide-react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';

export default function CameraMonitor() {
  const { devices } = useRealtimeData();
  const [gridLayout, setGridLayout] = useState(2); // 1 = 1x1, 2 = 2x2, 3 = 3x3
  const [activeFeeds, setActiveFeeds] = useState([
    { id: 1, name: 'CAM-01 (Gate Alpha)', deviceId: null, status: 'online' },
    { id: 2, name: 'CAM-02 (Loading Dock)', deviceId: null, status: 'online' },
    { id: 3, name: 'CAM-03 (Server Room)', deviceId: null, status: 'online' },
    { id: 4, name: 'CAM-04 (Perimeter West)', deviceId: null, status: 'online' },
    { id: 5, name: 'CAM-05 (Main Office)', deviceId: null, status: 'online' },
    { id: 6, name: 'CAM-06 (Gate Beta)', deviceId: null, status: 'online' },
    { id: 7, name: 'CAM-07 (Warehouse Inner)', deviceId: null, status: 'online' },
    { id: 8, name: 'CAM-08 (Fuel Station)', deviceId: null, status: 'online' },
    { id: 9, name: 'CAM-09 (HQ Parking)', deviceId: null, status: 'online' },
  ]);

  const [webcamActive, setWebcamActive] = useState(false);
  const [recordingFeedId, setRecordingFeedId] = useState(null);
  const [fullscreenFeedId, setFullscreenFeedId] = useState(null);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Bind first few cams to actual devices
  useEffect(() => {
    setActiveFeeds((prev) =>
      prev.map((feed, index) => {
        const matchingDevice = devices[index];
        return {
          ...feed,
          deviceId: matchingDevice ? matchingDevice.id : null,
          deviceName: matchingDevice ? matchingDevice.name : null,
          deviceLat: matchingDevice ? matchingDevice.latitude : null,
          deviceLng: matchingDevice ? matchingDevice.longitude : null,
          deviceSpeed: matchingDevice ? matchingDevice.speed : null,
        };
      })
    );
  }, [devices]);

  // Webcam stream toggle helper
  const handleToggleWebcam = async () => {
    if (webcamActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setWebcamActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setWebcamActive(true);
      } catch (err) {
        console.error('Error starting webcam:', err);
        alert('Webcam permission denied or not found. Falling back to simulated feed.');
      }
    }
  };

  // Recording controls
  const handleStartRecording = (feedId) => {
    if (recordingFeedId) return;

    if (feedId === 1 && webcamActive && videoRef.current?.srcObject) {
      // Record actual webcam stream
      recordedChunksRef.current = [];
      const stream = videoRef.current.srcObject;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cctv_recording_${feedId}_${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();
      setRecordingFeedId(feedId);
    } else {
      // Simulate standard recording files
      setRecordingFeedId(feedId);
      setTimeout(() => {
        handleStopRecording(feedId, true);
      }, 5000); // record for 5 seconds
    }
  };

  const handleStopRecording = (feedId, isSimulated = false) => {
    if (feedId === 1 && webcamActive && mediaRecorderRef.current && !isSimulated) {
      mediaRecorderRef.current.stop();
    } else {
      // Sim download
      alert(`Simulated feed recording of CAM-0${feedId} completed. Downloading file...`);
      const blob = new Blob(['Simulated Video Frame Content'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simulated_cctv_${feedId}.mp4`;
      a.click();
    }
    setRecordingFeedId(null);
  };

  // Canvas CCTV Sim rendering
  const CanvasStream = ({ feed }) => {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let frameCount = 0;
      let scanlineY = 0;

      const render = () => {
        frameCount++;
        ctx.fillStyle = '#050c18';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 1. Draw noise scan patterns
        ctx.fillStyle = 'rgba(56, 189, 248, 0.02)';
        for (let i = 0; i < canvas.height; i += 4) {
          if (Math.random() > 0.3) {
            ctx.fillRect(0, i, canvas.width, 2);
          }
        }

        // 2. Draw moving radar scanning grid
        scanlineY = (scanlineY + 1) % canvas.height;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, scanlineY);
        ctx.lineTo(canvas.width, scanlineY);
        ctx.stroke();

        // 3. Telemetry Overlay hud text
        ctx.font = '10px Courier New, monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`ID: ${feed.name}`, 15, 25);
        ctx.fillText(`STATUS: ACTIVE [1080P]`, 15, 40);

        // Live coordinates from associated device
        if (feed.deviceLat) {
          ctx.fillText(`LAT: ${feed.deviceLat.toFixed(5)}`, 15, 60);
          ctx.fillText(`LNG: ${feed.deviceLng.toFixed(5)}`, 15, 75);
          ctx.fillText(`SPEED: ${feed.deviceSpeed.toFixed(1)} KM/H`, 15, 90);
        } else {
          ctx.fillText(`LAT: NO SIGNAL`, 15, 60);
          ctx.fillText(`LNG: NO SIGNAL`, 15, 75);
        }

        // 4. Floating radar circles/crosshairs in center
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 40, 0, Math.PI * 2);
        ctx.arc(canvas.width / 2, canvas.height / 2, 80, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 100, canvas.height / 2);
        ctx.lineTo(canvas.width / 2 + 100, canvas.height / 2);
        ctx.moveTo(canvas.width / 2, canvas.height / 2 - 60);
        ctx.lineTo(canvas.width / 2, canvas.height / 2 + 60);
        ctx.stroke();

        // 5. Flashing recording indicator
        if (Math.floor(frameCount / 30) % 2 === 0) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(canvas.width - 25, 25, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ef4444';
          ctx.fillText('REC', canvas.width - 55, 28);
        }

        // Timestamp
        const now = new Date().toISOString();
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(now, canvas.width - 165, canvas.height - 15);

        animationFrameRef.current = requestAnimationFrame(render);
      };

      render();

      return () => {
        cancelAnimationFrame(animationFrameRef.current);
      };
    }, [feed]);

    return (
      <canvas
        ref={canvasRef}
        width={384}
        height={216}
        className="w-full h-full object-cover rounded-xl"
      />
    );
  };

  const captureSnapshot = (feedId) => {
    alert(`Snapshot from CAM-0${feedId} downloaded successfully!`);
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '20px monospace';
    ctx.fillText(`CAM-0${feedId} SECURITY CAPTURE`, 50, 100);
    ctx.font = '14px monospace';
    ctx.fillText(`Timestamp: ${new Date().toISOString()}`, 50, 150);

    const dataUrl = canvas.toDataURL('image/jpeg');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `cctv_snapshot_${feedId}.jpg`;
    a.click();
  };

  // Slice feeds array to match grid count (1x1 = 1, 2x2 = 4, 3x3 = 9)
  const displayedFeeds = activeFeeds.slice(0, gridLayout * gridLayout);

  return (
    <div className="space-y-6">
      
      {/* Menu / Settings Header */}
      <div className="glass-panel p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
        
        {/* Connection health summary */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <MonitorPlay className="w-5 h-5 text-sky-400" />
          <span className="text-slate-400">Stream Status:</span>
          <span className="text-emerald-400 font-bold bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/30 uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping"></span> SECURE WSS
          </span>
        </div>

        {/* Layout and WebRTC actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleWebcam}
            className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition-all cursor-pointer ${
              webcamActive
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                : 'bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20'
            }`}
          >
            {webcamActive ? 'Disconnect Webcam' : 'Mount Local Webcam (CAM-01)'}
          </button>

          {/* Grid Size Buttons */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
            {[1, 2, 3].map((grid) => (
              <button
                key={grid}
                onClick={() => setGridLayout(grid)}
                className={`p-1.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                  gridLayout === grid
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
                title={`Layout ${grid}x${grid}`}
              >
                {grid}x{grid}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CCTV Camera Grid Layout */}
      <div className={`grid gap-5 ${
        gridLayout === 1 ? 'grid-cols-1' : gridLayout === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        
        {displayedFeeds.map((feed) => {
          const isRecording = recordingFeedId === feed.id;
          const isWebcamActive = feed.id === 1 && webcamActive;

          return (
            <div
              key={feed.id}
              className={`glass-panel rounded-2xl overflow-hidden flex flex-col relative border ${
                isRecording ? 'border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-sky-500/10'
              }`}
            >
              
              {/* Camera Stream Window */}
              <div className="relative aspect-video bg-[#02050c] overflow-hidden flex items-center justify-center">
                {isWebcamActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-t-xl scale-x-[-1]"
                  />
                ) : (
                  <CanvasStream feed={feed} />
                )}

                {/* Simulated Webcam Overlay HUD on CAM-1 */}
                {isWebcamActive && (
                  <div className="absolute inset-0 p-4 flex flex-col justify-between font-mono text-[10px] text-sky-400 pointer-events-none bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/40">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="font-bold">ID: CAM-01 (LIVE WEBCAM)</span>
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
              </div>

              {/* Feed Metadata and Controls */}
              <div className="px-5 py-3 bg-slate-950/60 border-t border-slate-900 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-bold font-mono text-xs text-slate-300">{feed.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {feed.deviceName ? `Bind: ${feed.deviceName}` : 'Internal CCTV'}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => captureSnapshot(feed.id)}
                    className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-500/30 transition-all cursor-pointer"
                    title="Take Snapshot"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() =>
                      isRecording ? handleStopRecording(feed.id) : handleStartRecording(feed.id)
                    }
                    className={`p-2 rounded-lg border transition-all cursor-pointer ${
                      isRecording
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30'
                    }`}
                    title={isRecording ? 'Stop Recording' : 'Record Stream'}
                  >
                    <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
