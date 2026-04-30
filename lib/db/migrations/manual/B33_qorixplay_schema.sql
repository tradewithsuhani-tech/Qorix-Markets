-- ============================================================================
-- B33: Qorixplay schema migration
-- ----------------------------------------------------------------------------
-- Greenfield create of all 13 quiz-domain tables + 3 enums + seed data for
-- geo blocks. Applied by hand via psql against NEON_DATABASE_URL — ZERO
-- db:push, ZERO PK type changes, ZERO destructive ALTERs, ZERO touches to
-- existing 42 prod tables.
--
-- Idempotency: every CREATE uses IF NOT EXISTS; enum CREATE wrapped in DO
-- block; seed data uses ON CONFLICT DO NOTHING. Safe to re-run.
--
-- Isolation: nothing in this script reads from or writes to any table
-- belonging to qorix-markets (users + transactions are the only existing
-- tables referenced, and only as FOREIGN KEY targets — read-only impact).
--
-- Reversibility: all 13 tables can be dropped with `DROP TABLE IF EXISTS …
-- CASCADE` (rollback script committed alongside this file would do that),
-- and the 3 enums dropped with `DROP TYPE IF EXISTS …`. No prod data is
-- migrated by this script — quiz tables are empty after this runs.
-- ============================================================================

BEGIN;

-- ─── 1. Enums ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE quiz_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quiz_question_source AS ENUM ('manual', 'ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE quiz_winner_paid_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 2. quiz_categories (lookup) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_categories (
  id          SERIAL PRIMARY KEY,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  icon        VARCHAR(50)  NOT NULL DEFAULT '',
  color       VARCHAR(20)  NOT NULL DEFAULT '#7C3AED',
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── 3. quizzes (existing 17 cols + 7 new B33 extension cols) ──────────────
CREATE TABLE IF NOT EXISTS quizzes (
  id                       SERIAL PRIMARY KEY,
  title                    VARCHAR(200) NOT NULL,
  description              TEXT         NOT NULL DEFAULT '',
  status                   quiz_status  NOT NULL DEFAULT 'scheduled',
  scheduled_start_at       TIMESTAMP    NOT NULL,
  started_at               TIMESTAMP,
  ended_at                 TIMESTAMP,
  prize_pool               NUMERIC(18,2) NOT NULL DEFAULT 0,
  prize_currency           VARCHAR(10)   NOT NULL DEFAULT 'USDT',
  prize_split              JSONB         NOT NULL DEFAULT '[0.5,0.3,0.2]'::jsonb,
  question_time_ms         INTEGER       NOT NULL DEFAULT 12000,
  entry_rules              JSONB         NOT NULL DEFAULT '{"requireKyc":true}'::jsonb,
  notify_enabled           BOOLEAN       NOT NULL DEFAULT TRUE,
  notified_five_min_at     TIMESTAMP,
  notified_live_at         TIMESTAMP,
  created_by               INTEGER       REFERENCES users(id) ON DELETE SET NULL,
  created_at               TIMESTAMP     NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMP     NOT NULL DEFAULT NOW(),
  -- B33 extension columns (all nullable / defaulted, additive only):
  entry_fee                NUMERIC(18,2) NOT NULL DEFAULT 0,
  max_players              INTEGER,
  platform_fee_pct         NUMERIC(5,2)  NOT NULL DEFAULT 10.00,
  gst_pct                  NUMERIC(5,2)  NOT NULL DEFAULT 28.00,
  auto_payout              BOOLEAN       NOT NULL DEFAULT TRUE,
  prize_pool_source        VARCHAR(20)   NOT NULL DEFAULT 'admin',
  category_id              INTEGER       REFERENCES quiz_categories(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS quizzes_status_start_idx ON quizzes (status, scheduled_start_at);
CREATE INDEX IF NOT EXISTS quizzes_category_idx ON quizzes (category_id);
CREATE INDEX IF NOT EXISTS quizzes_pool_source_idx ON quizzes (prize_pool_source);

-- ─── 4. quiz_questions (existing) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_questions (
  id            SERIAL PRIMARY KEY,
  quiz_id       INTEGER  NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position      INTEGER  NOT NULL,
  prompt        TEXT     NOT NULL,
  options       JSONB    NOT NULL,
  correct_index INTEGER  NOT NULL,
  explanation   TEXT     NOT NULL DEFAULT '',
  source        quiz_question_source NOT NULL DEFAULT 'manual',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_questions_quiz_position_uq ON quiz_questions (quiz_id, position);
CREATE INDEX        IF NOT EXISTS quiz_questions_quiz_idx ON quiz_questions (quiz_id);

-- ─── 5. quiz_participants (existing) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_participants (
  id        SERIAL PRIMARY KEY,
  quiz_id   INTEGER  NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id   INTEGER  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_participants_quiz_user_uq ON quiz_participants (quiz_id, user_id);
CREATE INDEX        IF NOT EXISTS quiz_participants_quiz_idx ON quiz_participants (quiz_id);

-- ─── 6. quiz_answers (existing) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_answers (
  id               SERIAL PRIMARY KEY,
  quiz_id          INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_id      INTEGER NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_option  INTEGER NOT NULL,
  is_correct       BOOLEAN NOT NULL,
  response_time_ms INTEGER NOT NULL,
  score_awarded    INTEGER NOT NULL,
  submitted_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_answers_user_question_uq ON quiz_answers (user_id, question_id);
CREATE INDEX        IF NOT EXISTS quiz_answers_quiz_user_idx    ON quiz_answers (quiz_id, user_id);

-- ─── 7. quiz_winners (existing — rank can be 1..10 in v1) ──────────────────
CREATE TABLE IF NOT EXISTS quiz_winners (
  id                SERIAL PRIMARY KEY,
  quiz_id           INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank              INTEGER NOT NULL,
  final_score       INTEGER NOT NULL,
  prize_amount      NUMERIC(18,2) NOT NULL,
  prize_currency    VARCHAR(10)   NOT NULL DEFAULT 'USDT',
  paid_status       quiz_winner_paid_status NOT NULL DEFAULT 'pending',
  paid_at           TIMESTAMP,
  paid_by_admin_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  paid_note         TEXT,
  paid_txn_id       INTEGER,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_winners_quiz_rank_uq ON quiz_winners (quiz_id, rank);
CREATE INDEX        IF NOT EXISTS quiz_winners_quiz_idx     ON quiz_winners (quiz_id);

-- ─── 8. quiz_devices (NEW — anti-cheat v1.5 review queue) ─────────────────
CREATE TABLE IF NOT EXISTS quiz_devices (
  id                       SERIAL PRIMARY KEY,
  user_id                  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id                  INTEGER          REFERENCES quizzes(id) ON DELETE CASCADE,
  device_fingerprint       VARCHAR(128) NOT NULL DEFAULT '',
  user_agent               TEXT         NOT NULL DEFAULT '',
  ip_address               VARCHAR(45)  NOT NULL DEFAULT '',
  tab_visibility_changes   INTEGER      NOT NULL DEFAULT 0,
  suspicious_flags         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at               TIMESTAMP    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quiz_devices_user_quiz_idx ON quiz_devices (user_id, quiz_id);
CREATE INDEX IF NOT EXISTS quiz_devices_quiz_idx      ON quiz_devices (quiz_id);

-- ─── 9. quiz_events_log (NEW — audit log) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_events_log (
  id             SERIAL PRIMARY KEY,
  quiz_id        INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  event_type     VARCHAR(50) NOT NULL,
  actor_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quiz_events_log_quiz_time_idx ON quiz_events_log (quiz_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quiz_events_log_type_idx      ON quiz_events_log (event_type);

-- ─── 10. quiz_user_stats (NEW — leaderboard aggregates) ───────────────────
CREATE TABLE IF NOT EXISTS quiz_user_stats (
  user_id                  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  quizzes_played           INTEGER NOT NULL DEFAULT 0,
  quizzes_won              INTEGER NOT NULL DEFAULT 0,
  top_3_finishes           INTEGER NOT NULL DEFAULT 0,
  top_10_finishes          INTEGER NOT NULL DEFAULT 0,
  total_correct_answers    INTEGER NOT NULL DEFAULT 0,
  total_questions_answered INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms     INTEGER NOT NULL DEFAULT 0,
  total_winnings_inr       NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_winnings_usdt      NUMERIC(18,2) NOT NULL DEFAULT 0,
  current_streak_days      INTEGER NOT NULL DEFAULT 0,
  longest_streak_days      INTEGER NOT NULL DEFAULT 0,
  last_played_at           TIMESTAMP,
  updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quiz_user_stats_winnings_inr_idx  ON quiz_user_stats (total_winnings_inr DESC);
CREATE INDEX IF NOT EXISTS quiz_user_stats_winnings_usdt_idx ON quiz_user_stats (total_winnings_usdt DESC);

-- ─── 11. quiz_payouts (NEW — actual prize payout ledger w/ TDS) ───────────
CREATE TABLE IF NOT EXISTS quiz_payouts (
  id              SERIAL PRIMARY KEY,
  quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  winner_id       INTEGER          REFERENCES quiz_winners(id) ON DELETE SET NULL,
  gross_amount    NUMERIC(18,2) NOT NULL,
  tds_amount      NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_amount      NUMERIC(18,2) NOT NULL,
  currency        VARCHAR(10)   NOT NULL,
  transaction_id  INTEGER          REFERENCES transactions(id) ON DELETE SET NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending',
  failure_reason  TEXT,
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_payouts_quiz_user_uq ON quiz_payouts (quiz_id, user_id);
CREATE INDEX        IF NOT EXISTS quiz_payouts_status_idx   ON quiz_payouts (status);

-- ─── 12. quiz_refunds (NEW — refund-on-cancel ledger) ─────────────────────
CREATE TABLE IF NOT EXISTS quiz_refunds (
  id              SERIAL PRIMARY KEY,
  quiz_id         INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  amount          NUMERIC(18,2) NOT NULL,
  currency        VARCHAR(10)   NOT NULL,
  reason          TEXT          NOT NULL DEFAULT '',
  transaction_id  INTEGER          REFERENCES transactions(id) ON DELETE SET NULL,
  status          VARCHAR(20)   NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMP     NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_refunds_quiz_user_uq ON quiz_refunds (quiz_id, user_id);
CREATE INDEX        IF NOT EXISTS quiz_refunds_status_idx   ON quiz_refunds (status);

-- ─── 13. oauth_authorization_codes (NEW — SSO from qorixmarkets) ──────────
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(64) NOT NULL UNIQUE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     VARCHAR(64) NOT NULL,
  redirect_uri  TEXT        NOT NULL,
  scope         VARCHAR(200) NOT NULL DEFAULT '',
  expires_at    TIMESTAMP   NOT NULL,
  used_at       TIMESTAMP,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS oauth_codes_user_exp_idx ON oauth_authorization_codes (user_id, expires_at);
CREATE INDEX IF NOT EXISTS oauth_codes_client_idx   ON oauth_authorization_codes (client_id);

-- ─── 14. quiz_geo_blocks (NEW — paid quiz state allowlist) ────────────────
CREATE TABLE IF NOT EXISTS quiz_geo_blocks (
  id              SERIAL PRIMARY KEY,
  state_code      VARCHAR(10)  NOT NULL UNIQUE,
  state_name      VARCHAR(100) NOT NULL,
  blocks_paid     BOOLEAN      NOT NULL DEFAULT TRUE,
  blocks_practice BOOLEAN      NOT NULL DEFAULT FALSE,
  reason          TEXT         NOT NULL DEFAULT '',
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ─── 15. Seed default geo blocks (5 Indian states) ────────────────────────
INSERT INTO quiz_geo_blocks (state_code, state_name, blocks_paid, blocks_practice, reason) VALUES
  ('TN', 'Tamil Nadu',      TRUE, FALSE, 'TN Prohibition of Online Gambling and Regulation of Online Games Act, 2022'),
  ('AP', 'Andhra Pradesh',  TRUE, FALSE, 'AP Gaming (Amendment) Act, 2020'),
  ('TG', 'Telangana',       TRUE, FALSE, 'TG Gaming (Amendment) Act, 2017'),
  ('OR', 'Odisha',          TRUE, FALSE, 'Odisha Prevention of Gambling Act, 1955'),
  ('SK', 'Sikkim',          TRUE, FALSE, 'Sikkim Online Gaming (Regulation) Act, 2008 — license required')
ON CONFLICT (state_code) DO NOTHING;

-- ─── 16. Seed default quiz categories ─────────────────────────────────────
INSERT INTO quiz_categories (slug, name, description, icon, color, sort_order) VALUES
  ('crypto',     'Crypto',           'Bitcoin, Ethereum, DeFi, blockchain fundamentals',  '₿', '#F7931A',  10),
  ('markets',    'Stock Markets',    'Indian + global equity markets, indices, IPOs',     '📈','#10B981',  20),
  ('forex',      'Forex',            'Currency pairs, central banks, macro',              '💱','#3B82F6',  30),
  ('finance',    'Personal Finance', 'Budgeting, taxes, mutual funds, retirement',        '💰','#FACC15',  40),
  ('trivia',     'General Trivia',   'Mixed-topic warm-up rounds',                        '🎲','#A855F7',  50),
  ('practice',   'Practice',         'Free practice quizzes (no entry fee, no payout)',   '🎯','#6B7280',  99)
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- ─── Verify counts (run separately, NOT inside the txn) ────────────────────
-- SELECT 'quiz_categories' AS t, COUNT(*) FROM quiz_categories UNION ALL
-- SELECT 'quiz_geo_blocks',       COUNT(*) FROM quiz_geo_blocks;
