/**
 * smoke-test-account.ts
 * ──────────────────────────────────────────────────────
 * Helpers for the dedicated post-deploy smoke-test account
 * (SMOKE_TEST_EMAIL in .github/workflows/deploy.yml).
 *
 * The smoke-test user logs in on every deploy to prove the auth pipeline is
 * healthy. To make sure that account can never accidentally pollute real
 * production data — leaderboards, referral payouts, fraud signals, on-chain
 * deposits, withdrawals, etc. — we tag the account with `users.is_smoke_test`
 * and honor that flag everywhere money or user-visible stats are touched.
 *
 * See docs/smoke-test-account.md for the operator-facing details.
 */

import { db, usersTable } from "@workspace/db";
import { eq, ne, or, isNull, sql, type SQL } from "drizzle-orm";
import { logger } from "./logger";

/**
 * SQL predicate that excludes the smoke-test account from a query against
 * `usersTable`. Treats NULL as "not a smoke-test account" so older rows
 * (before the column was added) keep showing up normally.
 *
 * Use in admin-facing list/count queries that should not surface the deploy
 * smoke-test account by default. See docs/smoke-test-account.md.
 */
export function notSmokeTestUser(): SQL {
  return or(ne(usersTable.isSmokeTest, true), isNull(usersTable.isSmokeTest))!;
}

/**
 * Parses a request query value (string | string[] | undefined) and returns
 * true when the admin has opted in to seeing the smoke-test account in a
 * list/queue. Accepts the common truthy spellings (`1`, `true`, `yes`, `on`).
 */
export function shouldIncludeSmokeTest(raw: unknown): boolean {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

// ---------------------------------------------------------------------------
// Tiny in-process cache. The flag is set once at startup and never flips back
// to false at runtime, so caching it for a short window is safe and lets us
// add the per-request "is this the smoke account?" check on hot paths
// (deposit credit, withdraw, transfer) without a DB round-trip every time.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 60 * 1000; // 1 minute

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}
const cache = new Map<number, CacheEntry>();

function cacheGet(userId: number): boolean | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(userId);
    return null;
  }
  return entry.value;
}

function cacheSet(userId: number, value: boolean): void {
  cache.set(userId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Returns true when the given user is the dedicated deploy smoke-test account.
 * Safe to call on hot paths — result is cached in-process for 60 seconds.
 */
export async function isSmokeTestUser(userId: number): Promise<boolean> {
  const cached = cacheGet(userId);
  if (cached !== null) return cached;

  try {
    const rows = await db
      .select({ isSmokeTest: usersTable.isSmokeTest })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    const value = rows[0]?.isSmokeTest === true;
    cacheSet(userId, value);
    return value;
  } catch (err) {
    // On error, fail closed — treat as smoke-test if we can't tell, to err on
    // the side of NOT processing real-money flows. (The hot paths use this
    // result to *block* a write; a false positive is annoying but safe.)
    logger.warn({ err, userId }, "smoke-test-account: lookup failed, failing closed");
    return true;
  }
}

/**
 * Idempotent startup hook. Reads SMOKE_TEST_EMAIL from the environment and
 * sets `users.is_smoke_test = true` on that account if it exists.
 *
 * Logs (but does not fail startup) when:
 *   - SMOKE_TEST_EMAIL is unset (e.g. local dev)
 *   - the account does not exist in this database (e.g. before first signup)
 *
 * The deploy workflow signs that account in on every deploy, so this seeder
 * runs every time the api-server boots and converges the flag without manual
 * intervention.
 */
export async function flagSmokeTestAccount(): Promise<void> {
  const email = (process.env["SMOKE_TEST_EMAIL"] ?? "").trim().toLowerCase();
  if (!email) {
    logger.info(
      "smoke-test-account: SMOKE_TEST_EMAIL not set — skipping smoke-test flag bootstrap.",
    );
    return;
  }

  try {
    // Clear the flag on any other account (in case the smoke account email
    // was rotated) and set it on the configured one. A single statement so
    // there's no window where both accounts are flagged.
    const result = await db.execute(sql`
      WITH cleared AS (
        UPDATE users
        SET is_smoke_test = false
        WHERE is_smoke_test = true AND lower(email) <> lower(${email})
        RETURNING id
      ),
      flagged AS (
        UPDATE users
        SET is_smoke_test = true
        WHERE lower(email) = lower(${email}) AND is_smoke_test = false
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*) FROM cleared)::int AS cleared_count,
        (SELECT COUNT(*) FROM flagged)::int AS flagged_count
    `);
    const row = result.rows[0] as { cleared_count: number; flagged_count: number } | undefined;
    const cleared = Number(row?.cleared_count ?? 0);
    const flagged = Number(row?.flagged_count ?? 0);

    // Always invalidate the in-process cache after a write so workers that
    // have already cached "false" pick up the new flag immediately.
    cache.clear();

    if (flagged > 0) {
      logger.info({ email, cleared, flagged }, "smoke-test-account: flagged account is_smoke_test=true");
    } else if (cleared > 0) {
      logger.warn({ email, cleared }, "smoke-test-account: cleared stale flag(s); configured account not found yet");
    } else {
      logger.info({ email }, "smoke-test-account: no changes (account not found or already flagged)");
    }
  } catch (err) {
    logger.warn({ err }, "smoke-test-account: failed to bootstrap is_smoke_test flag");
  }
}
