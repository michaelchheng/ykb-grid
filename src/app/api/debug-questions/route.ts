/**
 * Debug endpoint — preview what questions each AI pipeline would serve.
 * Admin-only: requires ?key=YKB_ADMIN_2026
 *
 * GET /api/debug-questions?key=YKB_ADMIN_2026&tier=easy
 * Returns one question from each pipeline enabled for that tier.
 */
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('key') !== 'YKB_ADMIN_2026') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tier = (searchParams.get('tier') ?? 'easy') as 'easy' | 'medium' | 'hard' | 'niche';
  const host = req.headers.get('host') ?? 'localhost:3000';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const base = `${proto}://${host}`;

  const gauntDiff = tier === 'easy' ? 'Easy' : tier === 'medium' ? 'Medium' : tier === 'hard' ? 'Hard' : 'Niche';

  const results: Record<string, unknown> = { tier, pipelines: {} };

  // ── Comparison (Who Had More?) — all tiers ──────────────────────────────────
  try {
    const t0 = Date.now();
    const res = await fetch(`${base}/api/generate-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ difficulty: tier, count: 2 }),
    });
    const data = await res.json();
    (results.pipelines as Record<string, unknown>).comparison = {
      ms: Date.now() - t0,
      count: (data.questions ?? []).length,
      source: data.source ?? 'live',
      questions: (data.questions ?? []).map((q: Record<string, unknown>) => ({
        id: q.id,
        stat: q.statLabel,
        season: q.season,
        playerA: (q as Record<string, unknown> & { playerA?: { playerName?: string; stat?: number } }).playerA?.playerName,
        playerB: (q as Record<string, unknown> & { playerB?: { playerName?: string; stat?: number } }).playerB?.playerName,
        valueA: q.valueA,
        valueB: q.valueB,
        flavor: q.flavor,
      })),
    };
  } catch (e) {
    (results.pipelines as Record<string, unknown>).comparison = { error: String(e) };
  }

  // ── Gauntlet (Name the Player) — medium/hard/niche only ────────────────────
  if (tier !== 'easy') {
    try {
      const t0 = Date.now();
      const res = await fetch(`${base}/api/generate-gauntlet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: gauntDiff, count: 2, seenAnswers: [] }),
      });
      const data = await res.json();
      (results.pipelines as Record<string, unknown>).gauntlet = {
        ms: Date.now() - t0,
        count: (data.questions ?? []).length,
        questions: (data.questions ?? []).map((q: Record<string, unknown>) => ({
          id: q.id,
          answer: q.answer,
          season: q.season,
          team: q.team,
          flavor: q.flavor,
          options: q.options,
          identifiabilityScore: q.identifiabilityScore,
        })),
      };
    } catch (e) {
      (results.pipelines as Record<string, unknown>).gauntlet = { error: String(e) };
    }
  }

  // ── Draft (Rank Order) — niche only ─────────────────────────────────────────
  if (tier === 'niche') {
    try {
      const t0 = Date.now();
      const res = await fetch(`${base}/api/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: 'Niche' }),
      });
      const data = await res.json();
      (results.pipelines as Record<string, unknown>).draft = {
        ms: Date.now() - t0,
        challenge: data.challenge,
      };
    } catch (e) {
      (results.pipelines as Record<string, unknown>).draft = { error: String(e) };
    }
  }

  return Response.json(results, {
    headers: { 'Content-Type': 'application/json' },
  });
}
