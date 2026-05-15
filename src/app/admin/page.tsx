'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface AgentTiming { agentName: string; durationMs: number; tokens?: { totalTokens: number; estimatedCostUsd: number } }
interface PipelineLog {
  requestId: string; timestamp: string; difficulty: string;
  questionsGenerated: number; qcRejections: number; totalCostUsd: number;
  agentTimings: AgentTiming[];
}
interface QuestionStat {
  id: string; answer: string; accuracy: number; total: number;
  avgTimeMs: number; difficulty: string; identifiabilityScore: number;
}
interface AdminStats {
  logs: PipelineLog[];
  feedbackSummary: { totalAnswers: number; overallAccuracy: number; avgTimeMs: number };
  questionStats: QuestionStat[];
  costSummary: { totalCostUsd: number; totalQcRejections: number; pipelineRuns: number };
}

export default function AdminPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'pipeline' | 'feedback'>('tools');

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin-stats?key=YKB_ADMIN_2026');
      if (res.ok) setStats(await res.json());
    } catch { /* ignore */ }
    setStatsLoading(false);
  }, []);

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem('ykb_admin') === '1') setIsAdmin(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'YKB_ADMIN_2026') {
      localStorage.setItem('ykb_admin', '1');
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchStats();
  }, [isAdmin, fetchStats]);

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

  if (isAdmin) {
    return (
      <div className="min-h-screen bg-[#08080d] text-white px-4 py-10">
        <div className="w-full max-w-2xl mx-auto space-y-6">

          {/* Header */}
          <div className="text-center">
            <p className="text-yellow-400/60 text-[10px] font-mono uppercase tracking-widest mb-2">Admin Panel</p>
            <h1 className="text-2xl font-black">You Know Ball <span className="text-yellow-400">Admin</span></h1>
          </div>

          {/* Status bar */}
          <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-xs font-mono font-bold uppercase tracking-wider">Admin Mode Active</p>
              <p className="text-white/40 text-xs mt-0.5">Lockouts bypassed on all modes</p>
            </div>
            <Link href="/" className="text-yellow-400 text-xs font-bold border border-yellow-400/30 rounded-lg px-3 py-1.5 hover:bg-yellow-400/10 transition-colors">
              Play →
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border border-white/8 bg-white/[0.03] p-1">
            {(['tools', 'pipeline', 'feedback'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={['flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-colors', activeTab === tab ? 'bg-yellow-400 text-black' : 'text-white/40 hover:text-white/70'].join(' ')}>
                {tab === 'pipeline' ? 'AI Pipeline' : tab}
              </button>
            ))}
          </div>

          {/* Tools tab */}
          {activeTab === 'tools' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Bypass Key</p>
                <div className="rounded-lg border border-white/8 bg-black/40 px-4 py-3 font-mono text-sm text-white/70 break-all">
                  ?admin=YKB_ADMIN_2026
                </div>
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
            </div>
          )}

          {/* Pipeline tab */}
          {activeTab === 'pipeline' && (
            <div className="space-y-4">
              {statsLoading && <p className="text-white/30 text-xs text-center py-8 font-mono">Loading...</p>}
              {!statsLoading && stats && (
                <>
                  {/* Cost summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Pipeline Runs', value: stats.costSummary.pipelineRuns },
                      { label: 'Total Cost', value: `$${stats.costSummary.totalCostUsd}` },
                      { label: 'QC Rejections', value: stats.costSummary.totalQcRejections },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
                        <p className="text-white text-lg font-black">{s.value}</p>
                        <p className="text-white/30 text-[10px] font-mono mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recent pipeline runs */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-white/40 text-xs font-mono uppercase tracking-wider">Recent Runs</p>
                      <button onClick={fetchStats} className="text-white/30 text-[10px] font-mono hover:text-white/60 transition-colors">Refresh</button>
                    </div>
                    {stats.logs.length === 0 && <p className="text-white/20 text-xs text-center py-4">No runs yet</p>}
                    {stats.logs.map((log, i) => (
                      <div key={i} className="rounded-xl border border-white/6 bg-black/20 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/70 text-xs font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                          <div className="flex gap-2">
                            <span className="text-yellow-400 text-[10px] font-bold uppercase">{log.difficulty}</span>
                            <span className="text-white/40 text-[10px] font-mono">${log.totalCostUsd?.toFixed(4)}</span>
                          </div>
                        </div>
                        <div className="flex gap-3 text-[10px] font-mono text-white/40">
                          <span>{log.questionsGenerated} questions</span>
                          <span>{log.qcRejections} rejected</span>
                          <span>{log.agentTimings?.length ?? 0} agent calls</span>
                        </div>
                        {log.agentTimings?.length > 0 && (
                          <div className="space-y-1">
                            {log.agentTimings.map((t, j) => (
                              <div key={j} className="flex items-center justify-between text-[10px]">
                                <span className="text-white/30 font-mono truncate max-w-[55%]">{t.agentName}</span>
                                <div className="flex gap-2 text-white/25 font-mono">
                                  <span>{t.durationMs}ms</span>
                                  {t.tokens && <span>{t.tokens.totalTokens} tok</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Feedback tab */}
          {activeTab === 'feedback' && (
            <div className="space-y-4">
              {statsLoading && <p className="text-white/30 text-xs text-center py-8 font-mono">Loading...</p>}
              {!statsLoading && stats && (
                <>
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Answers', value: stats.feedbackSummary.totalAnswers },
                      { label: 'Accuracy', value: `${stats.feedbackSummary.overallAccuracy}%` },
                      { label: 'Avg Time', value: `${(stats.feedbackSummary.avgTimeMs / 1000).toFixed(1)}s` },
                    ].map(s => (
                      <div key={s.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
                        <p className="text-white text-lg font-black">{s.value}</p>
                        <p className="text-white/30 text-[10px] font-mono mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Per-question breakdown */}
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                    <p className="text-white/40 text-xs font-mono uppercase tracking-wider mb-3">Top Questions by Volume</p>
                    {stats.questionStats.length === 0 && <p className="text-white/20 text-xs text-center py-4">No feedback yet</p>}
                    {stats.questionStats.map((q, i) => (
                      <div key={i} className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-white/80 text-xs font-bold truncate">{q.answer}</p>
                          <p className="text-white/25 text-[10px] font-mono">{q.difficulty} · score {q.identifiabilityScore}</p>
                        </div>
                        <div className="flex gap-3 text-[10px] font-mono shrink-0">
                          <span className={q.accuracy >= 60 ? 'text-green-400' : q.accuracy >= 35 ? 'text-yellow-400' : 'text-red-400'}>
                            {q.accuracy}%
                          </span>
                          <span className="text-white/30">{q.total} plays</span>
                          <span className="text-white/25">{(q.avgTimeMs / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

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
            className="w-full bg-white/[0.04] border border-white/12 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-yellow-400/40 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-white/[0.04] border border-white/12 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-yellow-400/40 transition-colors"
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

