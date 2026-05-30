import React, { useState } from 'react';
import { Bell, Wifi, WifiOff, ShieldAlert, Check, Menu } from 'lucide-react';
import { useRealtimeData } from '../context/RealtimeDataContext.jsx';

export default function Navbar({ currentPageName, sidebarOpen, setSidebarOpen }) {
  const { isConnected, alerts, dismissAllAlerts } = useRealtimeData();
  const [notificationOpen, setNotificationOpen] = useState(false);

  return (
    <header className="glass-panel sticky top-0 z-30 h-16 w-full flex items-center justify-between px-6 border-b border-sky-500/10">
      
      {/* Page Title & Hamburger Menu for mobile */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 rounded-md text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 md:hidden"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold tracking-wider font-mono text-slate-200 capitalize drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">
          {currentPageName}
        </h2>
      </div>

      {/* Right Navbar Panel */}
      <div className="flex items-center gap-6">
        
        {/* Real-time Status Indicator */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-xs font-mono">
          <div className="relative flex h-2.5 w-2.5">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </>
            )}
          </div>
          <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
            {isConnected ? 'LIVE SYNCED' : 'SERVER DISCONNECTED'}
          </span>
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-rose-400" />
          )}
        </div>

        {/* Notifications Icon and Dropdown */}
        <div className="relative">
          <button
            onClick={() => setNotificationOpen(!notificationOpen)}
            className="relative p-2 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/20 transition-all cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white border border-slate-900 shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                {alerts.length}
              </span>
            )}
          </button>

          {/* Notification List Dropdown */}
          {notificationOpen && (
            <div className="glass-panel-heavy absolute right-0 mt-3 w-80 rounded-xl shadow-2xl py-3 border border-sky-500/20 text-sm overflow-hidden z-50 animate-fadeIn">
              <div className="flex items-center justify-between px-4 pb-2 border-b border-sky-500/10">
                <span className="font-bold font-mono text-slate-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Security Log
                </span>
                {alerts.length > 0 && (
                  <button
                    onClick={dismissAllAlerts}
                    className="text-[11px] font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Clear Logs
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto mt-2 px-1">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 font-mono text-xs">
                    No active warnings detected.
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id || alert.timestamp}
                      className="p-3 rounded-lg hover:bg-slate-800/40 border-b border-slate-900 last:border-0 flex flex-col gap-1 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold text-rose-400 bg-rose-950/30 px-1.5 py-0.5 rounded border border-rose-900/30 uppercase">
                          {alert.type?.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono">{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
