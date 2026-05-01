import {
  pgTable,
  integer,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { usersTable } from "./users";

// ─── Quiz OAuth Authorization Codes ───────────────────────────────────────
// Short-lived (60s) one-time-use authorization codes for the OAuth 2.0
// Authorization Code grant that lets qorixplay.com authenticate users via
// their existing Qorix Markets account (B34 — Qorixplay SSO).
//
// Flow:
//   1. User on qorixplay.com clicks "Sign in with Qorix"
//   2. Browser is redirected to qorixmarkets.com → user logs in (or is
//      already logged in) → consent screen → on approval, Markets calls
//      POST /api/oauth/quiz/authorize (user-session gated). API mints a
//      32-byte random `code`, stores it here with `expires_at = now()+60s`.
//   3. Markets redirects browser to the qorixplay callback URL with `?code=`.
//   4. qorixplay BACKEND calls POST /api/oauth/quiz/token (server-to-server,
//      gated by client_secret). API atomically marks the code used
//      (`UPDATE ... WHERE used_at IS NULL` — replay-safe) and returns the
//      user profile + a short-lived JWT scoped to qorixplay.
//
// PK is the `code` itself (VARCHAR(64), 32 bytes hex) — there's no
// independent autoincrement id because each code is single-use and we never
// query by row index. ON DELETE CASCADE cleans up codes if a user is purged.
export const quizOauthCodesTable = pgTable(
  "quiz_oauth_codes",
  {
    code: varchar("code", { length: 64 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull().default("qorixplay"),
    scope: text("scope").notNull().default("profile email kyc"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set on first /token exchange. NULL = unused. The atomic UPDATE
     *  `... WHERE code = $1 AND used_at IS NULL` ensures replay-safety. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** PKCE (RFC 7636) — BASE64URL(SHA256(code_verifier)) supplied by the
     *  client at /authorize. NULL means the caller did not opt into PKCE
     *  and must redeem the code via the confidential-client /token flow
     *  (server-to-server with client_secret). When non-NULL, the code can
     *  ONLY be redeemed via /token-public by presenting the matching
     *  code_verifier — which lets a browser SPA complete the flow without
     *  ever holding a long-lived client_secret. (B35) */
    codeChallenge: varchar("code_challenge", { length: 128 }),
    /** Always "S256" today — we deliberately do NOT support the "plain"
     *  PKCE method because it provides no protection against an attacker
     *  who can read the verifier in transit. (B35) */
    codeChallengeMethod: varchar("code_challenge_method", { length: 10 }),
  },
  (t) => ({
    userIdIdx: index("idx_quiz_oauth_codes_user_id").on(t.userId),
    // Partial index on (expires_at) WHERE used_at IS NULL — used by the
    // periodic cleanup sweep to delete expired-and-unused codes cheaply.
    expiresAtIdx: index("idx_quiz_oauth_codes_expires_at").on(t.expiresAt),
  }),
);
