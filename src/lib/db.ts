/**
 * PostgreSQL connection pool for YKB.
 * Set DATABASE_URL in your environment (Railway, Vercel, etc.).
 *
 * Schema: run /api/db-migrate (admin-only) to create tables.
 *
 * Firestore remains the primary auth/user store.
 * Postgres powers leaderboard queries, analytics, and fast aggregations.
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL environment variable is not set');
    pool = new Pool({
      connectionString: url,
      ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export const db = {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]) =>
    getPool().query<T>(sql, params),
  getPool,
};

export type Tier4 = 'easy' | 'medium' | 'hard' | 'niche';

// ── Upsert user tier stats ────────────────────────────────────────────────────
export async function upsertTierStats(
  uid: string,
  username: string,
  tier: Tier4,
  stats: {
    bestStreak:    number;
    todayStreak:   number;
    totalCorrect:  number;
    totalAnswered: number;
    lockoutDate:   string | null;
  },
) {
  await db.query(
    `INSERT INTO tier_stats (uid, username, tier, best_streak, today_streak, total_correct, total_answered, lockout_date, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (uid, tier)
     DO UPDATE SET
       username       = EXCLUDED.username,
       best_streak    = GREATEST(tier_stats.best_streak, EXCLUDED.best_streak),
       today_streak   = EXCLUDED.today_streak,
       total_correct  = GREATEST(tier_stats.total_correct, EXCLUDED.total_correct),
       total_answered = GREATEST(tier_stats.total_answered, EXCLUDED.total_answered),
       lockout_date   = EXCLUDED.lockout_date,
       updated_at     = NOW()`,
    [uid, username, tier, stats.bestStreak, stats.todayStreak, stats.totalCorrect, stats.totalAnswered, stats.lockoutDate],
  );
}

// ── Leaderboard query ─────────────────────────────────────────────────────────
export async function getLeaderboard(limit = 100) {
  const res = await db.query<{
    uid: string;
    username: string;
    tier: string;
    best_streak: number;
    today_streak: number;
    total_correct: number;
    total_answered: number;
  }>(
    `SELECT uid, username, tier, best_streak, today_streak, total_correct, total_answered
     FROM tier_stats
     WHERE total_answered > 0
     ORDER BY best_streak DESC, total_correct DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows;
}
