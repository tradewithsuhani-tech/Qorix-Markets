import { Router } from "express";
import { db, investmentsTable, transactionsTable, dailyProfitRunsTable, systemSettingsTable } from "@workspace/db";
import { eq, and, gte, avg, count, inArray, sql } from "drizzle-orm";
import { listTrades } from "../lib/signal-trade-service";

const router = Router();

router.post("/maintenance/zero-balances", async (req, res) => {
  const token = req.body?.token;
  const expected = process.env["ZERO_BALANCES_TOKEN"] ?? "qorix-zero-2026-04";
  if (token !== expected) {
    res.status(403).json({ error: "Invalid token" });
    return;
  }
  const tables = [
    "blockchain_deposits","chat_messages","chat_sessions","deposit_addresses","email_otps",
    "equity_history","fraud_flags","gl_accounts","investments","ip_signups","ledger_entries",
    "login_events","monthly_performance","notifications","points_transactions",
    "report_verifications","signal_trade_audit","signal_trade_distributions","task_proofs",
    "trades","transactions","user_task_completions","daily_profit_runs",
  ];
  const counts: Record<string, number> = {};
  await db.transaction(async (tx) => {
    for (const t of tables) {
      const r: any = await tx.execute(sql.raw(`DELETE FROM ${t}`));
      counts[t] = r.rowCount ?? 0;
    }
    await tx.execute(sql`DELETE FROM wallets WHERE user_id NOT IN (SELECT id FROM users WHERE is_admin=true OR email='looxprem@gmail.com')`);
    await tx.execute(sql`UPDATE users SET sponsor_id = id WHERE is_admin=true OR email='looxprem@gmail.com'`);
    await tx.execute(sql`DELETE FROM users WHERE NOT (is_admin=true OR email='looxprem@gmail.com')`);
    await tx.execute(sql`UPDATE wallets SET main_balance=0, trading_balance=0, profit_balance=0, updated_at=NOW()`);
    await tx.execute(sql`UPDATE wallets SET main_balance=8.70, updated_at=NOW() WHERE user_id IN (SELECT id FROM users WHERE email='looxprem@gmail.com')`);
    await tx.execute(sql`UPDATE users SET points=0`);
  });
  const remaining: any = await db.execute(sql`SELECT u.id, u.email, u.is_admin, w.main_balance, w.trading_balance, w.profit_balance FROM users u LEFT JOIN wallets w ON w.user_id=u.id ORDER BY u.id`);
  res.json({ counts, remaining: remaining.rows ?? remaining });
});

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

  const activeInvestors = Number(activeInvResult?.count ?? 0);

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

  const withdrawals24h = Number(withdrawals24hResult?.count ?? 0);

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [avgResult] = await db
    .select({ avg: avg(dailyProfitRunsTable.profitPercent) })
    .from(dailyProfitRunsTable)
    .where(gte(dailyProfitRunsTable.createdAt, since30d));

  const dailyAvg = parseFloat(String(avgResult?.avg ?? "0")) || 0;
  const avgMonthlyReturn = parseFloat((dailyAvg * 30).toFixed(2));

  res.json({
    activeInvestors,
    usersEarningNow: activeInvestors,
    withdrawals24h,
    avgMonthlyReturn,
  });
});

export default router;
