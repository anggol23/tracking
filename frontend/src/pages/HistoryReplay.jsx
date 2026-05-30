import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { History, Play, Pause, RotateCcw, Calendar, Navigation, MapPin } from 'lucide-react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';
import { useAuth, API_BASE } from '../context/AuthContext.jsx';

export default function HistoryReplay() {
  const { devices } = useRealtimeData();
  const { authenticatedFetch } = useAuth();

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const pathLineRef = useRef(null);
  const replayMarkerRef = useRef(null);
  const playbackIntervalRef = useRef(null);

  // Form State
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 3); // Default to last 3 hours
    return d.toISOString().substring(0, 16);
  });
  const [endTime, setEndTime] = useState(() => {
    return new Date().toISOString().substring(0, 16);
  });

  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Playback Control State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // multiplier

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([-6.2088, 106.8456], 12);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(mapRef.current);

      L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    }

    return () => {
      // Map cleanup on unmount
    };
  }, []);

  // Cleanup map resources when unmounting
  useEffect(() => {
    return () => {
      stopPlayback();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Fetch History Points
  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    setError('');
    stopPlayback();
    setHistoryData([]);
    setCurrentIndex(0);

    if (!selectedDeviceId) {
      setError('Please select a device node.');
      return;
    }

    setLoading(true);
    try {
      const startIso = new Date(startTime).toISOString();
      const endIso = new Date(endTime).toISOString();

      const res = await authenticatedFetch(
        `${API_BASE}/history/${selectedDeviceId}?start=${startIso}&end=${endIso}`
      );

      if (!res.ok) {
        throw new Error('Failed to retrieve tracking data.');
      }

      const data = await res.json();
      if (data.length === 0) {
        setError('No tracking coordinates found for this range.');
        setLoading(false);
        return;
      }

      setHistoryData(data);
      renderPathOnMap(data);
    } catch (err) {
      setError(err.message || 'Error executing query.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Render Path & Prepare Tracker Marker
  const renderPathOnMap = (points) => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old layers
    if (pathLineRef.current) pathLineRef.current.remove();
    if (replayMarkerRef.current) replayMarkerRef.current.remove();

    const latlngs = points.map((p) => [p.latitude, p.longitude]);

    // Draw trip polyline route
    const polyline = L.polyline(latlngs, {
      color: '#38bdf8',
      weight: 3.5,
      opacity: 0.8,
      shadowColor: '#38bdf8',
      shadowBlur: 10,
    }).addTo(map);

    pathLineRef.current = polyline;

    // Draw Replay Tracker Marker at start position
    const startPoint = points[0];
    const markerIcon = L.divIcon({
      className: 'custom-replay-tracker',
      html: `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-7 h-7 rounded-full bg-sky-500/20 border border-sky-400/40 animate-ping"></div>
          <div class="w-4 h-4 rounded-full bg-sky-400 border-2 border-slate-900 shadow-[0_0_10px_rgba(56,189,248,0.6)] flex items-center justify-center">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const marker = L.marker([startPoint.latitude, startPoint.longitude], {
      icon: markerIcon,
    }).addTo(map);

    replayMarkerRef.current = marker;

    // Zoom map fit bounds
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  };

  // 4. Playback Logic loop
  const startPlayback = () => {
    if (historyData.length === 0) return;
    setIsPlaying(true);

    const intervalMs = Math.max(100, 800 / playbackSpeed);

    playbackIntervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;

        if (nextIndex >= historyData.length) {
          stopPlayback();
          return prevIndex; // reached end
        }

        updateReplayMarkerPosition(nextIndex);
        return nextIndex;
      });
    }, intervalMs);
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
  };

  const resetPlayback = () => {
    stopPlayback();
    setCurrentIndex(0);
    updateReplayMarkerPosition(0);
  };

  const updateReplayMarkerPosition = (index) => {
    const marker = replayMarkerRef.current;
    const map = mapRef.current;
    const point = historyData[index];

    if (marker && point) {
      const pos = [point.latitude, point.longitude];
      marker.setLatLng(pos);
      // Pan camera along with vehicle marker
      map.panTo(pos);
    }
  };

  // Adjust play interval dynamically on speed multiplier slider change
  useEffect(() => {
    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  }, [playbackSpeed]);

  const handleSliderChange = (e) => {
    const index = parseInt(e.target.value);
    setCurrentIndex(index);
    updateReplayMarkerPosition(index);
  };

  const activePoint = historyData[currentIndex] || null;

  return (
    <div className="space-y-6 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
      
      {/* Search Header Drawer */}
      <div className="glass-panel p-4 rounded-2xl">
        <form onSubmit={handleQuerySubmit} className="flex flex-wrap gap-4 items-end justify-between font-mono text-xs">
          
          <div className="flex flex-wrap gap-4 flex-1">
            
            {/* Select Device */}
            <div className="w-56">
              <label className="block text-slate-400 mb-1 text-[10px] uppercase">Node Unit</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                required
              >
                <option value="">Select Device...</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.divisi})
                  </option>
                ))}
              </select>
            </div>

            {/* Start Time */}
            <div className="w-48">
              <label className="block text-slate-400 mb-1 text-[10px] uppercase">Waktu Mulai</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                required
              />
            </div>

            {/* End Time */}
            <div className="w-48">
              <label className="block text-slate-400 mb-1 text-[10px] uppercase">Waktu Selesai</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(56,189,248,0.2)] disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-4 h-4" /> {loading ? 'Loading...' : 'Query Logs'}
          </button>
        </form>
        
        {error && (
          <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono rounded">
            {error}
          </div>
        )}
      </div>

      {/* Map View & Control Dashboards */}
      <div className="flex-1 min-h-0 relative rounded-2xl overflow-hidden border border-sky-500/10 shadow-2xl flex flex-col">
        
        {/* Map */}
        <div ref={mapContainerRef} className="w-full flex-1 z-10"></div>

        {/* Playback Telemetry HUD overlay */}
        {activePoint && (
          <div className="absolute top-4 right-4 z-20 glass-panel-heavy p-4 rounded-xl w-60 font-mono text-xs text-sky-400 space-y-1.5 border border-sky-500/20 shadow-2xl">
            <div className="font-bold border-b border-sky-500/10 pb-1 mb-2 text-slate-300 flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-sky-400" /> INSTANT TELEMETRY
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <span className="text-slate-500">SPEED:</span>
              <span className="text-slate-200 font-bold">{activePoint.speed.toFixed(1)} km/h</span>
              <span className="text-slate-500">LATITUDE:</span>
              <span>{activePoint.latitude.toFixed(5)}</span>
              <span className="text-slate-500">LONGITUDE:</span>
              <span>{activePoint.longitude.toFixed(5)}</span>
              <span className="text-slate-500">TIME:</span>
              <span className="text-[9px] text-slate-300 truncate">
                {new Date(activePoint.timestamp).toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}

        {/* Playback Control Bar bottom panel */}
        {historyData.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-2xl glass-panel-heavy p-4 rounded-2xl border border-sky-500/20 shadow-2xl flex flex-col gap-3 font-mono text-xs">
            
            {/* Progress Slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500">
                {currentIndex + 1} / {historyData.length}
              </span>
              <input
                type="range"
                min="0"
                max={historyData.length - 1}
                value={currentIndex}
                onChange={handleSliderChange}
                className="flex-1 h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <span className="text-[10px] text-slate-300 font-bold">
                {Math.round(((currentIndex + 1) / historyData.length) * 100)}%
              </span>
            </div>

            {/* Buttons control row */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={isPlaying ? stopPlayback : startPlayback}
                  className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/20 text-sky-400 transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={resetPlayback}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 transition-all cursor-pointer"
                  title="Reset playback"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Speed Multipliers */}
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg p-1">
                {[1, 2, 5, 10, 20].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold cursor-pointer transition-all ${
                      playbackSpeed === speed
                        ? 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
