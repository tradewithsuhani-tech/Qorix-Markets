import { Router } from "express";
import {
  db,
  usersTable,
  walletsTable,
  investmentsTable,
  transactionsTable,
  systemSettingsTable,
  dailyProfitRunsTable,
} from "@workspace/db";
import { eq, sum, count, and, desc } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { SetDailyProfitBody } from "@workspace/api-zod";
import { transferProfitToMain } from "../lib/profit-service";
import { emitProfitDistribution } from "../lib/event-bus";
import { transactionLogger, profitLogger, errorLogger } from "../lib/logger";

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

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

  return {
    totalUsers: Number(totalUsersResult?.count ?? 0),
    activeInvestors: Number(activeInvResult?.count ?? 0),
    totalAUM: parseFloat(String(aumResult?.total ?? "0")) || 0,
    totalProfitPaid: parseFloat(String(profitResult?.total ?? "0")) || 0,
    pendingWithdrawals: Number(pendingResult?.count ?? 0),
    pendingWithdrawalAmount: parseFloat(String(pendingAmountResult?.total ?? "0")) || 0,
    dailyProfitPercent: dailyProfitSetting,
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

export default router;
