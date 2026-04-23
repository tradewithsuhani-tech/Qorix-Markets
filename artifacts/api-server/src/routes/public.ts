import { Router } from "express";
import { db, investmentsTable, transactionsTable, dailyProfitRunsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, gte, avg, count, inArray } from "drizzle-orm";
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

  res.json({
    activeInvestors: realActiveInvestors + baseInvestors,
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
