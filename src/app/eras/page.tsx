'use client';

import Link from 'next/link';
import { QUESTIONS } from '@/data/questions';

const classicQ = QUESTIONS.filter(q => q.era === 'classic');
const modernQ  = QUESTIONS.filter(q => q.era === 'modern');

const ERA_INFO = {
  classic: {
    label:  'Classic Era',
    range:  '1980 — 2010',
    desc:   'Bad Boy Pistons. Showtime. The Triangle. Iso-Melo. Pre-analytics basketball, where post play and midrange jumpers were not yet crimes.',
    stats:  [
      { label: 'Questions',    value: String(classicQ.length) },
      { label: 'Unhinged',     value: String(classicQ.filter(q => q.difficulty === 'niche').length) },
      { label: 'Avg Diff',     value: '2.8 / 4' },
    ],
    href:   '/?era=classic',
    accent: '#C8102E',
  },
  modern: {
    label:  'Modern Era',
    range:  '2010 — Present',
    desc:   'Three-point revolution. SSOL Suns DNA everywhere. Jokic basketball. The era where everyone is a point guard and nobody plays defense voluntarily.',
    stats:  [
      { label: 'Questions',    value: String(modernQ.length) },
      { label: 'Unhinged',     value: String(modernQ.filter(q => q.difficulty === 'niche').length) },
      { label: 'Avg Diff',     value: '2.5 / 4' },
    ],
    href:   '/?era=modern',
    accent: '#007AC1',
  },
};

export default function ErasPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        <div>
          <h1 className="text-2xl font-black">Eras</h1>
          <p className="text-white/40 text-sm mt-1">Filter the game by era. Each era has its own question bank.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {Object.entries(ERA_INFO).map(([key, era]) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/3 p-6 space-y-4 hover:border-white/20 transition-colors">
              <div>
                <div className="text-xs font-mono text-white/40 mb-1">{era.range}</div>
                <h2 className="text-lg font-bold">{era.label}</h2>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">{era.desc}</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {era.stats.map(s => (
                  <div key={s.label} className="rounded-lg bg-white/4 px-3 py-2 text-center">
                    <div className="text-lg font-black" style={{ color: era.accent }}>{s.value}</div>
                    <div className="text-white/40 text-xs">{s.label}</div>
                  </div>
                ))}
              </div>

              <Link
                href={era.href}
                className="block w-full text-center py-2.5 rounded-lg border border-white/15 text-sm font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                Play {era.label}
              </Link>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/8 bg-white/2 p-5">
          <h3 className="font-semibold text-sm mb-3 text-white/80">All-time difficulty breakdown</h3>
          <div className="grid grid-cols-4 gap-3">
            {(['easy','medium','hard','niche'] as const).map(d => {
              const n = QUESTIONS.filter(q => q.difficulty === d).length;
              const colors: Record<string, string> = { easy: '#34d399', medium: '#7dd3fc', hard: '#f97316', niche: '#f87171' };
              return (
                <div key={d} className="text-center">
                  <div className="text-2xl font-black" style={{ color: colors[d] }}>{n}</div>
                  <div className="text-white/30 text-xs capitalize mt-0.5">{d}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
