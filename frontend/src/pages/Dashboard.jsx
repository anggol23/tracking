import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Cpu, Radio, ShieldAlert, Signal, Activity, MapPin, Compass } from 'lucide-react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';

export default function Dashboard({ setCurrentPage, setSelectedDeviceId }) {
  const { devices, alerts } = useRealtimeData();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [selectedDevice, setSelectedDevice] = useState(null);

  // Stats calculation
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const offlineDevices = totalDevices - onlineDevices;
  const activeAlerts = alerts.filter((a) => !a.resolved).length;

  // Initialize and update mini map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 1. Initialize map if not exists
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([-6.2088, 106.8456], 11); // Default center (Jakarta)

      // Add futuristic dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // 2. Synchronize markers
    const currentMarkerIds = new Set();

    devices.forEach((device) => {
      if (device.latitude == null || device.longitude == null) return;
      currentMarkerIds.add(device.id);

      const isOnline = device.status === 'online';
      const position = [device.latitude, device.longitude];

      // Custom pulsing HTML marker icon
      const icon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-4 h-4 rounded-full ${isOnline ? 'bg-sky-500/30 animate-ping' : 'bg-slate-500/20'}"></div>
            <div class="w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-sky-400 border border-white' : 'bg-slate-500 border border-slate-700'}"></div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      if (markersRef.current[device.id]) {
        // Move existing marker
        markersRef.current[device.id].setLatLng(position);
        markersRef.current[device.id].setIcon(icon);
      } else {
        // Create new marker
        const marker = L.marker(position, { icon }).addTo(map);
        marker.bindPopup(`
          <div class="font-mono text-xs p-1">
            <div class="font-bold text-sky-400 border-b border-sky-500/20 pb-1 mb-1">${device.name}</div>
            <div>Group: ${device.location_group}</div>
            <div>Speed: ${device.speed.toFixed(1)} km/h</div>
            <div>Status: <span class="${isOnline ? 'text-emerald-400' : 'text-slate-400'} font-semibold">${device.status.toUpperCase()}</span></div>
          </div>
        `);
        markersRef.current[device.id] = marker;
      }
    });

    // Remove old markers for deleted devices
    Object.keys(markersRef.current).forEach((id) => {
      const numericId = parseInt(id);
      if (!currentMarkerIds.has(numericId)) {
        markersRef.current[numericId].remove();
        delete markersRef.current[numericId];
      }
    });

    // Adjust zoom bounds if there are markers
    const onlineMarkers = devices
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => [d.latitude, d.longitude]);

    if (onlineMarkers.length > 0) {
      const bounds = L.latLngBounds(onlineMarkers);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }

    return () => {
      // Don't destroy map on every update, but keep cleanup logic for unmounting
    };
  }, [devices]);

  // Clean up map when page unmounts
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
  }, []);

  const handleLocateDevice = (device) => {
    setSelectedDeviceId(device.id);
    setCurrentPage('map');
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Devices */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-sky-500 hover:shadow-[0_0_15px_rgba(56,189,248,0.1)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Total Unit</span>
            <h3 className="text-2xl font-bold font-mono text-slate-100">{totalDevices}</h3>
          </div>
          <div className="p-3 bg-sky-500/10 rounded-xl text-sky-400 border border-sky-500/20 shadow-[0_0_10px_rgba(56,189,248,0.15)]">
            <Cpu className="w-6 h-6" />
          </div>
        </div>

        {/* Online Devices */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Device Online</span>
            <h3 className="text-2xl font-bold font-mono text-emerald-400">{onlineDevices}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            <Signal className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        {/* Offline Devices */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-slate-600 hover:shadow-[0_0_15px_rgba(100,116,139,0.05)] transition-all">
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Device Offline</span>
            <h3 className="text-2xl font-bold font-mono text-slate-400">{offlineDevices}</h3>
          </div>
          <div className="p-3 bg-slate-800/40 rounded-xl text-slate-500 border border-slate-700/50">
            <Signal className="w-6 h-6" />
          </div>
        </div>

        {/* Active Alerts */}
        <div className={`glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 transition-all ${
          activeAlerts > 0 
            ? 'border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
            : 'border-indigo-500'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">Peringatan Aktif</span>
            <h3 className={`text-2xl font-bold font-mono ${activeAlerts > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
              {activeAlerts}
            </h3>
          </div>
          <div className={`p-3 rounded-xl border ${
            activeAlerts > 0 
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' 
              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
          }`}>
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Map & Active Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Live Mini Map */}
        <div className="lg:col-span-2 glass-panel rounded-2xl overflow-hidden flex flex-col h-[400px]">
          <div className="px-5 py-4 border-b border-sky-500/10 flex items-center justify-between">
            <span className="font-bold font-mono text-sm tracking-wider text-slate-300 flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400 animate-pulse" /> Live Telemetry View
            </span>
            <button
              onClick={() => setCurrentPage('map')}
              className="text-xs font-mono text-sky-400 hover:underline hover:text-sky-300 cursor-pointer"
            >
              Expand Full Map →
            </button>
          </div>
          <div className="flex-1 relative">
            <div ref={mapContainerRef} className="w-full h-full z-10"></div>
            {totalDevices === 0 && (
              <div className="absolute inset-0 bg-slate-950/80 z-20 flex items-center justify-center text-slate-500 font-mono text-xs">
                No active devices mapped. Register a new node to begin.
              </div>
            )}
          </div>
        </div>

        {/* Security Alerts Feed */}
        <div className="glass-panel rounded-2xl flex flex-col h-[400px]">
          <div className="px-5 py-4 border-b border-sky-500/10">
            <span className="font-bold font-mono text-sm tracking-wider text-slate-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> Recent Security Breach logs
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {alerts.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 font-mono text-xs text-center px-4">
                No geofence breaches or disconnections recorded.
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id || alert.timestamp}
                  className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5 hover:border-sky-500/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase">
                      {alert.type?.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono leading-relaxed">{alert.message}</p>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-950">
                    <span>Node: {alert.deviceName}</span>
                    <button
                      onClick={() => {
                        const dev = devices.find((d) => d.id === alert.deviceId);
                        if (dev && dev.latitude) {
                          mapRef.current?.setView([dev.latitude, dev.longitude], 14);
                          markersRef.current[dev.id]?.openPopup();
                        }
                      }}
                      className="text-sky-400 hover:underline cursor-pointer"
                    >
                      Locate Node
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Device Telemetry Summary */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-sky-500/10">
          <span className="font-bold font-mono text-sm tracking-wider text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" /> Device Telemetry Summary
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-slate-900/40 text-slate-400 border-b border-slate-800 uppercase tracking-widest text-[10px]">
                <th className="py-4 px-6">Nama Unit</th>
                <th className="py-4 px-6">Divisi</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Posisi GPS</th>
                <th className="py-4 px-6">Kecepatan</th>
                <th className="py-4 px-6">Terakhir Aktif</th>
                <th className="py-4 px-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-slate-500">
                    Belum ada device terdaftar.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const isOnline = device.status === 'online';
                  const isMockPos = device.latitude != null;
                  return (
                    <tr key={device.id} className="hover:bg-slate-800/15 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-300">{device.name}</td>
                      <td className="py-4 px-6 text-slate-400">{device.divisi}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border ${
                          isOnline 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                          {device.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-300">
                        {isMockPos ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-sky-400" />
                            <span>{device.latitude.toFixed(5)}, {device.longitude.toFixed(5)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600">Waiting calibration</span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-bold text-sky-400">
                        {isOnline ? `${device.speed.toFixed(1)} km/h` : '0.0 km/h'}
                      </td>
                      <td className="py-4 px-6 text-slate-500">
                        {device.last_update ? new Date(device.last_update).toLocaleTimeString() : 'N/A'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          disabled={!isMockPos}
                          onClick={() => handleLocateDevice(device)}
                          className="px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/20 font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Lacak Posisi
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
