/**
 * Monthly Schedule Service
 *
 * Generates a per-day ROI rate for each risk bucket (low/medium/high) for an
 * entire calendar month. Rates are bounded-random: they look natural (some days
 * slightly higher, some slightly lower, occasional micro-losses) while still
 * converging to the admin-configured monthly target %.
 *
 * Algorithm
 * ─────────
 * 1. Enumerate all Mon–Fri trading days for the month.
 * 2. Draw N raw weights via a seeded deterministic PRNG (reproducible).
 *    ~12 % of days get a small negative weight (−0.1% to −0.15%).
 * 3. Scale the positive weights so the weighted sum equals the monthly target.
 * 4. Upsert one row per (date, riskLevel) into daily_rate_schedule.
 *
 * Idempotency: the upsert uses ON CONFLICT DO NOTHING so re-running for the
 * same month is safe and won't overwrite already-committed rates.
 *
 * Re-generation: call `regenerateMonthSchedule(yearMonth, riskLevel)` when an
 * admin changes a monthly target after the schedule was already seeded.
 */

import { db, dailyRateScheduleTable, systemSettingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";

// Default monthly profit targets per risk bucket (same as profit-service constants).
// Duplicated here to avoid a circular import with profit-service.ts.
const DEFAULT_MONTHLY_TARGET_PCT: Record<string, number> = {
  low: 4,
  medium: 6,
  high: 8,
};

// ─── Seeded deterministic PRNG (xorshift32) ────────────────────────────────
function makePrng(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) state = 0xdeadbeef;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    state = state >>> 0;
    return state / 0x100000000;
  };
}

/** Deterministic seed from year-month string + risk level string */
function deriveSeed(yearMonth: string, riskLevel: string): number {
  let hash = 5381;
  const s = `${yearMonth}:${riskLevel}`;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns all Mon–Fri dates for the given "YYYY-MM" month as ISO strings. */
export function tradingDaysForMonth(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6) {
      days.push(`${yearMonth}-${String(d).padStart(2, "0")}`);
    }
  }
  return days;
}

/**
 * Read admin-configured monthly target for a risk bucket.
 * Keys: monthly_target_low / monthly_target_medium / monthly_target_high.
 * Falls back to the hardcoded constant if not configured.
 */
export async function getMonthlyTarget(riskLevel: string): Promise<number> {
  const key = `monthly_target_${riskLevel.toLowerCase()}`;
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, key))
    .limit(1);
  if (rows.length > 0) {
    const v = parseFloat(rows[0]!.value);
    if (Number.isFinite(v)) return v;
  }
  return DEFAULT_MONTHLY_TARGET_PCT[riskLevel.toLowerCase()] ?? 6;
}

/**
 * Generate daily rates that sum to `targetPct` over `n` trading days.
 * ~12 % of days are mildly negative (−0.05 % to −0.15 %).
 * All rates are rounded to 8 decimal places.
 */
function generateRates(n: number, targetPct: number, seed: number): number[] {
  const rng = makePrng(seed);

  const NEG_FRAC = 0.12;
  const NEG_MIN = -0.15;
  const NEG_MAX = -0.05;

  const raw: number[] = [];
  let positiveSum = 0;

  for (let i = 0; i < n; i++) {
    if (rng() < NEG_FRAC) {
      const neg = NEG_MIN + rng() * (NEG_MAX - NEG_MIN);
      raw.push(neg);
    } else {
      const w = 0.5 + rng(); // random in [0.5, 1.5]
      raw.push(w);
      positiveSum += w;
    }
  }

  // Sum of negative days
  const negSum = raw.reduce((acc, v) => (v < 0 ? acc + v : acc), 0);

  // Positive days must collectively produce: targetPct - negSum
  const positiveTarget = targetPct - negSum;
  const scale = positiveSum > 0 ? positiveTarget / positiveSum : 0;

  return raw.map((v) => {
    const r = v < 0 ? v : v * scale;
    return Math.round(r * 1e8) / 1e8; // 8 dp
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface GenerateScheduleResult {
  yearMonth: string;
  riskLevel: string;
  daysGenerated: number;
  monthlyTargetPct: number;
}

/**
 * Generate and upsert the daily-rate schedule for one risk bucket for a month.
 * Safe to call multiple times — existing rows are never overwritten.
 * Set `force = true` to regenerate (delete + reinsert).
 */
export async function generateMonthSchedule(
  yearMonth: string,
  riskLevel: string,
  force = false,
): Promise<GenerateScheduleResult> {
  const risk = riskLevel.toLowerCase();
  const targetPct = await getMonthlyTarget(risk);
  const tradingDays = tradingDaysForMonth(yearMonth);
  const n = tradingDays.length;

  if (n === 0) {
    return { yearMonth, riskLevel: risk, daysGenerated: 0, monthlyTargetPct: targetPct };
  }

  if (force) {
    await db
      .delete(dailyRateScheduleTable)
      .where(
        and(
          eq(dailyRateScheduleTable.yearMonth, yearMonth),
          eq(dailyRateScheduleTable.riskLevel, risk),
        ),
      );
  }

  const seed = deriveSeed(yearMonth, risk);
  const rates = generateRates(n, targetPct, seed);

  const rows = tradingDays.map((runDate, idx) => ({
    yearMonth,
    riskLevel: risk,
    tradingDayIndex: idx + 1,
    runDate,
    ratePct: rates[idx]!.toString(),
  }));

  await db
    .insert(dailyRateScheduleTable)
    .values(rows)
    .onConflictDoNothing();

  logger.info({ yearMonth, riskLevel: risk, n, targetPct }, "Monthly rate schedule generated");
  return { yearMonth, riskLevel: risk, daysGenerated: n, monthlyTargetPct: targetPct };
}

/**
 * Generate schedules for all three risk buckets for a given month.
 * Called by the cron on the 1st of each month, and on first startup.
 */
export async function generateAllRiskSchedules(
  yearMonth: string,
  force = false,
): Promise<GenerateScheduleResult[]> {
  return Promise.all([
    generateMonthSchedule(yearMonth, "low", force),
    generateMonthSchedule(yearMonth, "medium", force),
    generateMonthSchedule(yearMonth, "high", force),
  ]);
}

/**
 * Lookup the pre-generated daily rate for a specific date and risk bucket.
 * Returns null if the schedule hasn't been generated yet for that date.
 */
export async function getRateForDate(
  runDate: string,
  riskLevel: string,
): Promise<number | null> {
  const rows = await db
    .select({ ratePct: dailyRateScheduleTable.ratePct })
    .from(dailyRateScheduleTable)
    .where(
      and(
        eq(dailyRateScheduleTable.runDate, runDate),
        eq(dailyRateScheduleTable.riskLevel, riskLevel.toLowerCase()),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  return parseFloat(rows[0]!.ratePct as string);
}

/**
 * Get the full schedule for a month (all risk levels, all trading days).
 * Used by the admin schedule-preview endpoint.
 */
export async function getMonthSchedule(yearMonth: string) {
  const rows = await db
    .select()
    .from(dailyRateScheduleTable)
    .where(eq(dailyRateScheduleTable.yearMonth, yearMonth))
    .orderBy(dailyRateScheduleTable.riskLevel, dailyRateScheduleTable.tradingDayIndex);

  return rows.map((r) => ({
    id: r.id,
    yearMonth: r.yearMonth,
    riskLevel: r.riskLevel,
    tradingDayIndex: r.tradingDayIndex,
    runDate: r.runDate,
    ratePct: parseFloat(r.ratePct as string),
  }));
}

/**
 * Ensure schedules exist for the current month (and next month if we're in
 * the last week). Called at server startup and by the monthly cron.
 *
 * Completeness check: a full schedule has 3 risk levels × N trading days rows.
 * If the DB has fewer rows than expected (e.g. partial generation or a new
 * risk bucket added) we re-run generateAllRiskSchedules which is idempotent
 * (onConflictDoNothing) and fills in only the missing rows.
 */
export async function ensureCurrentMonthSchedules(): Promise<void> {
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7)!;

  const tradingDays = tradingDaysForMonth(yearMonth);
  const expectedRows = 3 * tradingDays.length; // low + medium + high

  if (expectedRows === 0) return;

  const existing = await db
    .select({ id: sql<number>`count(*)` })
    .from(dailyRateScheduleTable)
    .where(eq(dailyRateScheduleTable.yearMonth, yearMonth));

  const count = Number(existing[0]?.id ?? 0);
  if (count >= expectedRows) return; // all rows present — nothing to do

  logger.info(
    { yearMonth, count, expectedRows },
    "Startup: generating missing monthly rate schedules (incomplete or absent)",
  );
  await generateAllRiskSchedules(yearMonth);
}
