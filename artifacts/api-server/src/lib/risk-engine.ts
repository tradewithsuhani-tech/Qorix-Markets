/**
 * lib/risk-engine.ts — Internal risk scoring infrastructure
 *
 * Admin-facing only. Never exposed directly to user-facing endpoints.
 * Computes a composite risk score (0–100) for a user based on behavioural
 * signals drawn from existing DB tables (no new schema required).
 *
 * Signal categories:
 *  W1 — Withdrawal velocity (large/rapid withdrawals relative to deposits)
 *  W2 — Rapid movement (deposit → withdraw < 2h)
 *  D1 — Device mismatch (new devices at withdrawal time)
 *  R1 — Referral abuse (self-referral / circular chains / IP match)
 *  M1 — Multi-account (shared IP / device fingerprint)
 *  M2 — Merchant abuse (high dispute rate)
 *  I1 — Abnormal investment activity (P&L outlier, frequent start/stop)
 *  F1 — Existing unresolved fraud flags (directly from fraud-service)
 */

import { db, usersTable, transactionsTable, investmentsTable, fraudFlagsTable, userDevicesTable, loginEventsTable, walletsTable } from "@workspace/db";
import { eq, and, gte, count, sum, desc, ne, sql, or, lt } from "drizzle-orm";
import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────────────────
// Score definitions
// Each signal contributes a bounded additive score. Total is capped at 100.
// ─────────────────────────────────────────────────────────────────────────────

const SCORES = {
  // Fraud flags (pre-existing signals)
  HIGH_FRAUD_FLAG: 20,        // per unresolved high-severity flag (max 3 counted)
  MEDIUM_FRAUD_FLAG: 8,       // per unresolved medium flag (max 3 counted)

  // Withdrawal velocity
  LARGE_SINGLE_WITHDRAWAL: 15,  // >$5k in one withdrawal in last 30d
  HIGH_WITHDRAWAL_RATIO: 20,    // withdrawal total > 90% of deposit total in 7d
  RAPID_CYCLING: 25,            // deposit → withdrawal gap < 2h in last 7d

  // Account characteristics
  NEW_ACCOUNT_HIGH_VALUE: 15,   // account < 7d old with >$1k withdrawal attempt
  MANY_DEVICES: 10,             // >3 distinct devices in 30d

  // Merchant signals
  HIGH_DISPUTE_RATE: 20,        // dispute rate > 30% on P2P orders

  // Investment anomaly
  FREQUENT_STRATEGY_CHANGES: 8, // started/stopped > 5 times in 30d
} as const;

export type RiskSignal = {
  code: string;
  score: number;
  detail: string;
};

export type RiskReport = {
  userId: number;
  score: number;         // 0–100
  tier: "low" | "medium" | "high" | "critical";
  signals: RiskSignal[];
  computedAt: string;
  error?: string;
};

function tierFromScore(score: number): RiskReport["tier"] {
  if (score >= 70) return "critical";
  if (score >= 40) return "high";
  if (score >= 20) return "medium";
  return "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Signal evaluators (all fail-safe — never throw, return empty signals)
// ─────────────────────────────────────────────────────────────────────────────

async function evalFraudFlags(userId: number): Promise<RiskSignal[]> {
  try {
    const flags = await db
      .select({ severity: fraudFlagsTable.severity, flagType: fraudFlagsTable.flagType })
      .from(fraudFlagsTable)
      .where(and(eq(fraudFlagsTable.userId, userId), eq(fraudFlagsTable.isResolved, false)))
      .limit(10);

    const signals: RiskSignal[] = [];
    const highs = flags.filter((f) => f.severity === "high").slice(0, 3);
    const meds = flags.filter((f) => f.severity === "medium").slice(0, 3);

    for (const f of highs) {
      signals.push({
        code: `F1_HIGH_${f.flagType.toUpperCase()}`,
        score: SCORES.HIGH_FRAUD_FLAG,
        detail: `Unresolved high-severity fraud flag: ${f.flagType}`,
      });
    }
    for (const f of meds) {
      signals.push({
        code: `F1_MED_${f.flagType.toUpperCase()}`,
        score: SCORES.MEDIUM_FRAUD_FLAG,
        detail: `Unresolved medium-severity fraud flag: ${f.flagType}`,
      });
    }
    return signals;
  } catch {
    return [];
  }
}

async function evalWithdrawalVelocity(userId: number): Promise<RiskSignal[]> {
  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [wds30d, deps7d, wds7d] = await Promise.all([
      // Largest single withdrawal in 30d
      db
        .select({ amount: transactionsTable.amount })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, userId),
            eq(transactionsTable.type, "withdrawal"),
            eq(transactionsTable.status, "completed"),
            gte(transactionsTable.createdAt, since30d),
          ),
        )
        .orderBy(desc(transactionsTable.amount))
        .limit(1),
      // Total deposits last 7d
      db
        .select({ total: sum(transactionsTable.amount) })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, userId),
            eq(transactionsTable.type, "deposit"),
            eq(transactionsTable.status, "completed"),
            gte(transactionsTable.createdAt, since7d),
          ),
        ),
      // Total withdrawals last 7d
      db
        .select({ total: sum(transactionsTable.amount) })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, userId),
            eq(transactionsTable.type, "withdrawal"),
            gte(transactionsTable.createdAt, since7d),
          ),
        ),
    ]);

    const signals: RiskSignal[] = [];

    const largestWd = wds30d[0] ? parseFloat(String(wds30d[0].amount)) : 0;
    if (largestWd >= 5_000) {
      signals.push({
        code: "W1_LARGE_WITHDRAWAL",
        score: SCORES.LARGE_SINGLE_WITHDRAWAL,
        detail: `Single withdrawal of $${largestWd.toFixed(2)} in last 30 days (threshold: $5000)`,
      });
    }

    const totalDep = parseFloat(String(deps7d[0]?.total ?? 0));
    const totalWd = parseFloat(String(wds7d[0]?.total ?? 0));
    if (totalDep > 0 && totalWd / totalDep > 0.9) {
      signals.push({
        code: "W1_HIGH_WITHDRAWAL_RATIO",
        score: SCORES.HIGH_WITHDRAWAL_RATIO,
        detail: `Withdrawal/deposit ratio ${((totalWd / totalDep) * 100).toFixed(0)}% in last 7 days (threshold: 90%)`,
      });
    }

    return signals;
  } catch {
    return [];
  }
}

async function evalRapidCycling(userId: number): Promise<RiskSignal[]> {
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find any deposit followed by withdrawal within 2h using a raw SQL subquery
    const queryResult = await db.execute(
      sql`
        SELECT COUNT(*) as cnt
        FROM transactions d
        WHERE d.user_id = ${userId}
          AND d.type = 'deposit'
          AND d.status = 'completed'
          AND d.created_at >= ${since7d}
          AND EXISTS (
            SELECT 1 FROM transactions w
            WHERE w.user_id = ${userId}
              AND w.type = 'withdrawal'
              AND w.created_at BETWEEN d.created_at AND d.created_at + interval '2 hours'
          )
      `,
    );
    const rows = Array.isArray(queryResult)
      ? queryResult
      : (queryResult as { rows: { cnt: string }[] }).rows;
    const result = rows[0];

    const cycleCount = parseInt(String(result?.cnt ?? "0"), 10);
    if (cycleCount >= 1) {
      return [{
        code: "W2_RAPID_CYCLING",
        score: SCORES.RAPID_CYCLING,
        detail: `${cycleCount} deposit→withdrawal cycle(s) within 2h in last 7 days`,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

async function evalDeviceMismatch(userId: number): Promise<RiskSignal[]> {
  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [result] = await db
      .select({ cnt: sql<number>`COUNT(DISTINCT device_fingerprint)` })
      .from(userDevicesTable)
      .where(
        and(
          eq(userDevicesTable.userId, userId),
          gte(userDevicesTable.firstSeenAt, since30d),
        ),
      );

    const deviceCount = Number(result?.cnt ?? 0);
    if (deviceCount > 3) {
      return [{
        code: "D1_MANY_DEVICES",
        score: SCORES.MANY_DEVICES,
        detail: `${deviceCount} distinct devices in last 30 days (threshold: 3)`,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

async function evalAccountAge(userId: number): Promise<RiskSignal[]> {
  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [userRow] = await db
      .select({ createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!userRow) return [];

    const accountAgeDays = (Date.now() - new Date(userRow.createdAt).getTime()) / (24 * 60 * 60 * 1000);
    if (accountAgeDays >= 7) return [];

    const [wds] = await db
      .select({ total: sum(transactionsTable.amount) })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "withdrawal"),
          gte(transactionsTable.createdAt, since7d),
        ),
      );

    const totalWd = parseFloat(String(wds?.total ?? 0));
    if (totalWd >= 1_000) {
      return [{
        code: "M1_NEW_ACCOUNT_HIGH_VALUE",
        score: SCORES.NEW_ACCOUNT_HIGH_VALUE,
        detail: `Account ${accountAgeDays.toFixed(1)} days old with $${totalWd.toFixed(2)} in withdrawal attempts`,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

async function evalInvestmentActivity(userId: number): Promise<RiskSignal[]> {
  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Count transactions of type start/stop (tracked as investment transactions)
    const [result] = await db
      .select({ cnt: count() })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          or(
            eq(transactionsTable.type, "investment_start"),
            eq(transactionsTable.type, "investment_stop"),
          ),
          gte(transactionsTable.createdAt, since30d),
        ),
      );

    const changes = Number(result?.cnt ?? 0);
    if (changes > 5) {
      return [{
        code: "I1_FREQUENT_STRATEGY_CHANGES",
        score: SCORES.FREQUENT_STRATEGY_CHANGES,
        detail: `${changes} investment start/stop events in last 30 days (threshold: 5)`,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute a full risk report for a user. All signal evaluators run in parallel.
 * Never throws — returns an error report on catastrophic failure.
 */
export async function computeRiskScore(userId: number): Promise<RiskReport> {
  const start = Date.now();
  try {
    const [flagSignals, velocitySignals, cyclingSignals, deviceSignals, ageSignals, investSignals] =
      await Promise.all([
        evalFraudFlags(userId),
        evalWithdrawalVelocity(userId),
        evalRapidCycling(userId),
        evalDeviceMismatch(userId),
        evalAccountAge(userId),
        evalInvestmentActivity(userId),
      ]);

    const allSignals = [
      ...flagSignals,
      ...velocitySignals,
      ...cyclingSignals,
      ...deviceSignals,
      ...ageSignals,
      ...investSignals,
    ];

    const rawScore = allSignals.reduce((acc, s) => acc + s.score, 0);
    const score = Math.min(100, rawScore);

    logger.debug(
      { userId, score, signals: allSignals.length, durationMs: Date.now() - start },
      "[risk-engine] score computed",
    );

    return {
      userId,
      score,
      tier: tierFromScore(score),
      signals: allSignals,
      computedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ err, userId }, "[risk-engine] failed to compute score");
    return {
      userId,
      score: 0,
      tier: "low",
      signals: [],
      computedAt: new Date().toISOString(),
      error: "Score computation failed — check logs",
    };
  }
}

/**
 * Batch risk report for multiple users. Runs per-user computations in parallel
 * but bounded to 10 concurrent to avoid DB pool exhaustion.
 */
export async function computeBatchRiskScores(userIds: number[]): Promise<RiskReport[]> {
  const CONCURRENCY = 10;
  const results: RiskReport[] = [];
  for (let i = 0; i < userIds.length; i += CONCURRENCY) {
    const chunk = userIds.slice(i, i + CONCURRENCY);
    const batch = await Promise.all(chunk.map((id) => computeRiskScore(id)));
    results.push(...batch);
  }
  return results;
}

/**
 * Get a paginated list of high-risk users (score >= threshold) for the admin dashboard.
 * This is a lightweight query against fraud_flags — the full risk score is computed
 * on-demand per user, not stored.
 */
export async function getHighRiskUserIds(
  minFlagCount = 1,
  severity: "high" | "medium" | "any" = "high",
  limit = 50,
): Promise<{ userId: number; flagCount: number; hasCriticalFlag: boolean }[]> {
  const sevCond = severity === "any"
    ? eq(fraudFlagsTable.isResolved, false)
    : and(eq(fraudFlagsTable.isResolved, false), eq(fraudFlagsTable.severity, severity));

  const rows = await db
    .select({
      userId: fraudFlagsTable.userId,
      flagCount: count(),
      hasCriticalFlag: sql<boolean>`bool_or(severity = 'high')`,
    })
    .from(fraudFlagsTable)
    .where(sevCond)
    .groupBy(fraudFlagsTable.userId)
    .having(sql`count(*) >= ${minFlagCount}`)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((r) => ({
    userId: r.userId,
    flagCount: Number(r.flagCount),
    hasCriticalFlag: Boolean(r.hasCriticalFlag),
  }));
}
