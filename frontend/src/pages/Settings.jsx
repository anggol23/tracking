import React, { useState, useEffect } from 'react';
import { Settings, Play, Square, Shield, User, Key, Cpu, Radio, Compass, BellRing } from 'lucide-react';
import { useAuth, API_BASE } from '../context/AuthContext.jsx';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';
import { io } from 'socket.io-client';

export default function SettingsPage() {
  const { user, token } = useAuth();
  const { devices, refetchAll } = useRealtimeData();

  const [simActive, setSimActive] = useState(false);
  const [simSockets, setSimSockets] = useState({});
  const [simInterval, setSimInterval] = useState(null);

  // Form State
  const [profile, setProfile] = useState({
    username: user?.username || '',
    email: user?.email || '',
    role: user?.role || 'user',
  });

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  // Predefined routes for simulation around Jakarta area
  const baseCoordinates = [
    { lat: -6.2088, lng: 106.8456 }, // Jakarta Center
    { lat: -6.1800, lng: 106.8294 }, // Monas Area
    { lat: -6.2297, lng: 106.8159 }, // SCBD Area
    { lat: -6.1751, lng: 106.8650 }, // Rawamangun Area
    { lat: -6.2615, lng: 106.8106 }, // Kemang Area
    { lat: -6.1674, lng: 106.7842 }, // Grogol Area
  ];

  // In-Browser Simulator logic
  const handleToggleSimulation = () => {
    if (simActive) {
      // Turn simulator off
      if (simInterval) {
        clearInterval(simInterval);
        setSimInterval(null);
      }

      // Disconnect all simulator sockets
      Object.values(simSockets).forEach((socket) => {
        socket.disconnect();
      });
      setSimSockets({});
      setSimActive(false);
      refetchAll();
      console.log('Telemetry simulation stopped.');
    } else {
      // Turn simulator on
      if (devices.length === 0) {
        alert('Please register at least one device in the Devices tab before starting simulation.');
        return;
      }

      setSimActive(true);
      const sockets = {};
      const SOCKET_SERVER = 'http://localhost:5000';

      // 1. Establish socket connections for each device mimicking independent GPS hardware
      devices.forEach((device) => {
        const socket = io(SOCKET_SERVER, {
          transports: ['websocket'],
          reconnectionAttempts: 2,
        });

        socket.on('connect', () => {
          socket.emit('device:auth', { token: device.token });
        });

        socket.on('device:auth_success', () => {
          console.log(`Simulated device connected: ${device.name}`);
        });

        sockets[device.id] = socket;
      });

      setSimSockets(sockets);

      // 2. Start simulation loop moving coordinates along paths
      let step = 0;
      const interval = setInterval(() => {
        step++;

        devices.forEach((device, index) => {
          const socket = sockets[device.id];
          if (!socket || !socket.connected) return;

          // Calculate movement using trigonometric loops around base coordinates
          const routeBase = baseCoordinates[index % baseCoordinates.length];
          const radiusMultiplier = 0.015; // spread size

          // Simulate circuitous movement
          const theta = (step * 0.05) + (index * 1.5);
          const currentLat = routeBase.lat + Math.sin(theta) * radiusMultiplier;
          const currentLng = routeBase.lng + Math.cos(theta * 1.5) * radiusMultiplier;
          
          // Speed variance
          const baseSpeed = 35 + (index * 8);
          const speedVar = Math.sin(step * 0.2) * 15;
          const currentSpeed = Math.max(0, baseSpeed + speedVar);

          socket.emit('device:ping', {
            latitude: currentLat,
            longitude: currentLng,
            speed: currentSpeed,
          });
        });
      }, 3000); // Send coordinates every 3 seconds

      setSimInterval(interval);
      console.log('Telemetry simulation initialized.');
    }
  };

  // Cleanup simulation if settings unmounts
  useEffect(() => {
    return () => {
      if (simInterval) clearInterval(simInterval);
      // Disconnect connections
      Object.values(simSockets).forEach((socket) => socket.disconnect());
    };
  }, [simInterval, simSockets]);

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. Core Profile Details Settings */}
      <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-sky-500/10 shadow-2xl flex flex-col gap-5">
        <h3 className="font-bold font-mono text-sm border-b border-sky-500/10 pb-2 text-slate-200 flex items-center gap-2">
          <User className="w-5 h-5 text-sky-400" /> Account Settings
        </h3>

        {saveSuccess && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs rounded-xl">
            Account settings updated successfully.
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4 font-mono text-xs text-slate-400">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Username</label>
              <input
                type="text"
                disabled
                value={profile.username}
                className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-4 py-2.5 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block mb-1">Email Address</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Access Role</label>
              <input
                type="text"
                disabled
                value={profile.role.toUpperCase()}
                className="w-full bg-slate-950/80 border border-slate-900 rounded-xl px-4 py-2.5 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block mb-1">Account Credentials State</label>
              <span className="block p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-emerald-400 font-bold uppercase tracking-wider text-[10px] text-center">
                ACTIVE JWT AUTHORIZED
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl border border-sky-400/20 transition-all cursor-pointer text-xs"
          >
            Save Changes
          </button>
        </form>
      </div>

      {/* 2. Fleet Simulation Configuration */}
      <div className="glass-panel p-6 rounded-2xl border border-sky-500/10 shadow-2xl flex flex-col gap-4">
        
        <h3 className="font-bold font-mono text-sm border-b border-sky-500/10 pb-2 text-slate-200 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-sky-400" /> Fleet Telemetry Simulator
        </h3>

        <p className="text-slate-500 font-mono text-[11px] leading-relaxed">
          Toggle simulation to verify the maps, history playback, and geofence systems in real-time. This simulates virtual cars driving around Jakarta.
        </p>

        <div className="space-y-4 bg-slate-950 p-4 border border-slate-900 rounded-2xl flex flex-col justify-between items-center text-center">
          <div className="inline-flex p-3 bg-sky-500/5 rounded-2xl border border-sky-500/10 text-sky-400 mb-2">
            <Radio className={`w-8 h-8 ${simActive ? 'pulse-radar-cyan text-sky-400' : 'text-slate-600'}`} />
          </div>

          <div className="space-y-1">
            <span className="font-mono text-xs text-slate-300 font-bold">In-Browser GPS Simulator</span>
            <span className={`block font-mono text-[10px] font-semibold ${simActive ? 'text-emerald-400' : 'text-slate-600'}`}>
              {simActive ? 'SIMULATION BROADCAST ACTIVE' : 'SIMULATION OFFLINE'}
            </span>
          </div>

          <button
            onClick={handleToggleSimulation}
            className={`w-full font-mono font-bold text-xs py-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
              simActive
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
            }`}
          >
            {simActive ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" /> Terminate Sim
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Initialize Sim
              </>
            )}
          </button>
        </div>

        {/* Warning notification */}
        <div className="flex gap-2.5 p-3 rounded-xl bg-sky-500/5 border border-sky-500/10 text-[10px] font-mono text-sky-400 leading-normal">
          <BellRing className="w-5 h-5 shrink-0" />
          <span>Note: Circular geofences are evaluated on coordinates updates. Exit a circular radius to trigger security alarms.</span>
        </div>
      </div>

    </div>
  );
}
