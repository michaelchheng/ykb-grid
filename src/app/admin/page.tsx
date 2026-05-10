'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem('ykb_admin') === '1') setIsAdmin(true);
    // Support bypass key in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'YKB_ADMIN_2026') {
      localStorage.setItem('ykb_admin', '1');
      setIsAdmin(true);
    }
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      localStorage.setItem('ykb_admin', '1');
      setIsAdmin(true);
      setError('');
    } else {
      setError('Invalid credentials.');
    }
  }

  function handleLogout() {
    localStorage.removeItem('ykb_admin');
    // also clear all lockouts for testing
    setIsAdmin(false);
  }

  function clearAllLockouts() {
    const today = new Date().toISOString().split('T')[0];
    ['easy', 'medium', 'hard', 'niche'].forEach(t => {
      const v = localStorage.getItem(`ykb_lockout_${t}`);
      if (v === today) localStorage.removeItem(`ykb_lockout_${t}`);
      localStorage.removeItem(`ykb_sc_lockout_${t}`);
    });
    alert('All lockouts cleared!');
  }

  function clearAllStreaks() {
    ['easy', 'medium', 'hard', 'niche'].forEach(t => {
      localStorage.removeItem(`ykb_today_${t}`);
      localStorage.removeItem(`ykb_best_${t}`);
      localStorage.removeItem(`ykb_sc_streak_${t}`);
      localStorage.removeItem(`ykb_sc_best_${t}`);
    });
    alert('All streaks reset!');
  }

  if (!mounted) return null;

  // ── LOGGED IN ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#08080d] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <p className="text-yellow-400/60 text-[10px] font-mono uppercase tracking-widest mb-2">Admin Panel</p>
            <h1 className="text-2xl font-black">You Know Ball <span className="text-yellow-400">Admin</span></h1>
          </div>

          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-5 space-y-3">
            <p className="text-yellow-400 text-xs font-mono font-bold uppercase tracking-wider">✓ Admin Mode Active</p>
            <p className="text-white/50 text-sm">Lockouts bypassed. Skip buttons enabled on all game modes.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Bypass Key</p>
            <div className="rounded-lg border border-white/8 bg-black/40 px-4 py-3 font-mono text-sm text-white/70 break-all">
              ?admin=YKB_ADMIN_2026
            </div>
            <p className="text-white/30 text-xs">Add to any URL to enable admin mode without logging in.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
            <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Tools</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={clearAllLockouts}
                className="py-2.5 rounded-lg border border-orange-500/30 bg-orange-500/8 text-orange-400 text-xs font-bold hover:bg-orange-500/15 transition-colors">
                Clear All Lockouts
              </button>
              <button onClick={clearAllStreaks}
                className="py-2.5 rounded-lg border border-white/10 text-white/50 text-xs font-bold hover:bg-white/5 transition-colors">
                Reset All Streaks
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Link href="/"
              className="py-3 rounded-xl border border-yellow-400/30 bg-yellow-400/10 text-yellow-400 text-sm font-bold text-center hover:bg-yellow-400/20 transition-colors">
              Go Play →
            </Link>

          </div>

          <button onClick={handleLogout}
            className="w-full py-2.5 text-white/20 hover:text-white/50 text-xs font-mono transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // ── LOGIN FORM ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08080d] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link href="/" className="text-white/20 text-xs font-mono hover:text-white/50 transition-colors block mb-8">← back</Link>
          <p className="text-white/30 text-[10px] font-mono uppercase tracking-widest mb-2">Restricted</p>
          <h1 className="text-2xl font-black">Admin Login</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full bg-white/[0.04] border border-white/12 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-yellow-400/40 focus:bg-white/[0.06] transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-white/[0.04] border border-white/12 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-yellow-400/40 focus:bg-white/[0.06] transition-colors"
          />
          {error && <p className="text-red-400 text-xs font-mono px-1">{error}</p>}
          <button type="submit"
            className="w-full py-3.5 rounded-xl bg-yellow-400 text-black text-sm font-black hover:bg-yellow-300 transition-colors active:scale-[0.99]">
            Sign In
          </button>
        </form>

        <div className="text-center">
          <p className="text-white/15 text-xs font-mono">or use bypass key in URL</p>
        </div>
      </div>
    </div>
  );
}
