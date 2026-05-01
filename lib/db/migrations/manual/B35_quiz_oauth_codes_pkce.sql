-- B35 — Add PKCE (RFC 7636) columns to quiz_oauth_codes
--
-- Purpose: enable a browser-callable token-exchange endpoint
--   POST /api/oauth/quiz/token-public
-- so the qorix-quiz SPA frontend can complete the OAuth Authorization-Code
-- flow without holding a long-lived client_secret in the browser. The SPA
-- generates a one-time `code_verifier`, sends `code_challenge =
-- BASE64URL(SHA256(verifier))` at the /authorize step, then proves
-- possession at /token-public by sending the raw verifier. The server
-- recomputes the SHA-256 and compares against what was stored at /authorize.
--
-- The original confidential-client /token endpoint (server-to-server,
-- gated by client_secret) keeps working unchanged for any backend that
-- wants to use that flow.
--
-- Safety guarantees:
--   * Purely ADDITIVE: two new NULLABLE columns on an existing table.
--     Existing rows (mid-flight authorization codes) remain valid because
--     both columns are nullable; the application code treats the absence
--     of a code_challenge as "use the confidential client_secret flow."
--   * NO PK type changes anywhere (PK on quiz_oauth_codes is varchar(64)
--     and stays that way).
--   * IF NOT EXISTS on every ADD COLUMN so re-running is a no-op.
--   * Wrapped in a single BEGIN/COMMIT — partial failure rolls back.
--   * ZERO touches to existing 47 prod tables.
--
-- Apply with:
--   psql "$PROD_DATABASE_URL" -f lib/db/migrations/manual/B35_quiz_oauth_codes_pkce.sql
--
-- Reverse with (no prod data is migrated by this script):
--   psql "$PROD_DATABASE_URL" -c "ALTER TABLE quiz_oauth_codes
--     DROP COLUMN IF EXISTS code_challenge,
--     DROP COLUMN IF EXISTS code_challenge_method;"

BEGIN;

ALTER TABLE quiz_oauth_codes
    ADD COLUMN IF NOT EXISTS code_challenge VARCHAR(128);

ALTER TABLE quiz_oauth_codes
    ADD COLUMN IF NOT EXISTS code_challenge_method VARCHAR(10);

COMMIT;
