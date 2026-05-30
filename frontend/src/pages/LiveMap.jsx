import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Compass, Target, Plus, MapPin, Eye, Info, X, Shield, RefreshCw } from 'lucide-react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';
import { useAuth, API_BASE } from '../context/AuthContext.jsx';

export default function LiveMap({ selectedDeviceId, setSelectedDeviceId }) {
  const { devices, geofences, refreshGeofences, refetchAll } = useRealtimeData();
  const { authenticatedFetch } = useAuth();
  
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const geofenceLayersRef = useRef({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [followMode, setFollowMode] = useState(true);
  const [activeTab, setActiveTab] = useState('devices'); // 'devices' | 'geofences'
  
  // Geofence Creation State
  const [creationMode, setCreationMode] = useState(false); // true when picking coords on map
  const [newGeofence, setNewGeofence] = useState({
    name: '',
    type: 'circle',
    lat: null,
    lng: null,
    radius: 500, // default meters
    deviceId: '',
  });

  const filteredDevices = devices.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([-6.2088, 106.8456], 12);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(mapRef.current);

      // Re-position zoom buttons to bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

      // Add map click listener for geofence coordinates choosing
      mapRef.current.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setNewGeofence((prev) => {
          if (prev.lat === null || creationMode) {
            return { ...prev, lat, lng };
          }
          return prev;
        });
      });
    }

    return () => {
      // Map cleanup occurs on unmount in second useEffect
    };
  }, [creationMode]);

  // Clean up map when page unmounts
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
        geofenceLayersRef.current = {};
      }
    };
  }, []);

  // 2. Sync Devices (Markers) on Telemetry Changes
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const currentMarkerIds = new Set();

    devices.forEach((device) => {
      if (device.latitude == null || device.longitude == null) return;
      currentMarkerIds.add(device.id);

      const position = [device.latitude, device.longitude];
      const isOnline = device.status === 'online';

      // Advanced marker HTML representing a military/fleet target
      const icon = L.divIcon({
        className: 'custom-leaflet-marker-active',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-8 h-8 rounded-full ${isOnline ? 'bg-sky-500/20 border border-sky-400/40 pulse-radar-cyan' : 'bg-slate-500/10 border border-slate-700/30'}"></div>
            <div class="w-3.5 h-3.5 rounded-full ${isOnline ? 'bg-sky-400 border-2 border-slate-900 shadow-md' : 'bg-slate-500 border border-slate-700'}"></div>
            ${isOnline ? `<div class="absolute -top-6 text-[9px] bg-slate-950/80 text-sky-300 font-mono px-1 py-0.5 rounded border border-sky-500/20 font-bold whitespace-nowrap shadow-md">${device.name}</div>` : ''}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (markersRef.current[device.id]) {
        // Move existing marker
        markersRef.current[device.id].setLatLng(position);
        markersRef.current[device.id].setIcon(icon);
      } else {
        // Create new marker
        const marker = L.marker(position, { icon }).addTo(map);
        marker.bindPopup(`
          <div class="font-mono text-xs p-2 space-y-1.5 min-w-[160px] text-slate-100">
            <div class="font-bold text-sky-400 border-b border-sky-500/20 pb-1 mb-1 flex items-center justify-between">
              <span>${device.name}</span>
              <span class="text-[8px] bg-sky-950 px-1 py-0.5 rounded uppercase border border-sky-800/40">${device.divisi}</span>
            </div>
            <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
              <span>Status:</span>
              <span class="${isOnline ? 'text-emerald-400' : 'text-slate-500'} font-semibold uppercase">${device.status}</span>
              <span>Speed:</span>
              <span class="text-slate-200 font-semibold">${device.speed.toFixed(1)} km/h</span>
              <span>Lat:</span>
              <span>${device.latitude.toFixed(5)}</span>
              <span>Lng:</span>
              <span>${device.longitude.toFixed(5)}</span>
            </div>
          </div>
        `);
        markersRef.current[device.id] = marker;
      }

      // Handle Follow Mode
      if (device.id === selectedDeviceId && followMode) {
        map.setView(position, map.getZoom());
      }
    });

    // Remove obsolete device markers
    Object.keys(markersRef.current).forEach((id) => {
      const numericId = parseInt(id);
      if (!currentMarkerIds.has(numericId)) {
        markersRef.current[numericId].remove();
        delete markersRef.current[numericId];
      }
    });
  }, [devices, selectedDeviceId, followMode]);

  // 3. Render Geofences overlay circles
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const currentGeofenceIds = new Set();

    geofences.forEach((gf) => {
      currentGeofenceIds.add(gf.id);
      
      const bounds = gf.coordinates;

      if (gf.type === 'circle') {
        const center = [bounds.lat, bounds.lng];
        
        if (geofenceLayersRef.current[gf.id]) {
          // Update properties
          geofenceLayersRef.current[gf.id].setLatLng(center);
          geofenceLayersRef.current[gf.id].setRadius(bounds.radius);
        } else {
          // Draw Circle
          const layer = L.circle(center, {
            radius: bounds.radius,
            color: '#38bdf8',
            fillColor: '#38bdf8',
            fillOpacity: 0.05,
            weight: 1.5,
            dashArray: '4, 4',
          }).addTo(map);

          layer.bindTooltip(`Geofence: ${gf.name}`, { sticky: true, className: 'bg-slate-900 border border-sky-500/20 text-sky-400 font-mono text-[10px]' });
          geofenceLayersRef.current[gf.id] = layer;
        }
      }
    });

    // Remove deleted geofences
    Object.keys(geofenceLayersRef.current).forEach((id) => {
      const numericId = parseInt(id);
      if (!currentGeofenceIds.has(numericId)) {
        geofenceLayersRef.current[numericId].remove();
        delete geofenceLayersRef.current[numericId];
      }
    });
  }, [geofences]);

  // Focus and open popup on selection
  useEffect(() => {
    if (selectedDeviceId && markersRef.current[selectedDeviceId]) {
      const marker = markersRef.current[selectedDeviceId];
      const device = devices.find((d) => d.id === selectedDeviceId);
      if (device && device.latitude) {
        mapRef.current.setView([device.latitude, device.longitude], 14);
        marker.openPopup();
      }
    }
  }, [selectedDeviceId]);

  const handleDeviceClick = (device) => {
    setSelectedDeviceId(device.id);
    setFollowMode(true);
  };

  const handleSaveGeofence = async (e) => {
    e.preventDefault();
    if (!newGeofence.name || newGeofence.lat == null) return;

    try {
      const payload = {
        name: newGeofence.name,
        type: newGeofence.type,
        coordinates: {
          lat: newGeofence.lat,
          lng: newGeofence.lng,
          radius: Number(newGeofence.radius),
        },
        deviceId: newGeofence.deviceId ? Number(newGeofence.deviceId) : null,
      };

      const res = await authenticatedFetch(`${API_BASE}/geofences`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await refreshGeofences();
        setCreationMode(false);
        setNewGeofence({
          name: '',
          type: 'circle',
          lat: null,
          lng: null,
          radius: 500,
          deviceId: '',
        });
      }
    } catch (err) {
      console.error('Error creating geofence:', err);
    }
  };

  const handleDeleteGeofence = async (id) => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/geofences/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await refreshGeofences();
      }
    } catch (err) {
      console.error('Error deleting geofence:', err);
    }
  };

  return (
    <div className="relative h-[calc(100vh-80px)] w-full overflow-hidden rounded-2xl border border-sky-500/10 shadow-2xl flex">
      
      {/* 1. Sidebar Control Panel Overlay */}
      <div className="w-80 h-full glass-panel border-r border-sky-500/10 flex flex-col z-20">
        
        {/* Toggle tabs */}
        <div className="flex border-b border-sky-500/10">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex-1 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'devices'
                ? 'text-sky-400 bg-sky-500/5 border-b-2 border-sky-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Devices ({filteredDevices.length})
          </button>
          <button
            onClick={() => setActiveTab('geofences')}
            className={`flex-1 py-3 text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              activeTab === 'geofences'
                ? 'text-sky-400 bg-sky-500/5 border-b-2 border-sky-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Geofences ({geofences.length})
          </button>
        </div>

        {/* Tab Content: Devices */}
        {activeTab === 'devices' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="p-4 border-b border-slate-900">
              <input
                type="text"
                placeholder="Search unit by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-900">
              {filteredDevices.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-xs font-mono">
                  No active devices found.
                </div>
              ) : (
                filteredDevices.map((device) => {
                  const isSelected = device.id === selectedDeviceId;
                  const isOnline = device.status === 'online';
                  return (
                    <div
                      key={device.id}
                      onClick={() => handleDeviceClick(device)}
                      className={`p-4 transition-all cursor-pointer border-l-4 ${
                        isSelected
                          ? 'bg-sky-500/10 border-sky-400 text-slate-100 shadow-[inset_0_0_15px_rgba(56,189,248,0.05)]'
                          : 'border-transparent text-slate-400 hover:bg-slate-900/40 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-xs font-mono">{device.name}</span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold border ${
                          isOnline
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}>
                          {device.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-slate-500">
                        <span>Speed: {isOnline ? `${device.speed.toFixed(1)} km/h` : '0.0 km/h'}</span>
                        <span>Divisi: {device.divisi}</span>
                      </div>
                      {device.latitude != null && (
                        <div className="text-[9px] font-mono text-slate-600 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-sky-500/50" />
                          {device.latitude.toFixed(5)}, {device.longitude.toFixed(5)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Follow toggle control */}
            {selectedDeviceId && (
              <div className="p-4 bg-slate-950 border-t border-slate-900 flex justify-between items-center text-xs font-mono">
                <span className="text-slate-400">Lock onto marker</span>
                <button
                  onClick={() => setFollowMode(!followMode)}
                  className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1 cursor-pointer transition-all ${
                    followMode
                      ? 'bg-sky-500/15 border-sky-400/30 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.15)]'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  {followMode ? 'LOCKED' : 'FREE'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Geofences */}
        {activeTab === 'geofences' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Create Geofence Button */}
            <div className="p-4 border-b border-slate-900">
              <button
                onClick={() => {
                  setCreationMode(true);
                  setActiveTab('geofences');
                }}
                className="w-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-500/50 py-2.5 rounded-xl font-bold font-mono text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_0_10px_rgba(56,189,248,0.1)]"
              >
                <Plus className="w-4 h-4" /> Create Geofence Area
              </button>
            </div>

            {/* Geofence List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-900">
              {geofences.length === 0 ? (
                <div className="text-center py-8 text-slate-600 text-xs font-mono">
                  No geofence boundaries stored.
                </div>
              ) : (
                geofences.map((gf) => (
                  <div key={gf.id} className="p-4 hover:bg-slate-900/20 flex flex-col gap-1.5 text-xs font-mono text-slate-400">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-300">{gf.name}</span>
                      <button
                        onClick={() => handleDeleteGeofence(gf.id)}
                        className="text-rose-400 hover:text-rose-300 text-[10px] hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                      <span>Type: Circle ({gf.coordinates.radius}m)</span>
                      <span>Target Node: {gf.deviceName || 'Global (All)'}</span>
                      <span className="truncate">Center: {gf.coordinates.lat?.toFixed(5)}, {gf.coordinates.lng?.toFixed(5)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Full screen Leaflet viewport */}
      <div className="flex-1 h-full relative z-10">
        <div ref={mapContainerRef} className="w-full h-full"></div>

        {/* Creation Overlay Drawer */}
        {creationMode && (
          <div className="absolute top-4 left-4 z-20 glass-panel-heavy p-5 rounded-2xl w-72 border border-sky-500/30 shadow-2xl flex flex-col gap-4 animate-slideIn">
            <div className="flex items-center justify-between border-b border-sky-500/10 pb-2">
              <span className="font-bold font-mono text-xs text-sky-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-sky-400" /> New Geofence Zone
              </span>
              <button
                onClick={() => setCreationMode(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {newGeofence.lat == null ? (
              <div className="py-4 text-center text-xs font-mono text-slate-500 animate-pulse">
                Click a point on the map to define the geofence center coordinates.
              </div>
            ) : (
              <form onSubmit={handleSaveGeofence} className="space-y-3.5 text-xs font-mono">
                <div>
                  <label className="block text-slate-500 mb-1 text-[10px] uppercase">Zone Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Main Office Area"
                    value={newGeofence.name}
                    onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <label className="block text-slate-500 mb-1 uppercase">Latitude</label>
                    <span className="block p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 truncate">
                      {newGeofence.lat.toFixed(5)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 uppercase">Longitude</label>
                    <span className="block p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 truncate">
                      {newGeofence.lng.toFixed(5)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 mb-1 text-[10px] uppercase">Radius (meters)</label>
                    <input
                      type="number"
                      required
                      min="50"
                      max="10000"
                      value={newGeofence.radius}
                      onChange={(e) => setNewGeofence({ ...newGeofence, radius: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1 text-[10px] uppercase">Assign Device</label>
                    <select
                      value={newGeofence.deviceId}
                      onChange={(e) => setNewGeofence({ ...newGeofence, deviceId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                    >
                      <option value="">Global (All)</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold py-2 rounded-lg transition-all shadow-md hover:shadow-lg cursor-pointer"
                >
                  Save Geofence
                </button>
              </form>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
