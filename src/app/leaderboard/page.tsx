'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSocket } from '@/hooks/useSocket';

type Tier = 'easy' | 'medium' | 'hard' | 'niche';

interface TierStats { correct: number; total: number; bestStreak: number; }
interface Entry { username: string; country: string; tiers: Record<Tier, TierStats>; }

function ballIQ(e: Entry): { label: string; color: string } {
  const { niche, hard, medium, easy } = e.tiers;
  const nicheAcc = niche.total  > 0 ? niche.correct  / niche.total  : 0;
  const hardAcc  = hard.total   > 0 ? hard.correct   / hard.total   : 0;
  const medAcc   = medium.total > 0 ? medium.correct / medium.total : 0;
  const easyAcc  = easy.total   > 0 ? easy.correct   / easy.total   : 0;
  if (nicheAcc >= 0.6)                               return { label: 'Niche',               color: '#facc15' };
  if (hardAcc  >= 0.75 && medAcc >= 0.7)             return { label: 'Elite Ball Knowledge', color: '#f97316' };
  if (hardAcc  >= 0.5  || medAcc >= 0.7)             return { label: 'Film Room',            color: '#c084fc' };
  if (medAcc   >= 0.5  || easyAcc >= 0.7)            return { label: 'Hooper',               color: '#38bdf8' };
  return                                                    { label: 'Casual',               color: '#6b7280' };
}

function acc(s: TierStats) { return s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0; }

const DUMMY_WHM: Entry[] = [
  { username: 'CourtVision',  country: 'US', tiers: { easy: { correct: 48, total: 50, bestStreak: 12 }, medium: { correct: 38, total: 50, bestStreak: 8 }, hard: { correct: 29, total: 40, bestStreak: 6 }, niche: { correct: 18, total: 30, bestStreak: 4 } } },
  { username: 'FoyleFan2000', country: 'US', tiers: { easy: { correct: 42, total: 50, bestStreak: 9  }, medium: { correct: 31, total: 50, bestStreak: 5 }, hard: { correct: 27, total: 40, bestStreak: 5 }, niche: { correct: 22, total: 30, bestStreak: 7 } } },
  { username: 'BoxScoreNerd', country: 'CA', tiers: { easy: { correct: 45, total: 50, bestStreak: 10 }, medium: { correct: 35, total: 50, bestStreak: 7 }, hard: { correct: 24, total: 40, bestStreak: 4 }, niche: { correct: 14, total: 30, bestStreak: 3 } } },
  { username: 'StatlineKing', country: 'US', tiers: { easy: { correct: 40, total: 50, bestStreak: 8  }, medium: { correct: 30, total: 50, bestStreak: 6 }, hard: { correct: 22, total: 40, bestStreak: 4 }, niche: { correct: 11, total: 30, bestStreak: 2 } } },
  { username: 'TheGlove33',   country: 'UK', tiers: { easy: { correct: 43, total: 50, bestStreak: 11 }, medium: { correct: 28, total: 50, bestStreak: 5 }, hard: { correct: 20, total: 40, bestStreak: 3 }, niche: { correct: 9,  total: 30, bestStreak: 2 } } },
  { username: 'TripleDub',    country: 'US', tiers: { easy: { correct: 38, total: 50, bestStreak: 7  }, medium: { correct: 25, total: 50, bestStreak: 4 }, hard: { correct: 17, total: 40, bestStreak: 3 }, niche: { correct: 7,  total: 30, bestStreak: 1 } } },
  { username: 'PaintTouches', country: 'AU', tiers: { easy: { correct: 35, total: 50, bestStreak: 6  }, medium: { correct: 22, total: 50, bestStreak: 3 }, hard: { correct: 14, total: 40, bestStreak: 2 }, niche: { correct: 5,  total: 30, bestStreak: 1 } } },
  { username: 'CornerThree',  country: 'US', tiers: { easy: { correct: 31, total: 50, bestStreak: 5  }, medium: { correct: 18, total: 50, bestStreak: 3 }, hard: { correct: 11, total: 40, bestStreak: 2 }, niche: { correct: 4,  total: 30, bestStreak: 1 } } },
];

const TIERS: { key: Tier; label: string; color: string; desc: string }[] = [
  { key: 'easy',   label: 'Easy',   color: '#34d399', desc: 'The stuff you should know'   },
  { key: 'medium', label: 'Medium', color: '#fbbf24', desc: 'Requires some film time'     },
  { key: 'hard',   label: 'Hard',   color: '#f97316', desc: 'Deep cuts, rare facts'       },
  { key: 'niche',  label: 'Niche',  color: '#c084fc', desc: 'Borderline impossible'       },
];

function RankBadge({ rank }: { rank: number }) {
  const base = 'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black tabular-nums shrink-0';
  if (rank === 1) return <span className={`${base} bg-yellow-400/15 text-yellow-300`}>1</span>;
  if (rank === 2) return <span className={`${base} bg-slate-400/10  text-slate-300`}>2</span>;
  if (rank === 3) return <span className={`${base} bg-orange-700/15 text-orange-400`}>3</span>;
  return <span className={`${base} bg-white/4 text-white/25`}>{rank}</span>;
}

export default function LeaderboardPage() {
  const [tier, setTier] = useState<Tier>('easy');
  const [username, setUsername] = useState<string | null>(null);
  const [myWhm, setMyWhm] = useState<Record<Tier, TierStats> | null>(null);
  const { leaderboard, getLeaderboard } = useSocket();

  useEffect(() => {
    const saved = localStorage.getItem('ykb_username');
    setUsername(saved);
    const tiers: Tier[] = ['easy', 'medium', 'hard', 'niche'];
    const whm = {} as Record<Tier, TierStats>;
    tiers.forEach(t => {
      whm[t] = {
        correct:    parseInt(localStorage.getItem(`ykb_correct_${t}`) || '0', 10),
        total:      parseInt(localStorage.getItem(`ykb_total_${t}`)   || '0', 10),
        bestStreak: parseInt(localStorage.getItem(`ykb_best_${t}`)    || '0', 10),
      };
    });
    setMyWhm(whm);
    getLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const whmData = useMemo<Entry[]>(() => {
    if (!username || !myWhm) return DUMMY_WHM;
    const hasData = Object.values(myWhm).some(s => s.total > 0 || s.bestStreak > 0);
    const base = DUMMY_WHM.filter(d => d.username !== username);
    if (!hasData) return base;
    return [...base, { username, country: '—', tiers: myWhm }];
  }, [username, myWhm]);

  const activeTier = TIERS.find(t => t.key === tier)!;

  const sortedWhm = [...whmData].sort((a, b) => {
    const streakDiff = b.tiers[tier].bestStreak - a.tiers[tier].bestStreak;
    if (streakDiff !== 0) return streakDiff;
    return acc(b.tiers[tier]) - acc(a.tiers[tier]);
  });

  void leaderboard;

  return (
    <div className="min-h-screen bg-[#08080d] text-white">
      <div className="max-w-xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black">Leaderboard</h1>
            <p className="text-white/45 text-xs mt-0.5">Best streak per tier — one wrong and you&apos;re locked</p>
          </div>
          <Link href="/" className="text-xs text-white/35 hover:text-white/70 border border-white/10 hover:border-white/25 px-3 py-1.5 rounded-lg transition-colors">
            Play →
          </Link>
        </div>

        {/* Tier tabs */}
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {TIERS.map(t => (
            <button key={t.key} onClick={() => setTier(t.key)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap',
                tier === t.key
                  ? 'text-black font-bold border-transparent'
                  : 'border-white/10 text-white/35 hover:text-white/60 hover:border-white/20 bg-transparent',
              ].join(' ')}
              style={tier === t.key ? { backgroundColor: activeTier.color, borderColor: activeTier.color } : {}}>
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-white/45 text-xs mb-6 font-mono">{activeTier.desc}</p>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 mb-1 text-[10px] text-white/35 font-mono uppercase tracking-wider">
          <span className="w-7 shrink-0" />
          <span className="flex-1">Player</span>
          <span className="w-20 text-right">Best Streak</span>
          <span className="w-12 text-right">Acc</span>
        </div>

        {/* Rows */}
        <div className="space-y-0.5">
          {sortedWhm.map((entry, i) => {
            const isYou  = entry.username === username;
            const stats  = entry.tiers[tier];
            const iq     = ballIQ(entry);
            return (
              <div key={entry.username}
                className={['flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors', isYou ? 'bg-white/7 border border-white/10' : 'hover:bg-white/4'].join(' ')}>
                <RankBadge rank={i + 1} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">{entry.username}</span>
                    {isYou && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono shrink-0">you</span>}
                    <span className="text-[10px] font-mono shrink-0" style={{ color: iq.color }}>{iq.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-white/40 text-[11px]">{entry.country}</span>
                    <span className="text-white/30 text-[11px]">·</span>
                    <span className="text-white/40 text-[11px] tabular-nums">{stats.correct}/{stats.total} correct</span>
                  </div>
                </div>
                <div className="text-right w-20 shrink-0">
                  {stats.bestStreak > 0
                    ? <span className="text-xl font-black tabular-nums" style={{ color: stats.bestStreak >= 8 ? activeTier.color : stats.bestStreak >= 4 ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}>{stats.bestStreak}</span>
                    : <span className="text-white/20 text-lg">—</span>}
                  <p className="text-white/35 text-[10px] font-mono">streak</p>
                </div>
                <div className="text-right w-12 shrink-0">
                  <span className="text-sm font-bold tabular-nums" style={{ color: activeTier.color }}>{acc(stats)}%</span>
                  <div className="h-1 bg-white/8 rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full" style={{ width: `${acc(stats)}%`, backgroundColor: activeTier.color + '99' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ball IQ legend */}
        <div className="mt-8 rounded-xl border border-white/6 bg-white/[0.02] p-5">
          <p className="text-[11px] text-white/50 uppercase tracking-widest font-mono mb-4">Ball IQ Ranks</p>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
            {[
              { label: 'Niche',               color: '#facc15', desc: '60%+ niche accuracy'         },
              { label: 'Elite Ball Knowledge', color: '#f97316', desc: '75% hard + 70% medium'      },
              { label: 'Film Room',            color: '#c084fc', desc: '50%+ hard or 70%+ medium'   },
              { label: 'Hooper',              color: '#38bdf8', desc: 'Getting there — keep playing' },
              { label: 'Casual',              color: '#6b7280', desc: 'Keep watching ball'           },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold w-24" style={{ color: r.color }}>{r.label}</span>
                <span className="text-white/45 text-[11px]">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 mt-4 border-t border-white/6 flex items-center justify-between">
          <p className="text-white/30 text-xs">Your stats tracked locally — global sync coming soon.</p>
          <Link href="/" className="text-xs text-white/50 hover:text-white/80 transition-colors">Start a round →</Link>
        </div>
      </div>
    </div>
  );
}
