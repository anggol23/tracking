import React from 'react';
import { 
  LayoutDashboard, 
  Map, 
  Video, 
  Cpu, 
  History, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Sidebar({ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen }) {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', name: 'Live Map', icon: Map },
    { id: 'camera', name: 'Camera Monitor', icon: Video },
    { id: 'devices', name: 'Devices', icon: Cpu },
    { id: 'history', name: 'History Replay', icon: History },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`glass-panel-heavy fixed top-0 left-0 z-40 h-screen transition-all duration-300 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sky-500/20">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400 border border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
            <Radio className="w-5 h-5 pulse-radar-cyan" />
          </div>
          {sidebarOpen && (
            <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent uppercase font-mono">
              Aegis Fleet
            </span>
          )}
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1 rounded-md text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors border border-transparent hover:border-sky-500/20 hidden md:block"
        >
          {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-mono text-sm tracking-wide transition-all duration-200 group relative ${
                isActive
                  ? 'bg-sky-500/15 text-sky-400 border-l-4 border-sky-400 shadow-[inset_0_0_15px_rgba(56,189,248,0.1),0_0_10px_rgba(56,189,248,0.05)] font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/35 border-l-4 border-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]' : 'text-slate-400 group-hover:text-slate-200'}`} />
              
              {sidebarOpen && <span>{item.name}</span>}

              {/* Tooltip for collapsed sidebar */}
              {!sidebarOpen && (
                <div className="absolute left-24 bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-md text-xs font-mono opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-xl whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile & Logout */}
      <div className="p-3 border-t border-sky-500/20">
        {sidebarOpen && (
          <div className="glass-panel-light p-3 rounded-xl mb-3 flex items-center gap-3 overflow-hidden border border-slate-800">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-slate-100 border border-indigo-400/30">
              {user?.username?.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-sm font-semibold truncate text-slate-200">{user?.username}</h4>
              <span className="text-[10px] font-mono text-sky-400 uppercase tracking-widest bg-sky-950/40 px-2 py-0.5 rounded border border-sky-800/30">
                {user?.role}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-mono text-sm tracking-wide text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 border-l-4 border-transparent hover:border-rose-500/30 transition-all duration-200 group relative`}
        >
          <LogOut className="w-5 h-5 text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]" />
          {sidebarOpen && <span>Logout</span>}

          {!sidebarOpen && (
            <div className="absolute left-24 bg-slate-900 border border-rose-900/50 text-rose-200 px-3 py-1.5 rounded-md text-xs font-mono opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 shadow-xl whitespace-nowrap z-50">
              Logout
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
