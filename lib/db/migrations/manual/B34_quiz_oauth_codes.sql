-- B34 — Qorixplay OAuth SSO authorization codes table
--
-- This file documents the hand-written SQL that was applied to prod via psql
-- on 2026-04-30 to back the OAuth Authorization-Code flow used by qorixplay.com
-- to authenticate Qorix Markets users (see artifacts/api-server/src/routes/oauth-quiz.ts).
--
-- The table already exists in production. This file is checked in idempotently
-- (every statement is IF NOT EXISTS-guarded inside a transaction) so the repo
-- accurately reflects history, disaster-recovery rebuilds work, and the
-- Drizzle schema in lib/db/src/schema/quiz-oauth-codes.ts has a paired
-- migration of record.
--
-- Safety guarantees:
--   * Purely ADDITIVE: only one new table, no ALTER TABLE on any existing
--     table, no PK type changes anywhere.
--   * IF NOT EXISTS on every CREATE so re-running this script in any env is
--     a no-op when the table is already present.
--   * Wrapped in a single BEGIN/COMMIT so a partial failure rolls back.
--   * ZERO touches to existing 47 prod tables (verified: USERS=8 / TXNS=20
--     unchanged before and after).
--
-- Apply with:
--   psql "$PROD_DATABASE_URL" -f lib/db/migrations/manual/B34_quiz_oauth_codes.sql
--
-- Reverse with (no prod data is migrated by this script):
--   psql "$PROD_DATABASE_URL" -c "DROP TABLE IF EXISTS quiz_oauth_codes;"

BEGIN;

CREATE TABLE IF NOT EXISTS quiz_oauth_codes (
    code         VARCHAR(64)              NOT NULL PRIMARY KEY,
    user_id      INTEGER                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT                     NOT NULL,
    client_id    VARCHAR(64)              NOT NULL DEFAULT 'qorixplay',
    scope        TEXT                     NOT NULL DEFAULT 'profile email kyc',
    expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at      TIMESTAMP WITH TIME ZONE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Partial index — only unused codes need fast lookup by expiry (for sweep jobs).
CREATE INDEX IF NOT EXISTS idx_quiz_oauth_codes_expires_at
    ON quiz_oauth_codes (expires_at)
    WHERE used_at IS NULL;

-- For per-user audit / revoke-all-sessions in the future.
CREATE INDEX IF NOT EXISTS idx_quiz_oauth_codes_user_id
    ON quiz_oauth_codes (user_id);

COMMIT;
