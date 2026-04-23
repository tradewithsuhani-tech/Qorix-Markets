import { Router } from "express";
import { db, investmentsTable, transactionsTable, dailyProfitRunsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, gte, avg, count, inArray, sql } from "drizzle-orm";
import { listTrades } from "../lib/signal-trade-service";

const router = Router();

// Public: system status (maintenance mode + dynamic dashboard return)
router.get("/system/status", async (_req, res) => {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [
      "maintenance_mode",
      "maintenance_message",
      "dashboard_return_label",
    ]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({
    maintenance: map["maintenance_mode"] === "true",
    maintenanceMessage:
      map["maintenance_message"] ||
      "We are upgrading our platform. Please check back shortly.",
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
 * Auto-incrementing "Active Investors" counter.
 * - Increases by random(5–25) every 30 minutes
 * - Persisted in system_settings so it survives restarts and is shared across requests
 * - Monotonic: never decreases (so refresh / new signup never lowers the displayed number)
 * - On real signup, an extra +1 is added (see auth.ts) to feel organic
 */
async function advanceActiveInvestorsCounter(currentBaseline: number): Promise<number> {
  const INCREMENT_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
  const MIN_BUMP = 5;
  const MAX_BUMP = 25;
  const FLOOR = 124; // matches landing-page fallback so the number always feels real
  const now = Date.now();

  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [
      "active_investors_count",
      "active_investors_last_increment_at",
    ]));
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  let count = Number(map["active_investors_count"] ?? "0");
  let lastAt = Number(map["active_investors_last_increment_at"] ?? "0");
  let dirty = false;

  // Monotonic floor: never below current baseline + hardcoded floor
  const minimum = Math.max(FLOOR, currentBaseline);
  if (count < minimum) {
    count = minimum;
    dirty = true;
  }
  if (!lastAt) {
    lastAt = now;
    dirty = true;
  }

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

  if (dirty) {
    await db
      .insert(systemSettingsTable)
      .values([
        { key: "active_investors_count", value: String(count) },
        { key: "active_investors_last_increment_at", value: String(lastAt) },
      ])
      .onConflictDoUpdate({
        target: systemSettingsTable.key,
        set: { value: sql`EXCLUDED.value`, updatedAt: new Date() },
      });
  }

  return count;
}

router.get("/public/market-indicators", async (_req, res) => {
  const [activeInvResult] = await db
    .select({ count: count() })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));

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

  // Monotonic, auto-incrementing investor counter (5–25 every 30 min).
  // Seeded from real + admin baseline so the displayed number is always coherent.
  const activeInvestors = await advanceActiveInvestorsCounter(
    realActiveInvestors + baseInvestors,
  );

  res.json({
    activeInvestors,
    usersEarningNow: realActiveInvestors + baseEarning,
    withdrawals24h: realWithdrawals24h + baseWithdrawals,
    avgMonthlyReturn: realAvgMonthlyReturn > 0 ? realAvgMonthlyReturn : baseAvgReturn,
    demoModeEnabled: settings["demo_mode_enabled"] !== "false",
    demoProfitEnabled: settings["demo_profit_enabled"] !== "false",
    demoProfitValue: Number(settings["demo_profit_value"] ?? "0") || 0,
    fomoMessages,
  });
});

export default router;
