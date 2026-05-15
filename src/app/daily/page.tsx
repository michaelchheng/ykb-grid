'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getDailyQuestions, type Question } from '@/data/questions';
import { useSocket } from '@/hooks/useSocket';

function todayStr() { return new Date().toISOString().split('T')[0]; }

function formatValue(value: number, unit: string): string {
  if (unit.includes('x1000')) return (value / 10).toFixed(1) + '%';
  if (value >= 1000) return value.toLocaleString();
  return String(value);
}

type Phase = 'question' | 'correct' | 'wrong' | 'done_already';

const ROUND_TOTAL = 5;

export default function DailyChallenge() {
  const [phase, setPhase]         = useState<Phase>('question');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [qIndex, setQIndex]       = useState(0);
  const [score, setScore]         = useState(0);
  const [answered, setAnswered]   = useState<'A' | 'B' | null>(null);
  const [username, setUsername]   = useState<string>('');
  const [mounted, setMounted]     = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [savedResult, setSavedResult] = useState<{ score: number; correct: number } | null>(null);
  const [isAdmin]             = useState(() => typeof window !== 'undefined' && localStorage.getItem('ykb_admin') === '1');

  const { submitVote, voteData, getVotes } = useSocket();

  // biome-ignore lint/correctness/useExhaustiveDependencies: init effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const name = localStorage.getItem('ykb_username') || 'Anonymous';
    const doneKey = `ykb_daily_done_${todayStr()}`;
    const resultRaw = localStorage.getItem(doneKey);
    const dailyQs = getDailyQuestions('all', ROUND_TOTAL);
    let done = false;
    let result: { score: number; correct: number } | null = null;
    if (resultRaw) {
      try { result = JSON.parse(resultRaw); done = true; } catch { /* ignore */ }
    }
    // batch all init state — intentional pattern used throughout this app
    /* biome-ignore lint/suspicious/noSetStateInEffect: intentional init */
    setUsername(name);
    /* biome-ignore lint/suspicious/noSetStateInEffect: intentional init */
    setQuestions(dailyQs);
    /* biome-ignore lint/suspicious/noSetStateInEffect: intentional init */
    setSavedResult(result);
    /* biome-ignore lint/suspicious/noSetStateInEffect: intentional init */
    setAlreadyDone(done);
    /* biome-ignore lint/suspicious/noSetStateInEffect: intentional init */
    setMounted(true);
  }, []);

  const q = questions[qIndex];

  const qId = q?.id;
  useEffect(() => {
    if (qId) getVotes(qId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qId]);

  const pick = useCallback((choice: 'A' | 'B') => {
    if (answered || !q) return;
    setAnswered(choice);
    const correct = choice === 'A' ? q.valueA >= q.valueB : q.valueB > q.valueA;
    submitVote(q.id, choice, correct, username);
    if (correct) {
      setScore(s => s + 1);
      setPhase('correct');
    } else {
      setPhase('wrong');
    }
  }, [answered, q, username, submitVote]);

  function next() {
    const nextIdx = qIndex + 1;
    const isLastQuestion = nextIdx >= ROUND_TOTAL;
    if (isLastQuestion) {
      // Score hasn't updated in state yet — add the current round's point
      const finalCorrect = score + (phase === 'correct' ? 1 : 0);
      const finalResult = { score: finalCorrect, correct: finalCorrect };
      localStorage.setItem(`ykb_daily_done_${todayStr()}`, JSON.stringify(finalResult));
      setSavedResult(finalResult);
      setAlreadyDone(true);
    } else {
      setQIndex(nextIdx);
      setAnswered(null);
      setPhase('question');
    }
  }

  // Properly compute final score after last question
  const votes = q ? voteData[q.id] : null;
  const totalVotes = (votes?.votesA ?? 0) + (votes?.votesB ?? 0);
  const pctA = totalVotes > 0 ? Math.round(((votes?.votesA ?? 0) / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;

  if (!mounted) return (
    <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
    </div>
  );

  // Already played today — show result
  if (alreadyDone && savedResult) {
    const pct = Math.round((savedResult.correct / ROUND_TOTAL) * 100);
    return (
      <div className="min-h-screen bg-[#08080d] text-white flex flex-col items-center justify-center px-5">
        <div className="max-w-sm w-full text-center">
          <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] mb-6">Daily Challenge</p>
          <p className="text-white/40 text-sm mb-2">Today&apos;s result</p>
          <p className="text-[5rem] font-black leading-none" style={{ color: pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171' }}>
            {savedResult.correct}/{ROUND_TOTAL}
          </p>
          <p className="text-white/40 text-sm mt-2 mb-8">
            {pct >= 80 ? 'You know ball. 🔥' : pct >= 60 ? 'Solid. Come back tomorrow.' : 'Better luck tomorrow.'}
          </p>
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 mb-8">
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">Come back tomorrow for 5 new questions</p>
            <p className="text-white/50 text-xs">Same questions for everyone, same day. No excuses.</p>
          </div>
          <Link href="/" className="inline-block text-xs font-mono text-white/40 hover:text-white/70 transition-colors border border-white/10 rounded px-4 py-2">
            ← Back to Hub
          </Link>
        </div>
      </div>
    );
  }

  if (!q) return (
    <div className="min-h-screen bg-[#08080d] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
    </div>
  );

  const correct = answered ? (answered === 'A' ? q.valueA >= q.valueB : q.valueB > q.valueA) : false;

  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
        <Link href="/" className="text-white/30 hover:text-white/60 transition-colors text-xs font-mono">← Hub</Link>
        <div className="text-center">
          <p className="text-[10px] font-mono text-amber-400/70 uppercase tracking-widest">Daily Challenge</p>
          <p className="text-[10px] font-mono text-white/25">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !answered && (
            <button onClick={() => { pick(q.valueA >= q.valueB ? 'A' : 'B'); setTimeout(next, 400); }}
              className="text-[9px] font-mono text-amber-400/60 border border-amber-500/30 rounded px-1.5 py-0.5 hover:bg-amber-500/10 transition-colors">
              SKIP
            </button>
          )}
          <p className="text-xs font-mono text-white/30">{score}/{ROUND_TOTAL}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-5 pt-4">
        {Array.from({ length: ROUND_TOTAL }).map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full"
            style={{ background: i < qIndex ? '#34d399' : i === qIndex ? '#f59e0b' : 'rgba(255,255,255,0.08)' }} />
        ))}
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8">
        <div className="max-w-sm w-full">
          {/* Stat label */}
          <div className="text-center mb-6">
            <p className="text-xs font-mono text-white/35 uppercase tracking-wider mb-1">{q.subLabel}</p>
            <p className="text-2xl font-black">{q.label}</p>
            {q.flavor && (
              <p className="text-white/35 text-xs leading-relaxed mt-3 max-w-xs mx-auto italic">&ldquo;{q.flavor}&rdquo;</p>
            )}
          </div>

          {/* Player cards */}
          <div className="space-y-3">
            {(['A', 'B'] as const).map(side => {
              const player = side === 'A' ? q.playerA : q.playerB;
              const value  = side === 'A' ? q.valueA  : q.valueB;
              const isAnswered = answered === side;
              const isCorrectSide = side === 'A' ? q.valueA >= q.valueB : q.valueB > q.valueA;
              const pct = side === 'A' ? pctA : pctB;

              let borderColor = 'rgba(255,255,255,0.1)';
              let bg = 'rgba(255,255,255,0.03)';
              if (answered) {
                if (isCorrectSide) { borderColor = '#34d399'; bg = 'rgba(52,211,153,0.08)'; }
                else if (isAnswered) { borderColor = '#f87171'; bg = 'rgba(248,113,113,0.08)'; }
              }

              return (
                <button key={side}
                  onClick={() => pick(side)}
                  disabled={!!answered}
                  className="w-full rounded-2xl border p-5 text-left transition-all active:scale-[0.99] disabled:cursor-default"
                  style={{ borderColor, background: bg }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-base">{player.name}</p>
                      <p className="text-white/40 text-xs mt-0.5">{player.context}</p>
                    </div>
                    {answered ? (
                      <div className="text-right">
                        <p className="text-2xl font-black tabular-nums" style={{ color: isCorrectSide ? '#34d399' : '#f87171' }}>
                          {formatValue(value, q.unit)}
                        </p>
                        <p className="text-xs text-white/35 font-mono">{q.unit}</p>
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
                        <span className="text-xs font-black text-white/40">{side}</span>
                      </div>
                    )}
                  </div>

                  {/* Community bar (shown after answer) */}
                  {answered && (
                    <div className="mt-3 pt-3 border-t border-white/8">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: isCorrectSide ? '#34d399' : '#f87171' }} />
                        </div>
                        <span className="text-[10px] font-mono text-white/35 tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                      <p className="text-[10px] text-white/25 font-mono mt-1">{totalVotes.toLocaleString()} picks</p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback + next */}
          {answered && (
            <div className="mt-6 text-center">
              <p className="text-sm font-black mb-4" style={{ color: correct ? '#34d399' : '#f87171' }}>
                {correct ? '✓ Correct' : '✗ Wrong'}
              </p>
              <button onClick={next}
                className="px-8 py-3 rounded-xl bg-amber-500 text-black font-black text-sm hover:bg-amber-400 transition-colors active:scale-[0.98]">
                {qIndex + 1 >= ROUND_TOTAL ? 'See Results' : `Next (${qIndex + 1}/${ROUND_TOTAL})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div className="border-t border-white/[0.06] px-5 py-3 text-center">
        <p className="text-[10px] font-mono text-white/20">Same 5 questions for everyone today · Resets at midnight</p>
      </div>
    </div>
  );
}
