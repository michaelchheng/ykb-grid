'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { QUESTIONS, getQuestionsByDifficulty } from '@/data/questions';
import { GAUNTLET_QUESTIONS } from '@/data/gauntlet';
import { DRAFT_CHALLENGES } from '@/data/draft';

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

type Tier = 'easy' | 'medium' | 'hard' | 'niche';

interface TierSimResult {
  tier: Tier;
  compTotal: number;
  compUsed: number;
  compRemaining: number;
  gauntTotal: number;
  gauntUsed: number;
  gauntRemaining: number;
  draftTotal: number;
  draftUsed: number;
  draftRemaining: number;
  // simulate running through ALL static questions in order — how many picks before a repeat?
  repeatAfter: number | null;
}

function runSimulation(tier: Tier): TierSimResult {
  const usedRaw = typeof window !== 'undefined' ? localStorage.getItem(`ykb_used_${tier}`) : null;
  const used: Set<string> = new Set(usedRaw ? JSON.parse(usedRaw) as string[] : []);

  const compPool  = getQuestionsByDifficulty(tier);
  const gauntDiff = tier === 'easy' ? 'Easy' : tier === 'medium' ? 'Medium' : tier === 'hard' ? 'Hard' : 'Niche';
  const gauntPool = GAUNTLET_QUESTIONS.filter(q => q.difficulty === gauntDiff);
  const draftPool = DRAFT_CHALLENGES.filter(c => c.difficulty === gauntDiff);

  const compUsed  = compPool.filter(q => used.has(q.id)).length;
  const gauntUsed = gauntPool.filter(q => used.has(q.id)).length;
  const draftUsed = draftPool.filter(c => used.has(c.id)).length;

  // Simulate: pick questions one by one (no AI) until we'd hit a repeat
  // We pick exhausting comparison → gauntlet → draft in the same ratio as the game
  const simUsed = new Set<string>();
  const allStatic = [
    ...compPool.map(q => q.id),
    ...(tier !== 'easy' ? gauntPool.map(q => q.id) : []),
    ...(tier === 'niche' ? draftPool.map(c => c.id) : []),
  ];

  let picks = 0;
  let repeatAfter: number | null = null;
  // Exhaust each pool in sequence, detect when we'd start cycling
  const combined = [...allStatic];
  const localUsed = new Set<string>();
  for (const id of combined) {
    picks++;
    if (localUsed.has(id)) { repeatAfter = picks; break; }
    localUsed.add(id);
  }

  return {
    tier,
    compTotal: compPool.length,
    compUsed,
    compRemaining: compPool.length - compUsed,
    gauntTotal: gauntPool.length,
    gauntUsed,
    gauntRemaining: gauntPool.length - gauntUsed,
    draftTotal: draftPool.length,
    draftUsed,
    draftRemaining: draftPool.length - draftUsed,
    repeatAfter,
  };
}

function clearUsedForTier(tier: Tier) {
  localStorage.removeItem(`ykb_used_${tier}`);
}


export default function AdminPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'pipeline' | 'feedback' | 'sim'>('tools');
  const [simResults, setSimResults] = useState<TierSimResult[] | null>(null);
  const [simRunning, setSimRunning] = useState(false);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin-stats', {
        headers: { 'x-admin-key': 'YKB_ADMIN_2026' },
      });
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
            <p className="text-sky-300/60 text-[10px] font-mono uppercase tracking-widest mb-2">Admin Panel</p>
            <h1 className="text-2xl font-black">You Know Ball <span className="text-sky-300">Admin</span></h1>
          </div>

          {/* Status bar */}
          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 flex items-center justify-between">
            <div>
              <p className="text-sky-300 text-xs font-mono font-bold uppercase tracking-wider">Admin Mode Active</p>
              <p className="text-white/40 text-xs mt-0.5">Lockouts bypassed on all modes</p>
            </div>
            <Link href="/" className="text-sky-300 text-xs font-bold border border-sky-400/30 rounded-lg px-3 py-1.5 hover:bg-sky-400/10 transition-colors">
              Play →
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border border-white/8 bg-white/[0.03] p-1">
            {(['tools', 'pipeline', 'feedback', 'sim'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={['flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-colors', activeTab === tab ? 'bg-sky-400 text-black' : 'text-white/40 hover:text-white/70'].join(' ')}>
                {tab === 'pipeline' ? 'AI Pipeline' : tab === 'sim' ? '🧪 Sim' : tab}
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
                            <span className="text-sky-300 text-[10px] font-bold uppercase">{log.difficulty}</span>
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
                          <span className={q.accuracy >= 60 ? 'text-green-400' : q.accuracy >= 35 ? 'text-sky-300' : 'text-red-400'}>
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

          {/* Simulation tab */}
          {activeTab === 'sim' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/70 text-sm font-bold">Question Pool Simulator</p>
                    <p className="text-white/30 text-xs mt-0.5">Shows your current used-question counts from localStorage and simulates exhaustion order for all 4 tiers simultaneously.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSimRunning(true);
                      const results = (['easy','medium','hard','niche'] as const).map(runSimulation);
                      setSimResults(results);
                      setSimRunning(false);
                    }}
                    className="shrink-0 px-4 py-2 rounded-lg bg-sky-400 text-black text-xs font-black hover:bg-sky-300 transition-colors">
                    {simRunning ? 'Running…' : 'Run Simulation'}
                  </button>
                </div>
              </div>

              {simResults && (
                <div className="space-y-3">
                  {simResults.map(r => {
                    const tierColors: Record<Tier, string> = { easy: '#34d399', medium: '#38bdf8', hard: '#c084fc', niche: '#facc15' };
                    const color = tierColors[r.tier];
                    const totalPool = r.compTotal + (r.tier !== 'easy' ? r.gauntTotal : 0) + (r.tier === 'niche' ? r.draftTotal : 0);
                    const totalUsed = r.compUsed + (r.tier !== 'easy' ? r.gauntUsed : 0) + (r.tier === 'niche' ? r.draftUsed : 0);
                    const totalRemaining = totalPool - totalUsed;
                    const exhaustPct = totalPool > 0 ? Math.round((totalUsed / totalPool) * 100) : 0;
                    return (
                      <div key={r.tier} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
                        {/* Tier header */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black uppercase tracking-wide" style={{ color }}>{r.tier}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-white/30">{totalUsed}/{totalPool} used</span>
                            <button
                              onClick={() => { clearUsedForTier(r.tier); setSimResults(prev => prev ? prev.map(x => x.tier === r.tier ? runSimulation(r.tier) : x) : null); }}
                              className="text-[9px] font-mono text-red-400/60 border border-red-500/20 rounded px-1.5 py-0.5 hover:bg-red-500/10 transition-colors">
                              Clear Used
                            </button>
                          </div>
                        </div>

                        {/* Exhaust progress bar */}
                        <div>
                          <div className="flex justify-between text-[10px] font-mono text-white/30 mb-1">
                            <span>Pool exhausted</span>
                            <span>{exhaustPct}%</span>
                          </div>
                          <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${exhaustPct}%`, background: exhaustPct > 80 ? '#f87171' : exhaustPct > 50 ? '#fb923c' : color }} />
                          </div>
                        </div>

                        {/* Per-type breakdown */}
                        <div className="grid gap-2" style={{ gridTemplateColumns: r.tier === 'easy' ? '1fr' : r.tier === 'niche' ? '1fr 1fr 1fr' : '1fr 1fr' }}>
                          {/* Comparison */}
                          <div className="rounded-xl border border-white/6 bg-black/20 p-3">
                            <p className="text-[10px] font-mono text-white/30 mb-1">Comparison</p>
                            <p className="text-lg font-black" style={{ color: r.compRemaining === 0 ? '#f87171' : color }}>{r.compRemaining}</p>
                            <p className="text-[10px] text-white/25">{r.compUsed} used / {r.compTotal} total</p>
                          </div>
                          {/* Gauntlet (medium/hard/niche) */}
                          {r.tier !== 'easy' && (
                            <div className="rounded-xl border border-white/6 bg-black/20 p-3">
                              <p className="text-[10px] font-mono text-white/30 mb-1">Gauntlet</p>
                              <p className="text-lg font-black" style={{ color: r.gauntRemaining === 0 ? '#f87171' : color }}>{r.gauntRemaining}</p>
                              <p className="text-[10px] text-white/25">{r.gauntUsed} used / {r.gauntTotal} total</p>
                            </div>
                          )}
                          {/* Draft (niche only) */}
                          {r.tier === 'niche' && (
                            <div className="rounded-xl border border-white/6 bg-black/20 p-3">
                              <p className="text-[10px] font-mono text-white/30 mb-1">Draft</p>
                              <p className="text-lg font-black" style={{ color: r.draftRemaining === 0 ? '#f87171' : color }}>{r.draftRemaining}</p>
                              <p className="text-[10px] text-white/25">{r.draftUsed} used / {r.draftTotal} total</p>
                            </div>
                          )}
                        </div>

                        {/* Repeat analysis */}
                        <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2.5 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-white/35">Static questions before any repeat</span>
                          <span className="text-sm font-black" style={{ color: totalRemaining === 0 ? '#f87171' : color }}>
                            {totalRemaining === 0 ? '⚠️ Pool empty — auto-reset active' : `${totalRemaining} remaining`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-xl border border-white/6 bg-black/20 px-4 py-3">
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">How repeats were fixed</p>
                    <p className="text-white/40 text-xs leading-relaxed">
                      Previously, when the static pool ran out, the game silently fell back to the full pool — causing repeats.
                      Now, when a pool exhausts, the used-ID set for that question type is automatically wiped and the pool resets cleanly.
                      AI-generated questions always take priority and are never tracked as &ldquo;used&rdquo; in the static pool.
                    </p>
                  </div>
                </div>
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
            className="w-full bg-white/[0.04] border border-white/12 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-sky-400/40 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-white/[0.04] border border-white/12 rounded-xl px-4 py-3.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-sky-400/40 transition-colors"
          />
          {error && <p className="text-red-400 text-xs font-mono px-1">{error}</p>}
          <button type="submit"
            className="w-full py-3.5 rounded-xl bg-sky-400 text-black text-sm font-black hover:bg-sky-300 transition-colors active:scale-[0.99]">
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

