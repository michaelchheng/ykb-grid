-- YKB PostgreSQL schema
-- Run once on your Postgres instance, or hit /api/db-migrate (admin-only endpoint)

CREATE TABLE IF NOT EXISTS users (
  uid         TEXT PRIMARY KEY,
  username    TEXT NOT NULL DEFAULT '',
  email       TEXT,
  photo_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tier_stats (
  uid           TEXT        NOT NULL,
  tier          TEXT        NOT NULL CHECK (tier IN ('easy','medium','hard','niche')),
  username      TEXT        NOT NULL DEFAULT '',
  best_streak   INT         NOT NULL DEFAULT 0,
  today_streak  INT         NOT NULL DEFAULT 0,
  total_correct INT         NOT NULL DEFAULT 0,
  total_answered INT        NOT NULL DEFAULT 0,
  lockout_date  DATE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (uid, tier)
);

-- Fast leaderboard lookups
CREATE INDEX IF NOT EXISTS idx_tier_stats_best   ON tier_stats (best_streak DESC);
CREATE INDEX IF NOT EXISTS idx_tier_stats_uid     ON tier_stats (uid);
CREATE INDEX IF NOT EXISTS idx_tier_stats_tier    ON tier_stats (tier);

-- Question feedback / analytics
CREATE TABLE IF NOT EXISTS question_feedback (
  id                  BIGSERIAL PRIMARY KEY,
  question_id         TEXT        NOT NULL,
  difficulty          TEXT        NOT NULL,
  answer              TEXT,
  correct             BOOLEAN     NOT NULL,
  time_to_answer_ms   INT,
  identifiability_score FLOAT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qfeedback_question_id ON question_feedback (question_id);
CREATE INDEX IF NOT EXISTS idx_qfeedback_difficulty  ON question_feedback (difficulty);
