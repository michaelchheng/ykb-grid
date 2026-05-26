/**
 * POST /api/sync-stats
 * Called client-side (fire-and-forget) to persist tier stats to Postgres.
 * Requires Firebase ID token for authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { upsertTierStats, type Tier4 } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      idToken:       string;
      username:      string;
      tier:          Tier4;
      bestStreak:    number;
      todayStreak:   number;
      totalCorrect:  number;
      totalAnswered: number;
      lockoutDate:   string | null;
    };

    if (!body.idToken) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(body.idToken);
    const uid = decoded.uid;

    await upsertTierStats(uid, body.username || uid.slice(0, 8), body.tier, {
      bestStreak:    body.bestStreak    ?? 0,
      todayStreak:   body.todayStreak   ?? 0,
      totalCorrect:  body.totalCorrect  ?? 0,
      totalAnswered: body.totalAnswered ?? 0,
      lockoutDate:   body.lockoutDate   ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('sync-stats error', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
