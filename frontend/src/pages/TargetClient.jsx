import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { MapPin, Video, Send, CheckCircle, AlertCircle, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

export default function TargetClient({ token }) {
  const [status, setStatus] = useState('ready');
  const [errorMsg, setErrorMsg] = useState('');
  const [locationActive, setLocationActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [speed, setSpeed] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map()); // viewerSocketId -> RTCPeerConnection
  const deviceIdRef = useRef(null);
  const SOCKET_SERVER = import.meta.env.VITE_API_URL;
  const [step, setStep] = useState(0); // 0 = ask camera, 1 = ask location

  const ICE_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Cleanup all peer connections
  const cleanupPeers = useCallback(() => {
    peerConnectionsRef.current.forEach((pc, id) => {
      pc.close();
    });
    peerConnectionsRef.current.clear();
    setViewerCount(0);
  }, []);

  // Create a peer connection for a viewer and send offer
  const createPeerForViewer = useCallback(async (viewerSocketId) => {
    const socket = socketRef.current;
    const stream = localStreamRef.current;
    if (!socket || !stream) return;

    // Close existing connection if any
    if (peerConnectionsRef.current.has(viewerSocketId)) {
      peerConnectionsRef.current.get(viewerSocketId).close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(viewerSocketId, pc);
    setViewerCount(peerConnectionsRef.current.size);

    // Add local camera tracks to peer connection
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    // Send ICE candidates to viewer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:signal', {
          targetSocketId: viewerSocketId,
          signal: { type: 'candidate', candidate: event.candidate, deviceId: deviceIdRef.current },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        peerConnectionsRef.current.delete(viewerSocketId);
        setViewerCount(peerConnectionsRef.current.size);
      }
    };

    // Create and send offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:signal', {
        targetSocketId: viewerSocketId,
        signal: { type: 'offer', sdp: pc.localDescription, deviceId: deviceIdRef.current },
      });
    } catch (err) {
      console.error('Error creating offer:', err);
    }
  }, []);

  useEffect(() => {
    if (token && status === 'ready') {
      handleStartSharing();
    }
    return () => {
      if (geoWatchIdRef.current) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
      }
      cleanupPeers();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleStartSharing = async () => {
    setStatus('connecting');
    try {
      const socket = io(SOCKET_SERVER, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => socket.emit('device:auth', { token }));

      socket.on('device:auth_success', (data) => {
        setStatus('tracking');
        deviceIdRef.current = data.deviceId;

        // Join WebRTC signaling room for this device
        const roomId = `camera-${data.deviceId}`;
        socket.emit('webrtc:join_room', roomId);
      });

      socket.on('device:auth_error', (data) => {
        setStatus('error');
        setErrorMsg(data.message || 'Invalid token');
        socket.disconnect();
      });

      // When a dashboard viewer joins the camera room
      socket.on('webrtc:user_joined', ({ socketId }) => {
        console.log('Viewer joined, creating peer connection:', socketId);
        createPeerForViewer(socketId);
      });

      // Handle signaling messages from viewers (answers + ICE candidates)
      socket.on('webrtc:signal', async ({ senderSocketId, signal }) => {
        if (signal.type === 'request_offer') {
          console.log('Received request_offer from:', senderSocketId);
          createPeerForViewer(senderSocketId);
          return;
        }

        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (!pc) return;

        try {
          if (signal.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          } else if (signal.type === 'candidate') {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        } catch (err) {
          console.error('Signal handling error:', err);
        }
      });

    } catch (e) {
      setStatus('error');
      setErrorMsg('Failed to connect');
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setStep(1);
    } catch (e) {
      console.warn('Camera permission denied');
      setStep(1); // Still allow location even if camera denied
    }
  };

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const sp = speed ? speed * 3.6 : 0;
        setCoords({ latitude, longitude });
        setSpeed(sp);
        if (socketRef.current) {
          socketRef.current.emit('device:ping', { latitude, longitude, speed: sp });
        }
      },
      (err) => console.warn('Location permission denied', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
    geoWatchIdRef.current = watchId;
    setLocationActive(true);
  };

  return (
    <div className="min-h-screen bg-[#040712] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-mono text-sky-400">SECURE TRACKING SESSION</span>
          </div>

          {status === 'tracking' && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 text-xs font-mono">
              <Wifi className="w-3.5 h-3.5" />
              <span>CONNECTED TO SERVER</span>
              {viewerCount > 0 && (
                <span className="bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded text-sky-400">
                  {viewerCount} viewer{viewerCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {status === 'connecting' && (
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-mono">
              <span className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <span>CONNECTING...</span>
            </div>
          )}
        </div>

        {/* Camera Preview */}
        {cameraActive && (
          <div className="relative rounded-2xl overflow-hidden border border-sky-500/20 shadow-[0_0_30px_rgba(56,189,248,0.1)]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-video object-cover"
            />
            <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-950/70 backdrop-blur-sm px-2 py-1 rounded-lg">
              <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-mono text-rose-400 font-bold">LIVE</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {step === 0 && status === 'tracking' && (
          <button
            onClick={requestCamera}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-mono font-bold text-sm rounded-2xl transition-all shadow-[0_0_20px_rgba(56,189,248,0.2)] hover:shadow-[0_0_30px_rgba(56,189,248,0.4)]"
          >
            <Video className="w-5 h-5" />
            Aktifkan Kamera
          </button>
        )}

        {step === 1 && !locationActive && (
          <button
            onClick={requestLocation}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-mono font-bold text-sm rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)]"
          >
            <MapPin className="w-5 h-5" />
            Aktifkan Lokasi GPS
          </button>
        )}

        {/* Location Info */}
        {locationActive && coords.latitude && (
          <div className="bg-slate-900/60 border border-sky-500/10 rounded-2xl p-4 font-mono text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 mb-3">
              <CheckCircle className="w-4 h-4" />
              <span className="font-bold">TRACKING ACTIVE</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block text-[10px]">LATITUDE</span>
                <span className="text-slate-200">{coords.latitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">LONGITUDE</span>
                <span className="text-slate-200">{coords.longitude.toFixed(6)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SPEED</span>
                <span className="text-slate-200">{speed.toFixed(1)} km/h</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">CAMERA</span>
                <span className={cameraActive ? 'text-emerald-400' : 'text-slate-500'}>
                  {cameraActive ? 'STREAMING' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span className="text-rose-400 text-sm font-mono">{errorMsg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
