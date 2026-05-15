'use client';

import Link from 'next/link';

interface PatchEntry {
  version: string;
  date: string;
  label?: string;
  changes: { type: 'new' | 'improved' | 'fixed'; text: string }[];
}

const PATCHES: PatchEntry[] = [
  {
    version: '3.0',
    date: 'May 2026',
    label: 'AI Agents',
    changes: [
      { type: 'new',      text: 'Multi-agent question generation — three GPT-4o agents (StatsAgent → SelectionAgent → WriterAgent) now power the Gauntlet' },
      { type: 'new',      text: 'StatsAgent scores every player\'s identifiability (0–100) before questions are built — no more random difficulty mismatches' },
      { type: 'new',      text: 'SelectionAgent picks answer + distractors using tool calling, explicitly reasoning about era, stat similarity, and position' },
      { type: 'new',      text: 'WriterAgent crafts flavor text without ever seeing the distractors — fully isolated context per agent' },
      { type: 'improved', text: 'Questions now include a rationale explaining why the distractors were chosen' },
      { type: 'improved', text: 'All three agent phases run in parallel across seasons for faster load times' },
    ],
  },
  {
    version: '2.0',
    date: 'May 2026',
    label: 'Major Update',
    changes: [
      { type: 'new',      text: 'Gauntlet mode — 10-round stat trivia, no comparison, just pure recall' },
      { type: 'new',      text: 'Draft Order mode — rank players by draft position in a given year' },
      { type: 'new',      text: 'Eras mode — identify which era a player\'s stat line belongs to' },
      { type: 'new',      text: 'Head-to-Head (H2H) — real-time multiplayer, challenge anyone by username' },
      { type: 'new',      text: 'Leaderboard — global rankings by Ball IQ, streaks, and accuracy across all tiers' },
      { type: 'new',      text: 'Ball IQ rank system — Casual → Hooper → Film Room → Elite → Niche' },
      { type: 'new',      text: 'Google sign-in — stats sync across devices via Firestore' },
      { type: 'improved', text: 'Daily questions now generated live from real NBA Stats API data — no more static lists' },
      { type: 'improved', text: 'Difficulty gap tuning — niche tier pulls from obscure seasons (1994–2012)' },
      { type: 'improved', text: 'Used question tracking — you won\'t see the same question twice per session' },
    ],
  },
  {
    version: '1.0',
    date: 'Sept 2024',
    label: 'Launch',
    changes: [
      { type: 'new', text: 'Daily NBA player comparison trivia — Easy, Medium, Hard, Niche tiers' },
      { type: 'new', text: 'Streak tracking and daily lockout — one shot per tier per day' },
      { type: 'new', text: 'GPT-4 flavor text generation — AI writes the question context around real stats' },
      { type: 'new', text: 'Local stat persistence — streaks and history saved between sessions' },
    ],
  },
];

const TYPE_STYLE: Record<string, { dot: string; label: string }> = {
  new:      { dot: 'bg-sky-300',   label: 'NEW'      },
  improved: { dot: 'bg-blue-400',      label: 'IMPROVED' },
  fixed:    { dot: 'bg-sky-400',    label: 'FIXED'    },
};

export default function PatchNotes() {
  return (
    <main className="min-h-screen bg-[#08080d] text-white">
      <div className="max-w-2xl mx-auto px-5 pt-14 pb-24">

        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="text-xs text-white/30 hover:text-white/55 transition-colors font-mono tracking-widest">← BACK</Link>
          <h1 className="mt-6 text-3xl font-black tracking-tight">Patch Notes</h1>
          <p className="mt-2 text-sm text-white/40">What&apos;s changed in YouKnowBall.</p>
        </div>

        {/* Patches */}
        <div className="flex flex-col gap-10">
          {PATCHES.map((patch) => (
            <div key={patch.version}>
              {/* Version header */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-xl font-black">v{patch.version}</span>
                {patch.label && (
                  <span className={[
                    'text-[10px] font-black tracking-widest px-2 py-0.5 rounded',
                    patch.version === '3.0'
                      ? 'bg-sky-400/20 text-sky-200 border border-sky-400/30'
                      : patch.version === '2.0'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-white/8 text-white/40 border border-white/10',
                  ].join(' ')}>
                    {patch.label.toUpperCase()}
                  </span>
                )}
                <span className="text-xs text-white/30 font-mono ml-auto">{patch.date}</span>
              </div>

              {/* Change list */}
              <div className="flex flex-col gap-2.5 border-l border-white/[0.06] pl-5">
                {patch.changes.map((c, i) => {
                  const s = TYPE_STYLE[c.type];
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot} mt-[3px]`} />
                        <span className={`text-[9px] font-black tracking-widest w-[54px] ${
                          c.type === 'new' ? 'text-sky-300' :
                          c.type === 'improved' ? 'text-blue-400' : 'text-sky-300'
                        }`}>{s.label}</span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">{c.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-16 text-xs text-white/20 font-mono text-center">youknowball.us · built by michael chheng</p>
      </div>
    </main>
  );
}
