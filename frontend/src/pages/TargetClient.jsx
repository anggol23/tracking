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

  return (
    <div className="min-h-screen bg-[#040712] flex items-center justify-center p-4 font-mono text-xs">
      
      {/* Glow background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-72 h-72 bg-sky-500/10 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="w-full max-w-sm glass-panel-heavy p-6 rounded-2xl border border-sky-500/20 text-center space-y-6">
        
        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex p-3 bg-sky-500/5 rounded-xl border border-sky-500/10 text-sky-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-sm font-bold text-slate-200 tracking-wider">AEGIS FIELD TRANSPONDER</h2>
          <p className="text-[10px] text-slate-500">PAIRED TOKEN: {token.substring(0, 15)}...</p>
        </div>

        {status === 'ready' && (
          <div className="space-y-4">
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Tautan ini digunakan untuk mengirimkan koordinat lokasi Anda ke pusat dashboard pemantauan secara real-time.
            </p>
            <button
              onClick={handleStartSharing}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl border border-sky-400/20 transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)] cursor-pointer"
            >
              Mulai Bagikan Lokasi
            </button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="py-6 flex flex-col items-center gap-3 text-sky-400">
            <span className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></span>
            <span>MENGHUBUNGKAN KE SERVER...</span>
          </div>
        )}

        {status === 'tracking' && (
          <div className="space-y-4 text-left">
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-emerald-400 text-center flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="font-bold">LOKASI AKTIF DILACAK</span>
            </div>

            {/* Video preview target */}
            <div className="aspect-video bg-black border border-slate-800 rounded-xl overflow-hidden relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600 gap-1 text-[10px]">
                  <Video className="w-6 h-6" />
                  <span>Kamera tidak aktif</span>
                </div>
              )}
            </div>

            {/* HUD Status */}
            <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-900 text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-600">LATITUDE:</span>
                <span className="text-slate-300">{coords.latitude ? coords.latitude.toFixed(5) : 'Mencari Satelit...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">LONGITUDE:</span>
                <span className="text-slate-300">{coords.longitude ? coords.longitude.toFixed(5) : 'Mencari Satelit...'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">KECEPATAN:</span>
                <span className="text-sky-400 font-bold">{speed.toFixed(1)} km/h</span>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 flex items-center gap-2 text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setStatus('ready')}
              className="w-full bg-slate-900 border border-slate-800 text-slate-300 py-2.5 rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
