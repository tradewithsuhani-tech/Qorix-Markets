import { Router } from "express";
import {
  db,
  usersTable,
  walletsTable,
  investmentsTable,
  transactionsTable,
  systemSettingsTable,
  dailyProfitRunsTable,
  glAccountsTable,
  ledgerEntriesTable,
} from "@workspace/db";
import { eq, sum, count, and, desc, sql } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { SetDailyProfitBody } from "@workspace/api-zod";
import { transferProfitToMain } from "../lib/profit-service";
import { emitProfitDistribution } from "../lib/event-bus";
import { transactionLogger, profitLogger, errorLogger } from "../lib/logger";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForSystem,
  runReconciliation,
} from "../lib/ledger-service";

const router = Router();
router.use("/admin", authMiddleware);
router.use("/admin", adminMiddleware);

export async function getSlotData() {
  const slotRows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "max_investor_slots"))
    .limit(1);
  const maxSlots = slotRows.length > 0 ? parseInt(slotRows[0]!.value) : 0;

  const [activeInvResult] = await db
    .select({ count: count() })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const activeInvestors = Number(activeInvResult?.count ?? 0);
  const availableSlots = maxSlots > 0 ? Math.max(0, maxSlots - activeInvestors) : null;

  return { maxSlots, activeInvestors, availableSlots, isFull: maxSlots > 0 && activeInvestors >= maxSlots };
}

async function getAdminStatsData() {
  const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);
  const [activeInvResult] = await db
    .select({ count: count() })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const [aumResult] = await db
    .select({ total: sum(investmentsTable.amount) })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const [profitResult] = await db
    .select({ total: sum(investmentsTable.totalProfit) })
    .from(investmentsTable);
  const [pendingResult] = await db
    .select({ count: count() })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));
  const [pendingAmountResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  const settingRows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "daily_profit_percent"))
    .limit(1);
  const dailyProfitSetting = settingRows.length > 0
    ? parseFloat(settingRows[0]!.value)
    : 0;

  const slotData = await getSlotData();

  return {
    totalUsers: Number(totalUsersResult?.count ?? 0),
    activeInvestors: Number(activeInvResult?.count ?? 0),
    totalAUM: parseFloat(String(aumResult?.total ?? "0")) || 0,
    totalProfitPaid: parseFloat(String(profitResult?.total ?? "0")) || 0,
    pendingWithdrawals: Number(pendingResult?.count ?? 0),
    pendingWithdrawalAmount: parseFloat(String(pendingAmountResult?.total ?? "0")) || 0,
    dailyProfitPercent: dailyProfitSetting,
    maxSlots: slotData.maxSlots,
    availableSlots: slotData.availableSlots,
    isFull: slotData.isFull,
  };
}

router.get("/admin/stats", async (req, res) => {
  const stats = await getAdminStatsData();
  res.json(stats);
});

router.post("/admin/profit", async (req: AuthRequest, res) => {
  const result = SetDailyProfitBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { profitPercent } = result.data;
  if (profitPercent < -100 || profitPercent > 100) {
    res.status(400).json({ error: "Profit percent must be between -100 and 100" });
    return;
  }

  try {
    await emitProfitDistribution({ profitPercent, triggeredBy: "admin" });
    profitLogger.info(
      { profitPercent, adminId: req.userId },
      "Admin: profit distribution job enqueued",
    );
  } catch (err) {
    errorLogger.error({ err, profitPercent, adminId: req.userId }, "Admin: failed to enqueue profit distribution");
    res.status(500).json({ error: "Failed to enqueue profit distribution" });
    return;
  }

  const stats = await getAdminStatsData();
  res.json({ ...stats, queued: true });
});

router.get("/admin/profit/history", async (req, res) => {
  const limit = Math.min(parseInt(req.query["limit"] as string) || 30, 100);

  const runs = await db
    .select()
    .from(dailyProfitRunsTable)
    .orderBy(desc(dailyProfitRunsTable.createdAt))
    .limit(limit);

  res.json(
    runs.map((r) => ({
      id: r.id,
      runDate: r.runDate,
      profitPercent: parseFloat(r.profitPercent as string),
      totalAUM: parseFloat(r.totalAUM as string),
      totalProfitDistributed: parseFloat(r.totalProfitDistributed as string),
      investorsAffected: r.investorsAffected,
      referralBonusPaid: parseFloat(r.referralBonusPaid as string),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.get("/admin/users", async (req, res) => {
  const page = parseInt(req.query["page"] as string) || 1;
  const limit = parseInt(req.query["limit"] as string) || 20;
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ count: count() }).from(usersTable);
  const total = Number(totalResult?.count ?? 0);

  const allUsers = await db.select().from(usersTable).limit(limit).offset(offset);

  const data = await Promise.all(
    allUsers.map(async (u) => {
      const wallets = await db
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, u.id))
        .limit(1);
      const invs = await db
        .select()
        .from(investmentsTable)
        .where(eq(investmentsTable.userId, u.id))
        .limit(1);
      const wallet = wallets[0];
      const inv = invs[0];
      return {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        isAdmin: u.isAdmin,
        mainBalance: wallet ? parseFloat(wallet.mainBalance as string) : 0,
        tradingBalance: wallet ? parseFloat(wallet.tradingBalance as string) : 0,
        profitBalance: wallet ? parseFloat(wallet.profitBalance as string) : 0,
        investmentAmount: inv ? parseFloat(inv.amount as string) : 0,
        isTrading: inv?.isActive ?? false,
        referralCode: u.referralCode,
        createdAt: u.createdAt.toISOString(),
      };
    }),
  );

  res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
});

router.get("/admin/withdrawals", async (req, res) => {
  const pending = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")))
    .orderBy(desc(transactionsTable.createdAt));

  const result = await Promise.all(
    pending.map(async (tx) => {
      const users = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, tx.userId))
        .limit(1);
      const user = users[0];
      return {
        id: tx.id,
        userId: tx.userId,
        userEmail: user?.email ?? "",
        userFullName: user?.fullName ?? "",
        amount: parseFloat(tx.amount as string),
        walletAddress: tx.walletAddress ?? "",
        status: tx.status,
        requestedAt: tx.createdAt.toISOString(),
        processedAt: null,
      };
    }),
  );

  res.json(result);
});

router.post("/admin/withdrawals/:id/approve", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  const [updated] = await db
    .update(transactionsTable)
    .set({ status: "completed" })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.type, "withdrawal")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, updated.userId))
    .limit(1);

  transactionLogger.info(
    {
      event: "withdrawal_approved",
      transactionId: id,
      userId: updated.userId,
      amount: parseFloat(updated.amount as string),
      adminId: req.userId,
    },
    "Withdrawal approved by admin",
  );

  res.json({
    id: updated.id,
    userId: updated.userId,
    userEmail: user[0]?.email ?? "",
    userFullName: user[0]?.fullName ?? "",
    amount: parseFloat(updated.amount as string),
    walletAddress: updated.walletAddress ?? "",
    status: updated.status,
    requestedAt: updated.createdAt.toISOString(),
    processedAt: new Date().toISOString(),
  });
});

router.post("/admin/withdrawals/:id/reject", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  const [updated] = await db
    .update(transactionsTable)
    .set({ status: "rejected" })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.type, "withdrawal")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  const txUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, updated.userId))
    .limit(1);

  if (txUser.length > 0) {
    const wallets = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.userId, updated.userId))
      .limit(1);
    if (wallets.length > 0) {
      const profitBalance = parseFloat(wallets[0]!.profitBalance as string);
      const refundAmount = parseFloat(updated.amount as string);
      await db
        .update(walletsTable)
        .set({ profitBalance: (profitBalance + refundAmount).toString(), updatedAt: new Date() })
        .where(eq(walletsTable.userId, updated.userId));

      await ensureUserAccounts(updated.userId);
      await postJournalEntry(
        journalForSystem(`refund:${id}`),
        [
          { accountCode: "platform:usdt_pool", entryType: "debit", amount: refundAmount, description: `Withdrawal reversal (rejected txn #${id})` },
          { accountCode: `user:${updated.userId}:profit`, entryType: "credit", amount: refundAmount, description: `Refund credited on withdrawal rejection` },
        ],
        null,
      );
    }
  }

  const user = txUser[0];

  transactionLogger.info(
    {
      event: "withdrawal_rejected",
      transactionId: id,
      userId: updated.userId,
      amount: parseFloat(updated.amount as string),
      adminId: req.userId,
    },
    "Withdrawal rejected by admin — funds refunded",
  );

  res.json({
    id: updated.id,
    userId: updated.userId,
    userEmail: user?.email ?? "",
    userFullName: user?.fullName ?? "",
    amount: parseFloat(updated.amount as string),
    walletAddress: updated.walletAddress ?? "",
    status: updated.status,
    requestedAt: updated.createdAt.toISOString(),
    processedAt: new Date().toISOString(),
  });
});

router.get("/admin/intelligence", async (_req: AuthRequest, res) => {
  // --- Summary stats ---
  const [depositResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "deposit"), eq(transactionsTable.status, "completed")));

  const [withdrawalResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "completed")));

  const [feeResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "fee"));

  const [pendingCountResult] = await db
    .select({ count: count() })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  const [pendingAmtResult] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  // Risk exposure by level
  const riskRows = await db
    .select({
      riskLevel: investmentsTable.riskLevel,
      total: sum(investmentsTable.amount),
      investors: count(),
    })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true))
    .groupBy(investmentsTable.riskLevel);

  const riskExposure: Record<string, { amount: number; investors: number }> = {
    low: { amount: 0, investors: 0 },
    medium: { amount: 0, investors: 0 },
    high: { amount: 0, investors: 0 },
  };
  for (const row of riskRows) {
    const key = row.riskLevel ?? "low";
    riskExposure[key] = {
      amount: parseFloat(String(row.total ?? "0")) || 0,
      investors: Number(row.investors ?? 0),
    };
  }

  // --- 30-day deposit/withdrawal trend ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const depositTrend = await db
    .select({
      date: sql<string>`DATE(created_at)`,
      amount: sum(transactionsTable.amount),
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "completed"),
        sql`created_at >= ${thirtyDaysAgo.toISOString()}`,
      ),
    )
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`);

  const withdrawalTrend = await db
    .select({
      date: sql<string>`DATE(created_at)`,
      amount: sum(transactionsTable.amount),
    })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "withdrawal"),
        eq(transactionsTable.status, "completed"),
        sql`created_at >= ${thirtyDaysAgo.toISOString()}`,
      ),
    )
    .groupBy(sql`DATE(created_at)`)
    .orderBy(sql`DATE(created_at)`);

  // Merge into unified daily series
  const dateMap = new Map<string, { deposits: number; withdrawals: number }>();
  // Fill all 30 days with zeros first
  for (let i = 0; i < 30; i++) {
    const d = new Date(thirtyDaysAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { deposits: 0, withdrawals: 0 });
  }
  for (const row of depositTrend) {
    const entry = dateMap.get(row.date);
    if (entry) entry.deposits = parseFloat(String(row.amount ?? "0")) || 0;
  }
  for (const row of withdrawalTrend) {
    const entry = dateMap.get(row.date);
    if (entry) entry.withdrawals = parseFloat(String(row.amount ?? "0")) || 0;
  }

  const flowSeries = Array.from(dateMap.entries()).map(([date, v]) => ({
    date,
    deposits: v.deposits,
    withdrawals: v.withdrawals,
    net: v.deposits - v.withdrawals,
  }));

  // --- Profit history (last 30 runs) ---
  const profitRuns = await db
    .select()
    .from(dailyProfitRunsTable)
    .orderBy(desc(dailyProfitRunsTable.createdAt))
    .limit(30);

  const profitSeries = profitRuns
    .reverse()
    .map((r) => ({
      date: r.runDate,
      profitPercent: parseFloat(String(r.profitPercent ?? "0")),
      distributed: parseFloat(String(r.totalProfitDistributed ?? "0")),
      aum: parseFloat(String(r.totalAUM ?? "0")),
    }));

  // --- Top users by investment ---
  const topInvestors = await db
    .select({
      userId: investmentsTable.userId,
      amount: investmentsTable.amount,
      riskLevel: investmentsTable.riskLevel,
      totalProfit: investmentsTable.totalProfit,
    })
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true))
    .orderBy(desc(investmentsTable.amount))
    .limit(5);

  const topInvestorsWithEmail = await Promise.all(
    topInvestors.map(async (inv) => {
      const users = await db
        .select({ email: usersTable.email, fullName: usersTable.fullName })
        .from(usersTable)
        .where(eq(usersTable.id, inv.userId))
        .limit(1);
      return {
        email: users[0]?.email ?? "",
        fullName: users[0]?.fullName ?? "",
        amount: parseFloat(String(inv.amount ?? "0")),
        riskLevel: inv.riskLevel,
        totalProfit: parseFloat(String(inv.totalProfit ?? "0")),
      };
    }),
  );

  res.json({
    summary: {
      totalDeposits: parseFloat(String(depositResult?.total ?? "0")) || 0,
      totalWithdrawals: parseFloat(String(withdrawalResult?.total ?? "0")) || 0,
      netPlatformProfit: parseFloat(String(feeResult?.total ?? "0")) || 0,
      riskExposure,
      pendingPayouts: {
        count: Number(pendingCountResult?.count ?? 0),
        amount: parseFloat(String(pendingAmtResult?.total ?? "0")) || 0,
      },
    },
    flowSeries,
    profitSeries,
    topInvestors: topInvestorsWithEmail,
  });
});

router.get("/admin/ledger/reconcile", async (_req: AuthRequest, res) => {
  try {
    const result = await runReconciliation();
    res.json(result);
  } catch (err) {
    errorLogger.error({ err }, "Reconciliation failed");
    res.status(500).json({ error: "Reconciliation error" });
  }
});

router.get("/admin/ledger/accounts", async (_req: AuthRequest, res) => {
  const accounts = await db
    .select({
      id: glAccountsTable.id,
      code: glAccountsTable.code,
      name: glAccountsTable.name,
      accountType: glAccountsTable.accountType,
      normalBalance: glAccountsTable.normalBalance,
      userId: glAccountsTable.userId,
      isSystem: glAccountsTable.isSystem,
    })
    .from(glAccountsTable)
    .orderBy(glAccountsTable.id);

  res.json(accounts);
});

router.get("/admin/ledger/journal", async (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query["limit"] as string) || 50, 200);
  const offset = parseInt(req.query["offset"] as string) || 0;

  const entries = await db
    .select()
    .from(ledgerEntriesTable)
    .orderBy(desc(ledgerEntriesTable.id))
    .limit(limit)
    .offset(offset);

  res.json(
    entries.map((e) => ({
      id: e.id,
      journalId: e.journalId,
      transactionId: e.transactionId ?? null,
      accountCode: e.accountCode,
      entryType: e.entryType,
      amount: parseFloat(e.amount as string),
      currency: e.currency,
      description: e.description ?? "",
      createdAt: e.createdAt.toISOString(),
    })),
  );
});

router.post("/admin/slots", async (req: AuthRequest, res) => {
  const { maxSlots } = req.body as { maxSlots: unknown };
  const parsed = parseInt(String(maxSlots));
  if (isNaN(parsed) || parsed < 0) {
    res.status(400).json({ error: "maxSlots must be a non-negative integer" });
    return;
  }

  await db
    .insert(systemSettingsTable)
    .values({ key: "max_investor_slots", value: parsed.toString() })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: parsed.toString(), updatedAt: new Date() },
    });

  const slotData = await getSlotData();
  res.json(slotData);
});

export default router;
