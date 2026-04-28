import { Router } from "express";
import { db, investmentsTable, transactionsTable, dailyProfitRunsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, gte, avg, count, inArray, sql } from "drizzle-orm";
import { listTrades } from "../lib/signal-trade-service";
import { getMaintenanceState } from "../middlewares/maintenance";
import { TTLCache } from "../lib/cache/ttl-cache";
import { RedisCache } from "../lib/cache/redis-cache";
import { getRedisConnection } from "../lib/redis";

const router = Router();

// ─── Hot-read shared cache (Redis + in-process fallback) ────────────────────
// /public/market-indicators is unauthenticated and non-personalized — every
// caller gets the same response. The landing page polls it every few seconds
// so caching it removes the bulk of the read pressure on Neon.
//
// Redis-backed (shared across all Fly app instances) so 2× BOM + 1× SIN
// machines all benefit from the first warmup. Per-instance TTLCache fallback
// preserves serving capability if Upstash hiccups.
//
// 10s TTL — values are synthetic, monotonic counters that only change every
// 10–30 minutes anyway. 10s of staleness invisible. advanceLiveCounters has
// DB writes (system_settings upserts) that we intentionally skip on cache
// hit; it's catch-up-friendly so the next miss correctly advances all
// elapsed windows in one shot.
//
// /system/status is intentionally NOT wrapped: getMaintenanceState() already
// has LISTEN/NOTIFY-driven cross-instance cache invalidation, and a wrapping
// TTL cache would shadow invalidateMaintenanceCache() — when admin toggles
// maintenance in the UI, the banner would lag by up to TTL seconds on every
// instance.
type MarketIndicatorsResponse = {
  activeInvestors: number;
  usersEarningNow: number;
  withdrawals24h: number;
  avgMonthlyReturn: number;
  demoModeEnabled: boolean;
  demoProfitEnabled: boolean;
  demoProfitValue: number;
  fomoMessages: string[];
};
const marketIndicatorsCache = new RedisCache<MarketIndicatorsResponse>({
  getRedis: getRedisConnection,
  namespace: "market-indicators",
  ttlMs: 10_000,
  fallback: new TTLCache<MarketIndicatorsResponse>(10_000),
});

// Public: system status (maintenance mode + dynamic dashboard return).
//
// Two distinct maintenance signals are merged into the single `maintenance`
// flag the web app polls:
//   1. system_settings.maintenance_mode — admin-toggled freeze. Soft by
//      default (writes 503, reads pass, friendly inline banner shows). Set
//      `maintenance_hard_block=true` to additionally block reads for
//      non-admins (legacy "fully block all traffic" behaviour).
//   2. MAINTENANCE_MODE env var — flipped via Fly secret during the
//      Mumbai-DB cutover window. Same soft semantics as the admin toggle.
router.get("/system/status", async (_req, res) => {
  // Unified maintenance state — merges the MAINTENANCE_MODE env var and the
  // `system_settings.maintenance_mode` row toggled from the admin UI. Either
  // path freezes writes only (soft maintenance) and the friendly inline
  // banner appears for users; reads keep working. The legacy "fully block
  // all traffic" mode is a separate opt-in (`maintenance_hard_block`) that
  // adds a hard 503 in authMiddleware for non-admins.
  const maintenance = await getMaintenanceState();
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, ["dashboard_return_label"]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  // `writesDisabled` is the signal the web app uses to choose the lighter
  // inline banner over the full-screen overlay. Both env-var and admin-toggle
  // maintenance are now soft (writes-only) by default, so we surface BOTH
  // through this flag — that's what swaps the legacy admin-toggle UX from a
  // raw 503 to the banner. Hard-block is left as `maintenance` only so the
  // existing full-screen overlay still kicks in for that explicit opt-in.
  const writesDisabled = maintenance.active && !maintenance.hardBlock;
  res.json({
    maintenance: maintenance.active,
    writesDisabled,
    maintenanceMessage: maintenance.message,
    maintenanceEndsAt: maintenance.endsAt,
    dashboardReturnLabel: map["dashboard_return_label"] || "",
  });
});

// Public: currently running signal trades — pair + direction only (anti-copy)
router.get("/signal-trades/running", async (_req, res) => {
  const trades = await listTrades({ status: "running", limit: 20 });
  res.json({
    trades: trades.map((t) => ({
      id: t.id,
      pair: t.pair,
      direction: t.direction,
      createdAt: t.createdAt,
    })),
  });
});

// Public: recent closed signal trades (trust display)
router.get("/signal-trades/recent", async (_req, res) => {
  const trades = await listTrades({ status: "closed", limit: 20 });
  res.json({
    trades: trades.map((t) => ({
      id: t.id,
      pair: t.pair,
      direction: t.direction,
      entryPrice: t.entryPrice,
      realizedExitPrice: t.realizedExitPrice,
      realizedProfitPercent: t.realizedProfitPercent,
      closeReason: t.closeReason,
      closedAt: t.closedAt,
    })),
  });
});

/**
 * Pair: { activeInvestors, usersEarningNow }
 * - activeInvestors: monotonic counter that bumps 5–25 every 30 min
 * - usersEarningNow: monotonic, always 80–95% of activeInvestors (re-rolled per window)
 * Both values are persisted in system_settings so they're stable across refreshes
 * and shared across processes.
 */
async function advanceLiveCounters(currentBaseline: number, baselineAum: number = 0): Promise<{
  activeInvestors: number;
  usersEarningNow: number;
  withdrawals24h: number;
  avgMonthlyReturn: number;
  totalEquityBoost: number;
}> {
  const INCREMENT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  const EQUITY_WINDOW_MS = 10 * 60 * 1000; // 10 minutes (Total Equity ticks faster)
  const DAY_MS = 24 * 60 * 60 * 1000;
  const MIN_BUMP = 5;
  const MAX_BUMP = 25;
  const FLOOR = 124; // matches landing-page fallback so the number always feels real
  const EARNING_MIN_PCT = 80;
  const EARNING_MAX_PCT = 95;
  // Withdrawals (24h running total)
  const WD_RESET_MIN = 15000;
  const WD_RESET_MAX = 35000;
  const WD_BUMP_MIN = 100;
  const WD_BUMP_MAX = 1000;
  // Avg monthly return — re-rolled once per UTC day, kept inside this band
  const RETURN_MIN_PCT = 7.12;
  const RETURN_MAX_PCT = 10.0;
  // Total Equity boost (USD) — bumps every 10 min, never decreases
  const EQUITY_BUMP_MIN = 100;
  const EQUITY_BUMP_MAX = 500;
  const EQUITY_FLOOR = 500_000; // matches landing-page AUM baseline so it always feels real
  const now = Date.now();

  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [
      "active_investors_count",
      "active_investors_last_increment_at",
      "users_earning_now_count",
      "withdrawals_24h_amount",
      "withdrawals_24h_last_increment_at",
      "withdrawals_24h_window_start_at",
      "avg_monthly_return_value",
      "avg_monthly_return_day",
      "total_equity_boost",
      "total_equity_last_increment_at",
    ]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  let count = Number(map["active_investors_count"] ?? "0");
  let lastAt = Number(map["active_investors_last_increment_at"] ?? "0");
  let earning = Number(map["users_earning_now_count"] ?? "0");
  let wdAmount = Number(map["withdrawals_24h_amount"] ?? "0");
  let wdLastAt = Number(map["withdrawals_24h_last_increment_at"] ?? "0");
  let wdWindowStart = Number(map["withdrawals_24h_window_start_at"] ?? "0");
  let avgReturn = Number(map["avg_monthly_return_value"] ?? "0");
  let avgReturnDay = String(map["avg_monthly_return_day"] ?? "");
  let equityBoost = Number(map["total_equity_boost"] ?? "0");
  let equityLastAt = Number(map["total_equity_last_increment_at"] ?? "0");
  let dirty = false;

  // Monotonic floor for active investors
  const minimum = Math.max(FLOOR, currentBaseline);
  if (count < minimum) {
    count = minimum;
    dirty = true;
  }
  if (!lastAt) {
    lastAt = now;
    dirty = true;
  }

  // Catch up any missed 30-min windows (each window adds 5–25 to investors)
  const elapsed = now - lastAt;
  const windows = Math.floor(elapsed / INCREMENT_WINDOW_MS);
  if (windows > 0) {
    let added = 0;
    for (let i = 0; i < windows; i++) {
      added += MIN_BUMP + Math.floor(Math.random() * (MAX_BUMP - MIN_BUMP + 1));
    }
    count += added;
    lastAt = lastAt + windows * INCREMENT_WINDOW_MS;
    dirty = true;
  }

  // Earning-now stays at 80–95% of active investors. Pick a fresh percentage
  // (within band) and use max() to enforce monotonic growth.
  const pct = EARNING_MIN_PCT + Math.random() * (EARNING_MAX_PCT - EARNING_MIN_PCT);
  const targetEarning = Math.floor(count * (pct / 100));
  if (targetEarning > earning) {
    earning = targetEarning;
    dirty = true;
  }
  // Hard guard: never report more earning users than total investors
  if (earning > count) {
    earning = Math.floor(count * 0.9);
    dirty = true;
  }

  // Withdrawals (24h):
  //   - Reset to a fresh random $15K–$35K every 24h
  //   - Bump by random $100–$1000 every 30 min within a 24h window
  if (!wdWindowStart || now - wdWindowStart >= DAY_MS) {
    // New day → reset to a fresh starting amount
    wdAmount = WD_RESET_MIN + Math.floor(Math.random() * (WD_RESET_MAX - WD_RESET_MIN + 1));
    // Snap window-start to the most recent 24h boundary so we don't drift
    if (!wdWindowStart) {
      wdWindowStart = now;
    } else {
      const daysPassed = Math.floor((now - wdWindowStart) / DAY_MS);
      wdWindowStart = wdWindowStart + daysPassed * DAY_MS;
    }
    wdLastAt = wdWindowStart;
    dirty = true;
  } else {
    // Catch up 30-min bumps inside the current 24h window
    if (!wdLastAt) wdLastAt = wdWindowStart;
    const wdElapsed = now - wdLastAt;
    const wdWindows = Math.floor(wdElapsed / INCREMENT_WINDOW_MS);
    if (wdWindows > 0) {
      let wdAdded = 0;
      for (let i = 0; i < wdWindows; i++) {
        wdAdded += WD_BUMP_MIN + Math.floor(Math.random() * (WD_BUMP_MAX - WD_BUMP_MIN + 1));
      }
      wdAmount += wdAdded;
      wdLastAt = wdLastAt + wdWindows * INCREMENT_WINDOW_MS;
      dirty = true;
    }
  }

  // Total Equity boost: bumps random $100–$500 every 10 minutes, never decreases.
  // Layered on top of real AUM in /dashboard/fund-stats so the displayed
  // platform equity always trends upward.
  if (equityBoost < EQUITY_FLOOR - baselineAum) {
    equityBoost = Math.max(0, EQUITY_FLOOR - baselineAum);
    dirty = true;
  }
  if (!equityLastAt) {
    equityLastAt = now;
    dirty = true;
  }
  const equityElapsed = now - equityLastAt;
  const equityWindows = Math.floor(equityElapsed / EQUITY_WINDOW_MS);
  if (equityWindows > 0) {
    let added = 0;
    for (let i = 0; i < equityWindows; i++) {
      added += EQUITY_BUMP_MIN + Math.floor(Math.random() * (EQUITY_BUMP_MAX - EQUITY_BUMP_MIN + 1));
    }
    equityBoost += added;
    equityLastAt = equityLastAt + equityWindows * EQUITY_WINDOW_MS;
    dirty = true;
  }

  // Avg monthly return: re-roll once per UTC day, kept inside [7.12%, 10.00%].
  // Stable for the whole day so refreshes never change the displayed number.
  const todayUtc = new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
  if (avgReturnDay !== todayUtc || avgReturn < RETURN_MIN_PCT || avgReturn > RETURN_MAX_PCT) {
    const raw = RETURN_MIN_PCT + Math.random() * (RETURN_MAX_PCT - RETURN_MIN_PCT);
    avgReturn = parseFloat(raw.toFixed(2));
    avgReturnDay = todayUtc;
    dirty = true;
  }

  if (dirty) {
    await db
      .insert(systemSettingsTable)
      .values([
        { key: "active_investors_count", value: String(count) },
        { key: "active_investors_last_increment_at", value: String(lastAt) },
        { key: "users_earning_now_count", value: String(earning) },
        { key: "withdrawals_24h_amount", value: String(wdAmount) },
        { key: "withdrawals_24h_last_increment_at", value: String(wdLastAt) },
        { key: "withdrawals_24h_window_start_at", value: String(wdWindowStart) },
        { key: "avg_monthly_return_value", value: String(avgReturn) },
        { key: "avg_monthly_return_day", value: avgReturnDay },
        { key: "total_equity_boost", value: String(equityBoost) },
        { key: "total_equity_last_increment_at", value: String(equityLastAt) },
      ])
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: { value: sql`EXCLUDED.value`, updatedAt: new Date() },
      });
  }

  return {
    activeInvestors: count,
    usersEarningNow: earning,
    withdrawals24h: wdAmount,
    avgMonthlyReturn: avgReturn,
    totalEquityBoost: equityBoost,
  };
}

// Re-exported so other routes (e.g. /dashboard/fund-stats) can use the same
// persisted, monotonic counters and not invent their own.
export { advanceLiveCounters };

router.get("/public/market-indicators", async (_req, res) => {
  const { value, cached } = await marketIndicatorsCache.getOrCompute("v1", async () => {
    // NOT EXISTS subquery (rather than a join + filter) so the query plan stays
    // a simple count over the active-investments index. Excludes the deploy
    // smoke-test account so a stray active investment on it never inflates the
    // public "Active Investors" widget.
    const activeInvRows = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM investments i
      WHERE i.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = i.user_id AND u.is_smoke_test = true
        )
    `);
    const activeInvResult = activeInvRows.rows[0] as { count: number } | undefined;

    const realActiveInvestors = Number(activeInvResult?.count ?? 0);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [withdrawals24hResult] = await db
      .select({ count: count() })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.type, "withdrawal"),
          eq(transactionsTable.status, "completed"),
          gte(transactionsTable.createdAt, since24h),
        ),
      );

    const realWithdrawals24h = Number(withdrawals24hResult?.count ?? 0);

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [avgResult] = await db
      .select({ avg: avg(dailyProfitRunsTable.profitPercent) })
      .from(dailyProfitRunsTable)
      .where(gte(dailyProfitRunsTable.createdAt, since30d));

    const dailyAvg = parseFloat(String(avgResult?.avg ?? "0")) || 0;
    const realAvgMonthlyReturn = parseFloat((dailyAvg * 30).toFixed(2));

    // Layer admin-controlled baselines so brand-new platforms never show 0
    const baselineRows = await db
      .select()
      .from(systemSettingsTable)
      .where(inArray(systemSettingsTable.key, [
        "baseline_active_investors",
        "baseline_users_earning_now",
        "baseline_withdrawals_24h",
        "baseline_avg_monthly_return",
        "demo_mode_enabled",
        "demo_profit_value",
        "demo_profit_enabled",
        "fomo_messages",
      ]));
    const settings = Object.fromEntries(baselineRows.map((r) => [r.key, r.value]));

    const baseInvestors = Number(settings["baseline_active_investors"] ?? "0") || 0;
    const baseEarning = Number(settings["baseline_users_earning_now"] ?? "0") || 0;
    const baseWithdrawals = Number(settings["baseline_withdrawals_24h"] ?? "0") || 0;
    const baseAvgReturn = Number(settings["baseline_avg_monthly_return"] ?? "0") || 0;

    let fomoMessages: string[] = [];
    try {
      const parsed = JSON.parse(settings["fomo_messages"] ?? "[]");
      if (Array.isArray(parsed)) fomoMessages = parsed.filter((s) => typeof s === "string");
    } catch {}

    // Monotonic, auto-incrementing live counters (persisted in DB).
    // - activeInvestors: bumps 5–25 every 30 min, seeded from real + admin baseline
    // - usersEarningNow: 80–95% of activeInvestors, monotonic
    const live = await advanceLiveCounters(realActiveInvestors + baseInvestors);

    return {
      activeInvestors: live.activeInvestors,
      usersEarningNow: Math.max(live.usersEarningNow, realActiveInvestors + baseEarning),
      // Synthetic 24h withdrawal volume (USD), persisted in DB.
      // Resets to a fresh $15K–$35K every 24h, bumps $100–$1000 every 30 min.
      withdrawals24h: live.withdrawals24h,
      // Daily-rotating monthly return % (7.12–10.00), persisted in DB.
      // Real average is used as a floor only if it exceeds the synthetic value.
      avgMonthlyReturn: Math.max(live.avgMonthlyReturn, realAvgMonthlyReturn),
      demoModeEnabled: settings["demo_mode_enabled"] !== "false",
      demoProfitEnabled: settings["demo_profit_enabled"] !== "false",
      demoProfitValue: Number(settings["demo_profit_value"] ?? "0") || 0,
      fomoMessages,
    };
  });
  res.setHeader("X-Cache", cached ? "HIT" : "MISS");
  res.json(value);
});

export default router;
