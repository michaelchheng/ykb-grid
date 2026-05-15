'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getGauntletQuestions, type GauntletQuestion } from '@/data/gauntlet';

const ROUND_TOTAL = 10;

type Phase = 'playing' | 'answered' | 'done';

function StatBadge({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="flex flex-col items-center">
      <p className="text-2xl font-black tabular-nums">{value.toFixed(1)}{unit ?? ''}</p>
      <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  );
}

export default function Gauntlet() {
  const [phase, setPhase]     = useState<Phase>('playing');
  const [questions, setQuestions] = useState<GauntletQuestion[]>([]);
  const [qIndex, setQIndex]   = useState(0);
  const [score, setScore]     = useState(0);
  const [picked, setPicked]   = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isAdmin]         = useState(() => typeof window !== 'undefined' && localStorage.getItem('ykb_admin') === '1');

  useEffect(() => {
    setQuestions(getGauntletQuestions(ROUND_TOTAL));
    setMounted(true);
  }, []);

  const q = questions[qIndex];

  function pick(option: string) {
    if (picked || !q) return;
    setPicked(option);
    if (option === q.answer) setScore(s => s + 1);
    setPhase('answered');
  }

  function next() {
    const nextIdx = qIndex + 1;
    const wasCorrect = picked === q?.answer;
    const currentScore = score + (wasCorrect ? 1 : 0); // account for async state
    if (nextIdx >= ROUND_TOTAL) {
      // Save to localStorage
      const total  = parseInt(localStorage.getItem('ykb_gauntlet_total') || '0', 10);
      const cTotal = parseInt(localStorage.getItem('ykb_gauntlet_correct') || '0', 10);
      localStorage.setItem('ykb_gauntlet_total',   String(total + ROUND_TOTAL));
      localStorage.setItem('ykb_gauntlet_correct', String(cTotal + currentScore));
      setScore(currentScore);
      setPhase('done');
    } else {
      setQIndex(nextIdx);
      setPicked(null);
      setPhase('playing');
    }
  }

  const diffColor = (d: GauntletQuestion['difficulty']) =>
    d === 'Easy' ? '#34d399' : d === 'Medium' ? '#fbbf24' : d === 'Hard' ? '#f97316' : '#c084fc';

  if (!mounted || questions.length === 0) return (
    <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
    </div>
  );

  // ── DONE ─────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const finalScore = score;
    const total = parseInt(localStorage.getItem('ykb_gauntlet_total') || '0', 10);
    const correct = parseInt(localStorage.getItem('ykb_gauntlet_correct') || '0', 10);
    const allTimePct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return (
      <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-6">Career Gauntlet</p>
          <p className="text-5xl font-black mb-2" style={{ color: finalScore >= 8 ? '#34d399' : finalScore >= 5 ? '#fbbf24' : '#f87171' }}>
            {finalScore}/{ROUND_TOTAL}
          </p>
          <p className="text-white/40 text-sm mb-8">
            {finalScore >= 9 ? 'You are the film room.' : finalScore >= 7 ? 'Solid stat nerd energy.' : finalScore >= 5 ? 'You know some ball.' : 'Hit the tape.'}
          </p>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 mb-8 flex justify-around">
            <div className="text-center">
              <p className="text-2xl font-black">{finalScore}/{ROUND_TOTAL}</p>
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-1">This Round</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black">{allTimePct}%</p>
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mt-1">All Time</p>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={() => {
              setQuestions(getGauntletQuestions(ROUND_TOTAL));
              setQIndex(0);
              setScore(0);
              setPicked(null);
              setPhase('playing');
            }}
              className="px-6 py-3 rounded-xl bg-emerald-500 text-black font-black text-sm hover:bg-emerald-400 transition-colors">
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

  if (!q) return null;

  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
        <Link href="/" className="text-white/30 hover:text-white/60 transition-colors text-xs font-mono">← Hub</Link>
        <div className="text-center">
          <p className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">Career Gauntlet</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !picked && (
            <button onClick={() => { pick(q.answer); setTimeout(next, 400); }}
              className="text-[9px] font-mono text-emerald-400/60 border border-emerald-500/30 rounded px-1.5 py-0.5 hover:bg-emerald-500/10 transition-colors">
              SKIP
            </button>
          )}
          <p className="text-xs font-mono text-white/30">{score}/{qIndex}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-5 pt-4">
        {Array.from({ length: ROUND_TOTAL }).map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full"
            style={{ background: i < qIndex ? (i < score ? '#34d399' : '#f87171') : i === qIndex ? '#10b981' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="max-w-sm w-full">
          {/* Meta */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ color: diffColor(q.difficulty), border: `1px solid ${diffColor(q.difficulty)}40`, background: `${diffColor(q.difficulty)}10` }}>
              {q.difficulty}
            </span>
            <span className="text-[10px] font-mono text-white/30">{q.season} · {q.conference} Conf · {q.positionHint}</span>
          </div>

          {/* Stat card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 mb-5">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-4 text-center">{q.teamHint}</p>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <StatBadge label="PPG" value={q.ppg} />
              {q.rpg !== undefined && <StatBadge label="RPG" value={q.rpg} />}
              {q.apg !== undefined && <StatBadge label="APG" value={q.apg} />}
            </div>

            {(q.spg !== undefined || q.bpg !== undefined || q.fg_pct !== undefined || q.fg3_pct !== undefined || q.ft_pct !== undefined) && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/8">
                {q.spg !== undefined && <StatBadge label="SPG" value={q.spg} />}
                {q.bpg !== undefined && <StatBadge label="BPG" value={q.bpg} />}
                {q.fg_pct !== undefined && <StatBadge label="FG%" value={q.fg_pct} unit="%" />}
                {q.fg3_pct !== undefined && <StatBadge label="3P%" value={q.fg3_pct} unit="%" />}
                {q.ft_pct !== undefined && <StatBadge label="FT%" value={q.ft_pct} unit="%" />}
              </div>
            )}

            {phase === 'answered' && (
              <div className="mt-4 pt-4 border-t border-white/8">
                <p className="text-white/40 text-xs leading-relaxed italic">&ldquo;{q.flavor}&rdquo;</p>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {q.options.map(option => {
              const isCorrect = option === q.answer;
              const isPicked  = option === picked;
              let borderColor = 'rgba(255,255,255,0.1)';
              let bg = 'rgba(255,255,255,0.03)';
              let textColor = 'rgba(255,255,255,0.8)';
              if (phase === 'answered') {
                if (isCorrect) { borderColor = '#34d399'; bg = 'rgba(52,211,153,0.1)'; textColor = '#34d399'; }
                else if (isPicked) { borderColor = '#f87171'; bg = 'rgba(248,113,113,0.08)'; textColor = '#f87171'; }
                else { textColor = 'rgba(255,255,255,0.3)'; }
              }
              return (
                <button key={option}
                  onClick={() => pick(option)}
                  disabled={!!picked}
                  className="rounded-xl border py-4 px-3 text-center font-bold text-sm transition-all active:scale-[0.98] disabled:cursor-default"
                  style={{ borderColor, background: bg, color: textColor }}>
                  {option}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {phase === 'answered' && (
            <div className="mt-6 text-center">
              <p className="text-sm font-black mb-1" style={{ color: picked === q.answer ? '#34d399' : '#f87171' }}>
                {picked === q.answer ? '✓ Correct' : `✗ ${q.answer}`}
              </p>
              <button onClick={next}
                className="mt-3 px-8 py-3 rounded-xl bg-emerald-500 text-black font-black text-sm hover:bg-emerald-400 transition-colors active:scale-[0.98]">
                {qIndex + 1 >= ROUND_TOTAL ? 'See Results' : 'Next →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
