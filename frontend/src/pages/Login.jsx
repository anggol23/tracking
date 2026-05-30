import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Shield, Key, Radio, AlertCircle } from 'lucide-react';

export default function Login() {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username || !password) {
      setError('Please fill in all credentials.');
      setLoading(false);
      return;
    }

    try {
      if (isRegistering) {
        await register(username, password, email, role);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#040712] cyber-bg px-4 overflow-hidden">
      
      {/* Background Neon Glow Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-sky-500/10 rounded-2xl text-sky-400 border border-sky-500/30 shadow-[0_0_20px_rgba(56,189,248,0.25)] mb-4">
            <Radio className="w-8 h-8 pulse-radar-cyan" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-widest font-mono text-slate-100 uppercase glow-text-cyan">
            AEGIS MONITORING
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-wider mt-2 uppercase">
            Fleet Telemetry & Security Stream Core
          </p>
        </div>

        {/* Login Panel */}
        <div className="glass-panel-heavy p-8 rounded-2xl shadow-2xl relative border border-sky-500/20">
          
          {/* Card Border Glow */}
          <div className="absolute -inset-px bg-gradient-to-r from-sky-500/20 to-indigo-500/20 rounded-2xl pointer-events-none -z-10 blur-sm"></div>

          <h2 className="text-xl font-bold font-mono text-slate-200 mb-6 border-b border-sky-500/10 pb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-sky-400" />
            {isRegistering ? 'INITIALIZE USER' : 'CORE AUTHORIZATION'}
          </h2>

          {error && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                Identitas (Username)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: admin"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all font-mono"
                required
              />
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Surel (Email)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex: admin@aegis.com"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between items-center">
                <span>Kata Sandi (Password)</span>
                {!isRegistering && (
                  <span className="text-[10px] text-slate-600 cursor-not-allowed hover:text-sky-500/40">
                    Lupa Sandi?
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all font-mono"
                  required
                />
                <Key className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-600 pointer-events-none" />
              </div>
            </div>

            {isRegistering && (
              <div>
                <label className="block text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Peran Akses (Role)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition-all font-mono cursor-pointer"
                >
                  <option value="user">Operator (User)</option>
                  <option value="admin">Administrator (Admin)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold font-mono text-sm py-3 px-4 rounded-xl border border-sky-400/20 hover:border-sky-400/40 transition-all duration-200 shadow-[0_0_15px_rgba(56,189,248,0.2)] hover:shadow-[0_0_25px_rgba(56,189,248,0.4)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Processing...
                </div>
              ) : isRegistering ? (
                'Daftar Baru'
              ) : (
                'Masuk Sistem'
              )}
            </button>
          </form>

          <div className="mt-6 text-center border-t border-sky-500/10 pt-4">
            <button
              onClick={() => {
                setError('');
                setIsRegistering(!isRegistering);
              }}
              className="text-xs font-mono text-slate-400 hover:text-sky-400 transition-colors cursor-pointer"
            >
              {isRegistering ? 'Sudah terdaftar? Silakan Masuk' : 'Belum memiliki akun? Daftar Sekarang'}
            </button>
          </div>
        </div>

        {/* Demo Credentials Alert */}
        <div className="mt-4 text-center">
          <p className="text-[10px] font-mono text-slate-600">
            DEMO ACCESS: <span className="text-sky-500/60 font-semibold">admin</span> / <span className="text-sky-500/60 font-semibold">admin123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
