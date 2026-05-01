-- B36 — Qorixplay OAuth refresh tokens (rotation chain)
--
-- Adds the `quiz_oauth_refresh_tokens` table that backs the Qorixplay
-- /token-public + /refresh rotation flow. Without this, every Qorixplay
-- sign-in expires after 1h with no recovery (B35 issued only access_tokens).
--
-- Apply hand-written via psql against $NEON_DATABASE_URL (the Fly api-server
-- runtime DB — NOT $PROD_DATABASE_URL which points to heliumdb). Idempotent
-- (uses IF NOT EXISTS). PK type matches schema/quiz-oauth-refresh-tokens.ts
-- exactly: token_hash varchar(64), user_id integer (matches users.id type).
--
-- Reversibility: this is purely additive. No existing prod tables are
-- touched. Rollback = `DROP TABLE public.quiz_oauth_refresh_tokens;`.

BEGIN;

CREATE TABLE IF NOT EXISTS public.quiz_oauth_refresh_tokens (
  token_hash       varchar(64)  PRIMARY KEY,
  user_id          integer      NOT NULL
                                REFERENCES public.users(id) ON DELETE CASCADE,
  client_id        varchar(64)  NOT NULL DEFAULT 'qorixplay',
  scope            text         NOT NULL,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  expires_at       timestamptz  NOT NULL,
  used_at          timestamptz,
  replaced_by_hash varchar(64),
  revoked_at       timestamptz,
  issued_ip        varchar(64),
  issued_ua        text
);

CREATE INDEX IF NOT EXISTS idx_quiz_oauth_refresh_tokens_user_id
  ON public.quiz_oauth_refresh_tokens (user_id);

-- Partial index keyed on expires_at, restricted to live rows only. Used by
-- (a) the /refresh hot path (one row per presented token, but the WHERE
-- clause guards against scanning expired/revoked rows during cleanup
-- sweeps) and (b) the cleanup sweep that nukes expired rows nightly.
CREATE INDEX IF NOT EXISTS idx_quiz_oauth_refresh_tokens_active
  ON public.quiz_oauth_refresh_tokens (expires_at)
  WHERE used_at IS NULL AND revoked_at IS NULL;

COMMIT;
