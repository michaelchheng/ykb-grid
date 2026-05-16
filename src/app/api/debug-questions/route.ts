/**
 * Debug endpoint — preview what questions each AI pipeline would serve.
 * Admin-only: requires ?key=YKB_ADMIN_2026
 *
 * GET /api/debug-questions?key=YKB_ADMIN_2026&tier=easy
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

  const results: Record<string, unknown> = { tier, pipelines: {}, nbaProbe: {} };

  // ── NBA API probe — check if the proxy actually works ───────────────────────
  try {
    const nbaParams = new URLSearchParams({
      endpoint: 'leagueLeaders', LeagueID: '00', PerMode: 'Totals',
      Scope: 'S', Season: '2023-24', SeasonType: 'Regular Season', StatCategory: 'PTS',
    });
    const t0 = Date.now();
    const nbaRes = await fetch(`${base}/api/nba?${nbaParams}`, { signal: AbortSignal.timeout(8000) });
    const nbaData = await nbaRes.json();
    const rs = nbaData.resultSet ?? nbaData.resultSets?.[0];
    const rowCount = rs?.rowSet?.length ?? 0;
    const headers = rs?.headers ?? [];
    (results.nbaProbe as Record<string, unknown>) = {
      ok: nbaRes.ok,
      status: nbaRes.status,
      ms: Date.now() - t0,
      rowCount,
      headers,
      firstRow: rs?.rowSet?.[0] ?? null,
      error: nbaData.error ?? null,
    };
  } catch (e) {
    (results.nbaProbe as Record<string, unknown>) = { error: String(e) };
  }

  // ── Comparison pipeline ─────────────────────────────────────────────────────
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
      error: data.error ?? null,
      matchupsUsed: data.matchupsUsed ?? null,
      questions: (data.questions ?? []).map((q: Record<string, unknown>) => ({
        id: q.id,
        stat: q.label,
        season: q.subLabel,
        playerA: (q.playerA as Record<string,unknown>)?.name,
        playerB: (q.playerB as Record<string,unknown>)?.name,
        valueA: q.valueA,
        valueB: q.valueB,
        flavor: q.flavor,
      })),
    };
  } catch (e) {
    (results.pipelines as Record<string, unknown>).comparison = { error: String(e) };
  }

  // ── Gauntlet pipeline — medium/hard/niche only ──────────────────────────────
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
        error: data.error ?? null,
        questions: (data.questions ?? []).map((q: Record<string, unknown>) => ({
          id: q.id,
          answer: q.answer,
          season: q.season,
          flavor: q.flavor,
          options: q.options,
          identifiabilityScore: q.identifiabilityScore,
        })),
      };
    } catch (e) {
      (results.pipelines as Record<string, unknown>).gauntlet = { error: String(e) };
    }
  }

  // ── Draft pipeline — niche only ─────────────────────────────────────────────
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
        error: data.error ?? null,
        challenge: data.challenge,
      };
    } catch (e) {
      (results.pipelines as Record<string, unknown>).draft = { error: String(e) };
    }
  }

  return Response.json(results);
}
