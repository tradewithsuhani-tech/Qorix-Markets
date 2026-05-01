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

// ─── Qorixplay OAuth Refresh Tokens (B36) ────────────────────────────────
// Long-lived (30d) rotated refresh tokens for the Qorixplay PKCE flow.
//
// Why: B35 issued only 1h access_tokens with no refresh path, so users were
// silently signed out every hour. This table backs the rotation chain:
//
//   1. /token-public  → issues access_token (1h) + refresh_token (30d).
//                       The plaintext refresh_token is returned ONCE and
//                       only the SHA-256 hash is persisted here.
//   2. /refresh        → SPA presents the plaintext refresh_token. Server
//                       hashes it, looks up the row, marks it `used_at`
//                       atomically (`WHERE used_at IS NULL AND revoked_at
//                       IS NULL`), inserts a NEW row, sets the old row's
//                       `replaced_by_hash` to the new hash, returns a fresh
//                       (access_token, refresh_token) pair.
//
// Rotation is mandatory — every refresh burns the presented token and
// issues a brand-new one. If an attacker ever uses a stolen refresh_token
// the legitimate client's next refresh will fail with `invalid_grant` and
// we log the breach (token reuse detection).
//
// PK is the SHA-256 hash itself (varchar(64), 64 hex chars) — never the
// plaintext. ON DELETE CASCADE cleans up tokens if a user is purged.
export const quizOauthRefreshTokensTable = pgTable(
  "quiz_oauth_refresh_tokens",
  {
    /** SHA-256 hex of the plaintext refresh_token. We never store the
     *  plaintext, so a database leak does not let the attacker forge
     *  /refresh requests. 64 hex chars = 256 bits of entropy. */
    tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    clientId: varchar("client_id", { length: 64 })
      .notNull()
      .default("qorixplay"),
    scope: text("scope").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** 30 days from issue. Hard cap — even a continually-rotated chain
     *  can't be alive past the original chain's start + (rotation count
     *  × 30d), because each rotation issues a *new* row with its own
     *  expires_at. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set when this token is presented to /refresh. NULL = still active.
     *  The atomic UPDATE `... WHERE token_hash = $1 AND used_at IS NULL
     *  AND revoked_at IS NULL` ensures replay-safety. */
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** When this row is rotated, points to the new row's `token_hash`.
     *  Lets us audit the rotation chain and (later) detect token-reuse
     *  attacks: if a row that already has `used_at + replaced_by_hash`
     *  is presented to /refresh again, that's a stolen-token signal. */
    replacedByHash: varchar("replaced_by_hash", { length: 64 }),
    /** Set if a user logs out, the row is suspected stolen, or admin
     *  forces a session revocation. Independent of `used_at` — a token
     *  can be revoked before it has been used. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** Captured at issue time for forensics on suspicious rotations. */
    issuedIp: varchar("issued_ip", { length: 64 }),
    issuedUa: text("issued_ua"),
  },
  (t) => ({
    userIdIdx: index("idx_quiz_oauth_refresh_tokens_user_id").on(t.userId),
    // Partial index — used by the cleanup sweep to delete expired rows
    // and by the /refresh hot-path lookup which only cares about active
    // rows. WHERE clause keeps the index small (only ~current users).
    activeIdx: index("idx_quiz_oauth_refresh_tokens_active").on(t.expiresAt),
  }),
);
