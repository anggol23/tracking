import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Plus, Edit, Trash, QrCode, Key, RefreshCw, X, ShieldAlert, Cpu } from 'lucide-react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';
import { useAuth, API_BASE } from '../context/AuthContext.jsx';

export default function Devices() {
  const { devices, refreshDevices } = useRealtimeData();
  const { user, authenticatedFetch } = useAuth();

  const isAdmin = user?.role === 'admin';
  const qrCanvasRef = useRef(null);

  // Forms and Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalDevice, setQrModalDevice] = useState(null);
  const [editDevice, setEditDevice] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    divisi: 'General',
    location_group: 'Headquarters',
  });

  const [error, setError] = useState('');

  // Render QR Code onto canvas context when modal device changes
  useEffect(() => {
    if (showQrModal && qrModalDevice && qrCanvasRef.current) {
      // Create a JSON string with pairing configuration
      const configPayload = JSON.stringify({
        deviceName: qrModalDevice.name,
        token: qrModalDevice.token,
        serverUrl: import.meta.env.VITE_API_URL,
      });

      QRCode.toCanvas(
        qrCanvasRef.current,
        configPayload,
        {
          width: 200,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#f8fafc',
          },
        },
        (err) => {
          if (err) console.error('QR rendering error:', err);
        }
      );
    }
  }, [showQrModal, qrModalDevice]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.name) return;

    try {
      const res = await authenticatedFetch(`${API_BASE}/devices`, {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await refreshDevices();
        setShowAddModal(false);
        setFormData({ name: '', divisi: 'General', location_group: 'Headquarters' });
      } else {
        const data = await res.json();
        setError(data.message || 'Error creating device.');
      }
    } catch (err) {
      setError('Connection failure.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editDevice.name) return;

    try {
      const res = await authenticatedFetch(`${API_BASE}/devices/${editDevice.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editDevice.name,
          divisi: editDevice.divisi,
          location_group: editDevice.location_group,
        }),
      });

      if (res.ok) {
        await refreshDevices();
        setEditDevice(null);
      }
    } catch (err) {
      console.error('Edit error:', err);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!window.confirm('Are you sure you want to decommission this tracking device? All historical logs will be deleted.')) return;

    try {
      const res = await authenticatedFetch(`${API_BASE}/devices/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await refreshDevices();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleRegenerateToken = async (id) => {
    if (!window.confirm('Regenerating token will disconnect this device instantly until it is re-paired. Continue?')) return;

    try {
      const res = await authenticatedFetch(`${API_BASE}/devices/${id}/token/regenerate`, {
        method: 'POST',
      });

      if (res.ok) {
        await refreshDevices();
        // Update QR view if active
        const data = await res.json();
        if (qrModalDevice && qrModalDevice.id === id) {
          setQrModalDevice({ ...qrModalDevice, token: data.token });
        }
      }
    } catch (err) {
      console.error('Token regeneration error:', err);
    }
  };

  return (
    <div className="space-y-6">

      {/* Action Header */}
      <div className="flex justify-between items-center bg-slate-900/40 p-4 border border-sky-500/10 rounded-2xl">
        <div className="flex items-center gap-3">
          <Cpu className="w-5 h-5 text-sky-400" />
          <span className="text-xs font-mono text-slate-400">Total configured units: {devices.length}</span>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded-xl border border-sky-400/20 shadow-[0_0_10px_rgba(56,189,248,0.15)] hover:shadow-[0_0_20px_rgba(56,189,248,0.35)] transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add New Device
          </button>
        )}
      </div>

      {/* Devices spreadsheet table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 border-b border-slate-800 uppercase tracking-widest text-[10px]">
                <th className="py-4 px-6">Nama Device</th>
                <th className="py-4 px-6">Divisi</th>
                <th className="py-4 px-6">Posisi Group</th>
                <th className="py-4 px-6">Device Token ID</th>
                <th className="py-4 px-6">Status Node</th>
                <th className="py-4 px-6 text-right">Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-500">
                    No active tracking nodes found. Click Add to create one.
                  </td>
                </tr>
              ) : (
                devices.map((device) => {
                  const isOnline = device.status === 'online';
                  return (
                    <tr key={device.id} className="hover:bg-slate-800/10 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-200">{device.name}</td>
                      <td className="py-4 px-6 text-slate-400">{device.divisi}</td>
                      <td className="py-4 px-6 text-slate-400">{device.location_group}</td>
                      <td className="py-4 px-6">
                        <span className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 text-[10px] text-sky-400/80 font-mono tracking-wide select-all">
                          {device.token.substring(0, 10)}...
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${isOnline
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}>
                          {device.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {/* Pairing QR */}
                        <button
                          onClick={() => {
                            setQrModalDevice(device);
                            setShowQrModal(true);
                          }}
                          className="p-2 rounded-lg bg-sky-500/10 hover:bg-sky-500/25 text-sky-400 border border-sky-500/20 transition-all cursor-pointer"
                          title="Generate Registration QR"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        {isAdmin && (
                          <>
                            {/* Regenerate Token */}
                            <button
                              onClick={() => handleRegenerateToken(device.id)}
                              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-sky-400 hover:border-sky-500/30 transition-all cursor-pointer"
                              title="Regenerate Pairing Token"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => setEditDevice(device)}
                              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition-all cursor-pointer"
                              title="Edit Node"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteDevice(device.id)}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                              title="Remove Node"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-heavy p-6 rounded-2xl max-w-md w-full border border-sky-500/30 shadow-2xl relative animate-scaleUp">

            <div className="flex justify-between items-center border-b border-sky-500/10 pb-3 mb-5">
              <h3 className="font-mono font-bold text-sm text-slate-200">Register Telemetry Node</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono rounded">
                {error}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Device/Unit Name</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Patrol vehicle A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-700 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Division (Divisi)</label>
                <input
                  type="text"
                  value={formData.divisi}
                  onChange={(e) => setFormData({ ...formData, divisi: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Location Group</label>
                <input
                  type="text"
                  value={formData.location_group}
                  onChange={(e) => setFormData({ ...formData, location_group: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold py-3 rounded-xl transition-all cursor-pointer uppercase text-xs"
              >
                Create Device Node
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Device Modal */}
      {editDevice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-heavy p-6 rounded-2xl max-w-md w-full border border-sky-500/30 shadow-2xl relative animate-scaleUp">

            <div className="flex justify-between items-center border-b border-sky-500/10 pb-3 mb-5">
              <h3 className="font-mono font-bold text-sm text-slate-200">Modify Node Configuration</h3>
              <button
                onClick={() => setEditDevice(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Device/Unit Name</label>
                <input
                  type="text"
                  required
                  value={editDevice.name}
                  onChange={(e) => setEditDevice({ ...editDevice, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Division (Divisi)</label>
                <input
                  type="text"
                  value={editDevice.divisi}
                  onChange={(e) => setEditDevice({ ...editDevice, divisi: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Location Group</label>
                <input
                  type="text"
                  value={editDevice.location_group}
                  onChange={(e) => setEditDevice({ ...editDevice, location_group: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold py-3 rounded-xl transition-all cursor-pointer uppercase text-xs"
              >
                Update Node Properties
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. QR Pairing Modal */}
      {showQrModal && qrModalDevice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-heavy p-6 rounded-2xl max-w-sm w-full border border-sky-500/30 shadow-2xl relative text-center animate-scaleUp">

            <div className="flex justify-between items-center border-b border-sky-500/10 pb-3 mb-5">
              <h3 className="font-mono font-bold text-xs text-slate-200">Pairing scan: {qrModalDevice.name}</h3>
              <button
                onClick={() => {
                  setShowQrModal(false);
                  setQrModalDevice(null);
                }}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Canvas */}
            <div className="inline-block p-4 bg-white rounded-xl mb-4 shadow-lg border border-sky-500/20">
              <canvas ref={qrCanvasRef} className="mx-auto" />
            </div>

            <div className="space-y-4 font-mono text-xs text-left">
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Scan this code from the mobile GPS tracker application to automatically pair with the server. Or copy credentials manually below.
              </p>

              <div className="space-y-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-600 block">SERVER URL</span>
                  <span className="text-[10px] text-slate-300 font-semibold select-all">{import.meta.env.VITE_API_URL}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 block">DEVICE TOKEN</span>
                  <span className="text-[10px] text-sky-400 font-semibold select-all break-all">{qrModalDevice.token}</span>
                  <button
                    onClick={() => {
                      const link = `${window.location.origin}?share=${qrModalDevice.token}`;
                      navigator.clipboard.writeText(link).then(() => {
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      });
                    }}
                    className="mt-2 w-full bg-sky-500 hover:bg-sky-600 text-white text-xs py-1 rounded"
                  >
                    {copySuccess ? 'Link Copied!' : 'Copy Share Link'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
