'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

type Tier = 'easy' | 'medium' | 'hard' | 'niche';

interface TierStats { bestStreak: number; totalCorrect: number; totalAnswered: number; }
interface Entry { uid: string; username: string; tiers: Record<string, TierStats>; }

function ballIQ(e: Entry): { label: string; color: string } {
  const g = (key: string): TierStats => e.tiers[key] ?? { bestStreak: 0, totalCorrect: 0, totalAnswered: 0 };
  const acc = (s: TierStats) => s.totalAnswered > 0 ? s.totalCorrect / s.totalAnswered : 0;
  const nicheAcc = acc(g('niche')), hardAcc = acc(g('hard')), medAcc = acc(g('medium')), easyAcc = acc(g('easy'));
  if (nicheAcc >= 0.6)                         return { label: 'Niche',               color: '#f59e0b' };
  if (hardAcc  >= 0.75 && medAcc >= 0.7)       return { label: 'Elite Ball Knowledge', color: '#f97316' };
  if (hardAcc  >= 0.5  || medAcc >= 0.7)       return { label: 'Film Room',            color: '#c084fc' };
  if (medAcc   >= 0.5  || easyAcc >= 0.7)      return { label: 'Hooper',               color: '#38bdf8' };
  return                                               { label: 'Casual',               color: '#6b7280' };
}

const TIERS: { key: Tier; label: string; color: string; desc: string }[] = [
  { key: 'easy',   label: 'Easy',   color: '#34d399', desc: 'The stuff you should know'   },
  { key: 'medium', label: 'Medium', color: '#fbbf24', desc: 'Requires some film time'     },
  { key: 'hard',   label: 'Hard',   color: '#f97316', desc: 'Deep cuts, rare facts'       },
  { key: 'niche',  label: 'Niche',  color: '#c084fc', desc: 'Borderline impossible'       },
];

function RankBadge({ rank }: { rank: number }) {
  const base = 'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black tabular-nums shrink-0';
  if (rank === 1) return <span className={`${base} bg-amber-500/15 text-amber-300`}>1</span>;
  if (rank === 2) return <span className={`${base} bg-slate-400/10  text-slate-300`}>2</span>;
  if (rank === 3) return <span className={`${base} bg-orange-700/15 text-orange-400`}>3</span>;
  return <span className={`${base} bg-white/4 text-white/25`}>{rank}</span>;
}

function pct(s: TierStats) { return s.totalAnswered > 0 ? Math.round((s.totalCorrect / s.totalAnswered) * 100) : 0; }

export default function LeaderboardPage() {
  const [tier, setTier]       = useState<Tier>('easy');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUid, setMyUid]     = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);

  useEffect(() => {
    setMyUid(localStorage.getItem('ykb_uid'));
    setMyUsername(localStorage.getItem('ykb_username'));

    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => setEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeTier = TIERS.find(t => t.key === tier)!;

  const sorted = useMemo(() => {
    return [...entries]
      .filter(e => (e.tiers[tier]?.totalAnswered ?? 0) > 0)
      .sort((a, b) => {
        const sd = (b.tiers[tier]?.bestStreak ?? 0) - (a.tiers[tier]?.bestStreak ?? 0);
        if (sd !== 0) return sd;
        return pct(b.tiers[tier] ?? { bestStreak: 0, totalCorrect: 0, totalAnswered: 0 })
             - pct(a.tiers[tier] ?? { bestStreak: 0, totalCorrect: 0, totalAnswered: 0 });
      });
  }, [entries, tier]);

  return (
    <div className="min-h-screen bg-[#08080d] text-white">
      <div className="max-w-xl mx-auto px-4 py-10">

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
        <p className="text-white/45 text-xs mb-6">{activeTier.desc}</p>

        {/* Column headers */}
        <div className="flex items-center gap-3 px-3 mb-1 text-[10px] text-white/35 uppercase tracking-wider">
          <span className="w-7 shrink-0" />
          <span className="flex-1">Player</span>
          <span className="w-20 text-right">Best Streak</span>
          <span className="w-12 text-right">Acc</span>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/30 text-sm">No players yet for this tier.</p>
            <p className="text-white/20 text-xs mt-1">Be the first — go play.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sorted.map((entry, i) => {
              const isYou  = entry.uid === myUid || entry.username === myUsername;
              const stats  = entry.tiers[tier] ?? { bestStreak: 0, totalCorrect: 0, totalAnswered: 0 };
              const iq     = ballIQ(entry);
              const accuracy = pct(stats);
              return (
                <div key={entry.uid}
                  className={['flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors', isYou ? 'bg-white/7 border border-white/10' : 'hover:bg-white/4'].join(' ')}>
                  <RankBadge rank={i + 1} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold truncate">{entry.username}</span>
                      {isYou && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 shrink-0">you</span>}
                      <span className="text-[10px] shrink-0" style={{ color: iq.color }}>{iq.label}</span>
                    </div>
                    <p className="text-white/40 text-[11px] tabular-nums mt-0.5">{stats.totalCorrect}/{stats.totalAnswered} correct</p>
                  </div>
                  <div className="text-right w-20 shrink-0">
                    {stats.bestStreak > 0
                      ? <span className="text-xl font-black tabular-nums" style={{ color: stats.bestStreak >= 8 ? activeTier.color : stats.bestStreak >= 4 ? '#fbbf24' : 'rgba(255,255,255,0.6)' }}>{stats.bestStreak}</span>
                      : <span className="text-white/20 text-lg">—</span>}
                    <p className="text-white/35 text-[10px]">streak</p>
                  </div>
                  <div className="text-right w-12 shrink-0">
                    <span className="text-sm font-bold tabular-nums" style={{ color: activeTier.color }}>{accuracy}%</span>
                    <div className="h-1 bg-white/8 rounded-full overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${accuracy}%`, backgroundColor: activeTier.color + '99' }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Ball IQ legend */}
        <div className="mt-8 rounded-xl border border-white/6 bg-white/[0.02] p-5">
          <p className="text-[11px] text-white/50 uppercase tracking-widest mb-4">Ball IQ Ranks</p>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
            {[
              { label: 'Niche',               color: '#f59e0b', desc: '60%+ niche accuracy'          },
              { label: 'Elite Ball Knowledge', color: '#f97316', desc: '75% hard + 70% medium'       },
              { label: 'Film Room',            color: '#c084fc', desc: '50%+ hard or 70%+ medium'    },
              { label: 'Hooper',               color: '#38bdf8', desc: 'Getting there — keep playing' },
              { label: 'Casual',               color: '#6b7280', desc: 'Keep watching ball'           },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2">
                <span className="text-xs font-bold w-24" style={{ color: r.color }}>{r.label}</span>
                <span className="text-white/45 text-[11px]">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-6 mt-4 border-t border-white/6 flex items-center justify-between">
          <p className="text-white/30 text-xs">Live data · updates every 60s</p>
          <Link href="/" className="text-xs text-white/50 hover:text-white/80 transition-colors">Start a round →</Link>
        </div>
      </div>
    </div>
  );
}
