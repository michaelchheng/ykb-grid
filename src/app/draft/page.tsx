'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getDraftChallenges, type DraftChallenge, type DraftPlayer } from '@/data/draft';

const ROUND_TOTAL = 8;
type Phase = 'ranking' | 'revealed' | 'done';

function scoreRanking(guess: DraftPlayer[], answer: DraftPlayer[]): number {
  // Award points for each player in correct position
  return guess.reduce((acc, p, i) => acc + (p.name === answer[i]?.name ? 1 : 0), 0);
}

function diffColor(d: DraftChallenge['difficulty']) {
  return d === 'Easy' ? '#34d399' : d === 'Medium' ? '#7dd3fc' : d === 'Hard' ? '#f97316' : '#c084fc';
}

export default function DraftOrder() {
  const [challenges, setChallenges]   = useState<DraftChallenge[]>([]);
  const [cIndex, setCIndex]           = useState(0);
  const [phase, setPhase]             = useState<Phase>('ranking');
  const [ranking, setRanking]         = useState<DraftPlayer[]>([]);
  const [remaining, setRemaining]     = useState<DraftPlayer[]>([]);
  const [totalScore, setTotalScore]   = useState(0);
  const [roundScore, setRoundScore]   = useState(0);
  const [mounted, setMounted]         = useState(false);
  const [isAdmin]                 = useState(() => typeof window !== 'undefined' && localStorage.getItem('ykb_admin') === '1');

  useEffect(() => {
    const cs = getDraftChallenges(ROUND_TOTAL);
    setChallenges(cs);
    if (cs[0]) resetForChallenge(cs[0]);
    setMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForChallenge(c: DraftChallenge) {
    // Shuffle the players so they're not shown in answer order
    const shuffled = [...c.players].sort(() => Math.random() - 0.5);
    setRemaining(shuffled);
    setRanking([]);
    setPhase('ranking');
  }

  function pickPlayer(player: DraftPlayer) {
    if (phase !== 'ranking') return;
    const newRanking  = [...ranking, player];
    const newRemaining = remaining.filter(p => p.name !== player.name);
    setRanking(newRanking);
    setRemaining(newRemaining);
    if (newRemaining.length === 0) {
      // All placed — reveal
      const c = challenges[cIndex];
      const rs = scoreRanking(newRanking, c.players);
      setRoundScore(rs);
      setTotalScore(prev => prev + rs);
      setPhase('revealed');
    }
  }

  function unpick(player: DraftPlayer) {
    if (phase !== 'ranking') return;
    setRanking(prev => prev.filter(p => p.name !== player.name));
    setRemaining(prev => [...prev, player]);
  }

  function next() {
    const nextIdx = cIndex + 1;
    if (nextIdx >= ROUND_TOTAL) {
      setPhase('done');
    } else {
      setCIndex(nextIdx);
      resetForChallenge(challenges[nextIdx]);
    }
  }

  const c = challenges[cIndex];
  const maxScore = ROUND_TOTAL * 5; // 5 players each

  if (!mounted || challenges.length === 0) return (
    <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin" />
    </div>
  );

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const pct = Math.round((totalScore / maxScore) * 100);
    return (
      <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-6">Draft Order</p>
          <p className="text-5xl font-black mb-2" style={{ color: pct >= 70 ? '#34d399' : pct >= 50 ? '#7dd3fc' : '#f87171' }}>
            {totalScore}/{maxScore}
          </p>
          <p className="text-white/40 text-sm mb-8">
            {pct >= 80 ? 'You memorized the stat sheets.' : pct >= 60 ? 'Solid knowledge.' : pct >= 40 ? 'You know the stars, not the order.' : 'The tape is calling.'}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => {
              const cs = getDraftChallenges(ROUND_TOTAL);
              setChallenges(cs);
              setCIndex(0);
              setTotalScore(0);
              setRoundScore(0);
              if (cs[0]) resetForChallenge(cs[0]);
            }}
              className="px-6 py-3 rounded-xl bg-sky-400 text-black font-black text-sm hover:bg-sky-300 transition-colors">
              Play Again
            </button>
            <Link href="/" className="px-6 py-3 rounded-xl border border-white/15 text-white/50 text-sm font-mono hover:text-white hover:border-white/30 transition-colors">
              Hub
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!c) return null;

  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
        <Link href="/" className="text-white/30 hover:text-white/60 transition-colors text-xs font-mono">← Hub</Link>
        <p className="text-[10px] font-mono text-sky-300/70 uppercase tracking-widest">Draft Order</p>
        <div className="flex items-center gap-2">
          {isAdmin && phase === 'ranking' && (
            <button onClick={() => { setRanking(c.players); setPhase('revealed'); }}
              className="text-[9px] font-mono text-sky-300/60 border border-sky-400/30 rounded px-1.5 py-0.5 hover:bg-sky-400/10 transition-colors">
              SKIP
            </button>
          )}
          <p className="text-xs font-mono text-white/30">{totalScore} pts</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-5 pt-4">
        {Array.from({ length: ROUND_TOTAL }).map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full"
            style={{ background: i < cIndex ? '#34d399' : i === cIndex ? '#38bdf8' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center px-5 py-6">
        <div className="max-w-sm w-full">
          {/* Challenge header */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
                style={{ color: diffColor(c.difficulty), border: `1px solid ${diffColor(c.difficulty)}40`, background: `${diffColor(c.difficulty)}10` }}>
                {c.difficulty}
              </span>
              <span className="text-[10px] font-mono text-white/30">{c.season}</span>
            </div>
            <p className="font-black text-lg">{c.statLabel}</p>
            <p className="text-white/35 text-xs mt-0.5 font-mono uppercase tracking-widest">{c.instruction}</p>
          </div>

          {/* User's current ranking */}
          <div className="mb-4">
            <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Your ranking</p>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const p = ranking[i];
                const answerPlayer = phase === 'revealed' ? c.players[i] : null;
                const correct = phase === 'revealed' && p?.name === c.players[i]?.name;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-xl border p-3 transition-all"
                    style={{
                      borderColor: phase === 'revealed'
                        ? (correct ? 'rgba(52,211,153,0.4)' : p ? 'rgba(248,113,113,0.4)' : 'rgba(255,255,255,0.08)')
                        : 'rgba(255,255,255,0.08)',
                      background: phase === 'revealed'
                        ? (correct ? 'rgba(52,211,153,0.06)' : p ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)')
                        : 'rgba(255,255,255,0.02)',
                    }}>
                    <span className="text-[10px] font-mono text-white/30 w-4">{i + 1}</span>
                    <div className="flex-1">
                      {p ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-sm">{p.name}</p>
                            {p.hint && <p className="text-[10px] text-white/30 font-mono">{p.hint}</p>}
                          </div>
                          {phase === 'revealed' && (
                            <div className="text-right">
                              <p className="font-black text-sm tabular-nums" style={{ color: correct ? '#34d399' : '#f87171' }}>
                                {c.players[i]?.value} {c.statUnit}
                              </p>
                              {!correct && answerPlayer && (
                                <p className="text-[10px] text-white/40 font-mono">ans: {answerPlayer.name}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-white/20 text-xs font-mono italic">click a player to place here</p>
                      )}
                    </div>
                    {p && phase === 'ranking' && (
                      <button onClick={() => unpick(p)}
                        className="text-white/20 hover:text-white/60 transition-colors text-xs ml-1">✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Remaining players to pick */}
          {phase === 'ranking' && remaining.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-white/25 uppercase tracking-widest mb-2">Available players</p>
              <div className="flex flex-wrap gap-2">
                {remaining.map(p => (
                  <button key={p.name}
                    onClick={() => pickPlayer(p)}
                    className="rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/25 transition-all px-3 py-2 text-sm font-bold">
                    {p.name}
                    {p.hint && <span className="text-white/30 text-[10px] font-mono ml-1.5">{p.hint}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Revealed state */}
          {phase === 'revealed' && (
            <div className="mt-4 text-center">
              <p className="text-sm font-black mb-1" style={{ color: roundScore === 5 ? '#34d399' : roundScore >= 3 ? '#7dd3fc' : '#f87171' }}>
                {roundScore}/5 correct positions
              </p>
              <p className="text-white/35 text-xs italic mb-4">&ldquo;{c.flavor}&rdquo;</p>
              <button onClick={next}
                className="px-8 py-3 rounded-xl bg-sky-400 text-black font-black text-sm hover:bg-sky-300 transition-colors active:scale-[0.98]">
                {cIndex + 1 >= ROUND_TOTAL ? 'See Results' : 'Next →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
