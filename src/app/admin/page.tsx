'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

type Tier = 'easy' | 'medium' | 'hard' | 'niche';

// ── Mock Simulator ───────────────────────────────────────────────────────────
const MOCK_PLAYERS = [
  'LeBron James', 'Kevin Durant', 'Stephen Curry', 'Giannis Antetokounmpo',
  'Nikola Jokic', 'Joel Embiid', 'Luka Doncic', 'Jayson Tatum',
  'Damian Lillard', 'Anthony Davis', 'Kawhi Leonard', 'Paul George',
  'Jimmy Butler', 'Devin Booker', 'Donovan Mitchell', 'Ja Morant',
  'Zion Williamson', 'Trae Young', 'De\'Aaron Fox', 'Tyrese Haliburton',
  'Kobe Bryant', 'Dwyane Wade', 'Dirk Nowitzki', 'Allen Iverson',
  'Shaquille O\'Neal', 'Tim Duncan', 'Chris Paul', 'Carmelo Anthony',
  'Dwight Howard', 'Paul Pierce', 'Tracy McGrady', 'Vince Carter',
];
const MOCK_STATS = ['PPG', 'APG', 'RPG', 'SPG', 'BPG', 'FG%', '3P%', 'PER'];
const MOCK_GAUNTLET_PLAYERS = [
  'Bob Cousy', 'Wilt Chamberlain', 'Oscar Robertson', 'Jerry West',
  'Elgin Baylor', 'Willis Reed', 'Dave Cowens', 'Nate Archibald',
  'Moses Malone', 'George Gervin', 'Julius Erving', 'Bernard King',
];

type SimEventType = 'prewarm' | 'serve' | 'dedup-drop' | 'refill-trigger' | 'refill-done' | 'wait' | 'wait-resolved';
interface SimEvent {
  round: number;
  type: SimEventType;
  msg: string;
  bufferComp: number;
  bufferGaunt: number;
  bufferDraft: number;
  flag?: 'ok' | 'warn' | 'drop' | 'refill' | 'wait';
}

function mockMatchupKey(a: string, b: string) { return `${a}|${b}`; }

async function runMockSim(
  tier: Tier,
  rounds: number,
  speedMs: number,
  onEvent: (e: SimEvent) => void,
  cancelRef: React.MutableRefObject<boolean>
) {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const seen = new Set<string>();

  // Helper: generate a fake batch
  function genBatch(count: number, type: 'comp' | 'gaunt' | 'draft'): string[] {
    const pool = type === 'gaunt' ? MOCK_GAUNTLET_PLAYERS : MOCK_PLAYERS;
    const items: string[] = [];
    const tries = count * 4;
    for (let i = 0; i < tries && items.length < count; i++) {
      if (type === 'comp') {
        const a = pool[Math.floor(Math.random() * pool.length)];
        const b = pool[Math.floor(Math.random() * pool.length)];
        if (a === b) continue;
        items.push(`${a} vs ${b}`);
      } else if (type === 'gaunt') {
        items.push(pool[Math.floor(Math.random() * pool.length)]);
      } else {
        items.push(`Draft: ${MOCK_PLAYERS.slice(0,5).sort(() => Math.random()-0.5).join(', ')}`);
      }
    }
    return items.slice(0, count);
  }

  // Buffers
  let compBuf: string[] = [];
  let gauntBuf: string[] = [];
  let draftBuf: string[] = [];

  // Pre-warm
  const rawComp  = genBatch(8, 'comp');
  const rawGaunt = tier !== 'easy' ? genBatch(12, 'gaunt') : [];
  const rawDraft = tier === 'niche' ? genBatch(1, 'draft') : [];

  // Dedup filter on pre-warm
  let dropped = 0;
  for (const q of rawComp) {
    const k = mockMatchupKey(...(q.split(' vs ') as [string, string]));
    if (seen.has(k)) { dropped++; continue; }
    seen.add(k); seen.add(mockMatchupKey(...(q.split(' vs ').reverse() as [string, string])));
    compBuf.push(q);
  }
  gauntBuf = rawGaunt;
  draftBuf = rawDraft;

  onEvent({ round: 0, type: 'prewarm', msg: `Pre-warm complete: ${compBuf.length} comp (+${dropped} deduped), ${gauntBuf.length} gauntlet, ${draftBuf.length} draft`, bufferComp: compBuf.length, bufferGaunt: gauntBuf.length, bufferDraft: draftBuf.length, flag: 'ok' });
  await sleep(speedMs);
  if (cancelRef.current) return;

  for (let round = 1; round <= rounds; round++) {
    if (cancelRef.current) return;

    // Pick type
    let qType: 'comp' | 'gaunt' | 'draft';
    if (tier === 'easy') qType = 'comp';
    else if (tier === 'medium' || tier === 'hard') qType = Math.random() < 0.5 ? 'comp' : 'gaunt';
    else { const r = Math.random(); qType = r < 0.20 ? 'draft' : r < 0.60 ? 'gaunt' : 'comp'; }

    const buf = qType === 'comp' ? compBuf : qType === 'gaunt' ? gauntBuf : draftBuf;

    if (buf.length === 0) {
      // Wait state
      onEvent({ round, type: 'wait', msg: `Round ${round}: Buffer empty (${qType}) — waiting for AI generation…`, bufferComp: compBuf.length, bufferGaunt: gauntBuf.length, bufferDraft: draftBuf.length, flag: 'wait' });
      await sleep(speedMs * 2);
      if (cancelRef.current) return;
      // Simulate refill arriving
      const refilled = genBatch(qType === 'comp' ? 8 : qType === 'gaunt' ? 12 : 1, qType);
      let refDropped = 0;
      if (qType === 'comp') {
        for (const q of refilled) {
          const parts = q.split(' vs ');
          const k = mockMatchupKey(parts[0], parts[1]);
          if (seen.has(k)) { refDropped++; continue; }
          seen.add(k); seen.add(mockMatchupKey(parts[1], parts[0]));
          compBuf.push(q);
        }
      } else if (qType === 'gaunt') {
        gauntBuf.push(...refilled);
      } else {
        draftBuf.push(...refilled);
      }
      onEvent({ round, type: 'wait-resolved', msg: `Round ${round}: Generation done — ${refilled.length - refDropped} new ${qType} questions added (${refDropped} dupes dropped), auto-advancing`, bufferComp: compBuf.length, bufferGaunt: gauntBuf.length, bufferDraft: draftBuf.length, flag: 'ok' });
      await sleep(speedMs);
      if (cancelRef.current) return;
    }

    // Serve from buffer
    const served = qType === 'comp' ? compBuf.shift()! : qType === 'gaunt' ? gauntBuf.shift()! : draftBuf.shift()!;
    if (!served) continue;
    const stat = MOCK_STATS[Math.floor(Math.random() * MOCK_STATS.length)];
    const label = qType === 'comp' ? `${served} · ${stat}` : qType === 'gaunt' ? `Gauntlet: ${served}` : served;
    onEvent({ round, type: 'serve', msg: `Round ${round}: Served [${qType.toUpperCase()}] ${label}`, bufferComp: compBuf.length, bufferGaunt: gauntBuf.length, bufferDraft: draftBuf.length, flag: 'ok' });
    await sleep(speedMs * 0.6);
    if (cancelRef.current) return;

    // Check refill threshold
    const needsCompRefill  = compBuf.length < 3;
    const needsGauntRefill = gauntBuf.length < 6 && tier !== 'easy';
    const needsDraftRefill = draftBuf.length < 3 && tier === 'niche';

    if (needsCompRefill || needsGauntRefill || needsDraftRefill) {
      const which = [needsCompRefill && 'comp', needsGauntRefill && 'gaunt', needsDraftRefill && 'draft'].filter(Boolean).join('+');
      onEvent({ round, type: 'refill-trigger', msg: `Round ${round}: ⚡ Refill triggered (${which} below threshold)`, bufferComp: compBuf.length, bufferGaunt: gauntBuf.length, bufferDraft: draftBuf.length, flag: 'refill' });
      await sleep(speedMs);
      if (cancelRef.current) return;

      // Simulate refill arriving after some rounds
      if (needsCompRefill) {
        const refilled = genBatch(8, 'comp');
        let refDropped = 0;
        for (const q of refilled) {
          const parts = q.split(' vs ');
          const k = mockMatchupKey(parts[0], parts[1]);
          if (seen.has(k)) { refDropped++; continue; }
          seen.add(k); seen.add(mockMatchupKey(parts[1], parts[0]));
          compBuf.push(q);
        }
        if (refDropped > 0) {
          onEvent({ round, type: 'dedup-drop', msg: `Round ${round}: 🚫 Dedup — ${refDropped} comp matchup(s) already seen this session, dropped`, bufferComp: compBuf.length, bufferGaunt: gauntBuf.length, bufferDraft: draftBuf.length, flag: 'drop' });
          await sleep(speedMs * 0.5);
          if (cancelRef.current) return;
        }
      }
      if (needsGauntRefill) gauntBuf.push(...genBatch(12, 'gaunt'));
      if (needsDraftRefill) draftBuf.push(...genBatch(1, 'draft'));

      onEvent({ round, type: 'refill-done', msg: `Round ${round}: ✓ Refill done — comp:${compBuf.length} gaunt:${gauntBuf.length} draft:${draftBuf.length}`, bufferComp: compBuf.length, bufferGaunt: gauntBuf.length, bufferDraft: draftBuf.length, flag: 'ok' });
      await sleep(speedMs * 0.4);
    }
  }
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
  const [simTier, setSimTier]           = useState<Tier>('easy');
  const [simRounds, setSimRounds]       = useState(20);
  const [simSpeed, setSimSpeed]         = useState(300);
  const [simRunning, setSimRunning]     = useState(false);
  const [simEvents, setSimEvents]       = useState<SimEvent[]>([]);
  const simCancel                       = useRef(false);
  const simLogRef                       = useRef<HTMLDivElement>(null);

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
              {/* Controls */}
              <div className="rounded-2xl border border-white/10 bg-white/3 p-4 space-y-4">
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Mock Pipeline Simulator</p>
                <p className="text-white/30 text-xs">Runs the full generation loop with fake NBA data — no API calls, no tokens burned. Shows buffer fills, dedup drops, refill triggers, and wait states in real time.</p>

                <div className="grid grid-cols-3 gap-3">
                  {/* Tier */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-white/25">TIER</p>
                    <select value={simTier} onChange={e => setSimTier(e.target.value as Tier)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-mono outline-none">
                      {(['easy','medium','hard','niche'] as Tier[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {/* Rounds */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-white/25">ROUNDS</p>
                    <select value={simRounds} onChange={e => setSimRounds(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-mono outline-none">
                      {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {/* Speed */}
                  <div className="space-y-1">
                    <p className="text-[10px] font-mono text-white/25">SPEED</p>
                    <select value={simSpeed} onChange={e => setSimSpeed(Number(e.target.value))}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs font-mono outline-none">
                      <option value={600}>Slow</option>
                      <option value={300}>Normal</option>
                      <option value={80}>Fast</option>
                      <option value={10}>Instant</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={simRunning}
                    onClick={() => {
                      simCancel.current = false;
                      setSimEvents([]);
                      setSimRunning(true);
                      runMockSim(simTier, simRounds, simSpeed, (e) => {
                        setSimEvents(prev => [...prev, e]);
                        setTimeout(() => simLogRef.current?.scrollTo({ top: simLogRef.current.scrollHeight, behavior: 'smooth' }), 30);
                      }, simCancel).finally(() => setSimRunning(false));
                    }}
                    className="flex-1 py-2 rounded-lg bg-sky-400 text-black text-xs font-black hover:bg-sky-300 disabled:opacity-40 transition-colors">
                    {simRunning ? 'Running…' : '▶ Run Simulation'}
                  </button>
                  {simRunning && (
                    <button onClick={() => { simCancel.current = true; }}
                      className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors">
                      Stop
                    </button>
                  )}
                  {!simRunning && simEvents.length > 0 && (
                    <button onClick={() => setSimEvents([])}
                      className="px-4 py-2 rounded-lg border border-white/10 text-white/30 text-xs font-mono hover:bg-white/5 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Live buffer gauges */}
              {simEvents.length > 0 && (() => {
                const last = simEvents[simEvents.length - 1];
                const tierColors: Record<Tier, string> = { easy: '#34d399', medium: '#38bdf8', hard: '#c084fc', niche: '#facc15' };
                const color = tierColors[simTier];
                return (
                  <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
                    <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest">Live Buffer State — Round {simEvents.filter(e => e.type === 'serve').length}/{simRounds}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[{ label: 'Comparison', val: last.bufferComp, max: 10, warn: 3 },
                        { label: 'Gauntlet',   val: last.bufferGaunt, max: 14, warn: 6 },
                        { label: 'Draft',      val: last.bufferDraft, max: 4,  warn: 3 }]
                        .map(g => (
                          <div key={g.label} className="rounded-xl border border-white/6 bg-black/20 p-3">
                            <p className="text-[10px] font-mono text-white/30 mb-1">{g.label}</p>
                            <p className="text-xl font-black" style={{ color: g.val <= g.warn ? '#f87171' : color }}>{g.val}</p>
                            <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, (g.val / g.max) * 100)}%`, background: g.val <= g.warn ? '#f87171' : color }} />
                            </div>
                          </div>
                        ))}
                    </div>
                    {/* Summary counts */}
                    {(() => {
                      const served  = simEvents.filter(e => e.type === 'serve').length;
                      const dropped = simEvents.filter(e => e.type === 'dedup-drop').length;
                      const waits   = simEvents.filter(e => e.type === 'wait').length;
                      const refills = simEvents.filter(e => e.type === 'refill-trigger').length;
                      return (
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {[{ label: 'Served', val: served, color: '#34d399' },
                            { label: 'Dedup Drops', val: dropped, color: '#f97316' },
                            { label: 'Waits', val: waits, color: '#f87171' },
                            { label: 'Refills', val: refills, color: '#38bdf8' }]
                            .map(s => (
                              <div key={s.label} className="text-center">
                                <p className="text-sm font-black" style={{ color: s.color }}>{s.val}</p>
                                <p className="text-[9px] font-mono text-white/25">{s.label}</p>
                              </div>
                            ))}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {/* Event log */}
              {simEvents.length > 0 && (
                <div ref={simLogRef} className="rounded-2xl border border-white/8 bg-black/30 p-3 h-72 overflow-y-auto space-y-1 font-mono">
                  {simEvents.map((e, i) => {
                    const colors: Record<string, string> = {
                      ok: 'text-white/50', warn: 'text-yellow-400/70', drop: 'text-orange-400',
                      refill: 'text-sky-400', wait: 'text-red-400',
                    };
                    const icons: Record<SimEventType, string> = {
                      prewarm: '🔥', serve: '▶', 'dedup-drop': '🚫', 'refill-trigger': '⚡',
                      'refill-done': '✓', wait: '⏳', 'wait-resolved': '✅',
                    };
                    return (
                      <div key={i} className={['text-[10px] flex gap-2', colors[e.flag ?? 'ok']].join(' ')}>
                        <span className="shrink-0">{icons[e.type]}</span>
                        <span className="leading-relaxed">{e.msg}</span>
                      </div>
                    );
                  })}
                  {simRunning && <div className="text-[10px] text-white/20 animate-pulse">● generating…</div>}
                  {!simRunning && simEvents.length > 0 && <div className="text-[10px] text-white/20 pt-1">── simulation complete ──</div>}
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

