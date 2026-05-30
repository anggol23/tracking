import React, { useState, useEffect, useRef } from 'react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';
import { Video, Grid, Maximize, Play, Pause, Camera, Download, Tv, AlertTriangle, MonitorPlay, RefreshCcw } from 'lucide-react';
import TargetScreenFeed from './TargetScreenFeed.jsx';

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

  // Map first device as target screen when devices are loaded
  useEffect(() => {
    if (devices.length === 0) return;
    const firstDevice = devices[0];
    setActiveFeeds(prev => prev.map(feed => ({
      ...feed,
      deviceId: firstDevice.id,
      status: firstDevice.status,
    })));
  }, [devices]);

  // Join signaling rooms for each feed when deviceId is known
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

  // Assign deviceId to target feed when a remote stream appears (if not set yet)
  useEffect(() => {
    // If feed already has a deviceId, nothing to do
    if (activeFeeds[0].deviceId !== null) return;
    const streamIds = Object.keys(remoteStreams);
    if (streamIds.length > 0) {
      const firstId = parseInt(streamIds[0], 10);
      console.log('Assigning deviceId for target screen:', firstId);
      setActiveFeeds((prev) =>
        prev.map((feed) => ({ ...feed, deviceId: firstId, status: 'online' }))
      );
    }
  }, [remoteStreams]);

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
        ctx.fillText(`STATUS: ${feed.status.toUpperCase()}`, 15, 40);
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
      {/* Target Screen Feed */}
      <TargetScreenFeed feed={activeFeeds[0]} remoteStreams={remoteStreams} socket={socket} />
    </div>
  );
}
