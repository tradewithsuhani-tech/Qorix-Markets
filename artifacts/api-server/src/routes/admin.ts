import { Router } from "express";
import { db, usersTable, walletsTable, investmentsTable, transactionsTable, tradesTable } from "@workspace/db";
import { eq, sum, count, and, desc, sql } from "drizzle-orm";
import { authMiddleware, adminMiddleware, type AuthRequest } from "../middlewares/auth";
import { SetDailyProfitBody } from "@workspace/api-zod";

const router = Router();
router.use(authMiddleware);
router.use(adminMiddleware);

const DRAWDOWN_LIMITS: Record<string, number> = {
  low: 0.03,
  medium: 0.05,
  high: 0.10,
};

router.get("/admin/stats", async (req, res) => {
  const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);
  const [activeInvResult] = await db.select({ count: count() }).from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const [aumResult] = await db.select({ total: sum(investmentsTable.amount) }).from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));
  const [profitResult] = await db.select({ total: sum(investmentsTable.totalProfit) }).from(investmentsTable);
  const [pendingResult] = await db.select({ count: count() }).from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));
  const [pendingAmountResult] = await db.select({ total: sum(transactionsTable.amount) }).from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  const dailyProfitSetting = 0;

  res.json({
    totalUsers: Number(totalUsersResult?.count ?? 0),
    activeInvestors: Number(activeInvResult?.count ?? 0),
    totalAUM: parseFloat(String(aumResult?.total ?? "0")) || 0,
    totalProfitPaid: parseFloat(String(profitResult?.total ?? "0")) || 0,
    pendingWithdrawals: Number(pendingResult?.count ?? 0),
    pendingWithdrawalAmount: parseFloat(String(pendingAmountResult?.total ?? "0")) || 0,
    dailyProfitPercent: dailyProfitSetting,
  });
});

router.post("/admin/profit", async (req, res) => {
  const result = SetDailyProfitBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { profitPercent } = result.data;
  if (profitPercent < 0 || profitPercent > 100) {
    res.status(400).json({ error: "Profit percent must be between 0 and 100" });
    return;
  }

  const activeInvestments = await db.select()
    .from(investmentsTable)
    .where(eq(investmentsTable.isActive, true));

  for (const inv of activeInvestments) {
    const amount = parseFloat(inv.amount as string);
    const totalProfit = parseFloat(inv.totalProfit as string);
    const currentDrawdown = parseFloat(inv.drawdown as string);
    const drawdownLimit = (DRAWDOWN_LIMITS[inv.riskLevel] ?? 0.05) * amount;

    const dailyProfitAmount = amount * (profitPercent / 100);

    if (currentDrawdown >= drawdownLimit) {
      await db.update(investmentsTable)
        .set({ isActive: false, stoppedAt: new Date() })
        .where(eq(investmentsTable.userId, inv.userId));
      continue;
    }

    const newTotalProfit = totalProfit + dailyProfitAmount;
    let newDrawdown = currentDrawdown;
    if (profitPercent < 0) {
      newDrawdown = currentDrawdown + Math.abs(dailyProfitAmount);
    }

    const wallet = await db.select().from(walletsTable).where(eq(walletsTable.userId, inv.userId)).limit(1);
    if (wallet.length > 0) {
      const profitBalance = parseFloat(wallet[0]!.profitBalance as string);
      const newProfitBalance = profitBalance + dailyProfitAmount;

      if (inv.autoCompound) {
        const tradingBalance = parseFloat(wallet[0]!.tradingBalance as string);
        await db.update(walletsTable)
          .set({
            tradingBalance: (tradingBalance + dailyProfitAmount).toString(),
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, inv.userId));

        await db.update(investmentsTable)
          .set({
            amount: (amount + dailyProfitAmount).toString(),
            totalProfit: newTotalProfit.toString(),
            dailyProfit: dailyProfitAmount.toString(),
            drawdown: newDrawdown.toString(),
          })
          .where(eq(investmentsTable.userId, inv.userId));
      } else {
        await db.update(walletsTable)
          .set({ profitBalance: newProfitBalance.toString(), updatedAt: new Date() })
          .where(eq(walletsTable.userId, inv.userId));

        await db.update(investmentsTable)
          .set({
            totalProfit: newTotalProfit.toString(),
            dailyProfit: dailyProfitAmount.toString(),
            drawdown: newDrawdown.toString(),
          })
          .where(eq(investmentsTable.userId, inv.userId));
      }

      await db.insert(transactionsTable).values({
        userId: inv.userId,
        type: "profit",
        amount: dailyProfitAmount.toString(),
        status: "completed",
        description: `Daily profit distribution: ${profitPercent}%`,
      });

      const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT"];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)]!;
      const direction = profitPercent >= 0 ? "buy" : "sell";
      const basePrice = symbol.startsWith("BTC") ? 67000 : symbol.startsWith("ETH") ? 3200 : symbol.startsWith("SOL") ? 145 : 420;
      const entryPrice = basePrice * (1 - 0.005);
      const exitPrice = basePrice * (1 + profitPercent / 100);

      await db.insert(tradesTable).values({
        userId: inv.userId,
        symbol,
        direction,
        entryPrice: entryPrice.toString(),
        exitPrice: exitPrice.toString(),
        profit: dailyProfitAmount.toString(),
        profitPercent: profitPercent.toString(),
      });
    }
  }

  const [totalUsersResult] = await db.select({ count: count() }).from(usersTable);
  const [activeInvResult] = await db.select({ count: count() }).from(investmentsTable).where(eq(investmentsTable.isActive, true));
  const [aumResult] = await db.select({ total: sum(investmentsTable.amount) }).from(investmentsTable).where(eq(investmentsTable.isActive, true));
  const [profitResult] = await db.select({ total: sum(investmentsTable.totalProfit) }).from(investmentsTable);
  const [pendingResult] = await db.select({ count: count() }).from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));
  const [pendingAmountResult] = await db.select({ total: sum(transactionsTable.amount) }).from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")));

  res.json({
    totalUsers: Number(totalUsersResult?.count ?? 0),
    activeInvestors: Number(activeInvResult?.count ?? 0),
    totalAUM: parseFloat(String(aumResult?.total ?? "0")) || 0,
    totalProfitPaid: parseFloat(String(profitResult?.total ?? "0")) || 0,
    pendingWithdrawals: Number(pendingResult?.count ?? 0),
    pendingWithdrawalAmount: parseFloat(String(pendingAmountResult?.total ?? "0")) || 0,
    dailyProfitPercent: profitPercent,
  });
});

router.get("/admin/users", async (req, res) => {
  const page = parseInt(req.query["page"] as string) || 1;
  const limit = parseInt(req.query["limit"] as string) || 20;
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ count: count() }).from(usersTable);
  const total = Number(totalResult?.count ?? 0);

  const allUsers = await db.select().from(usersTable).limit(limit).offset(offset);

  const data = await Promise.all(allUsers.map(async (u) => {
    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, u.id)).limit(1);
    const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, u.id)).limit(1);
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
  }));

  res.json({ data, total, page, totalPages: Math.ceil(total / limit) });
});

router.get("/admin/withdrawals", async (req, res) => {
  const pending = await db.select().from(transactionsTable)
    .where(and(eq(transactionsTable.type, "withdrawal"), eq(transactionsTable.status, "pending")))
    .orderBy(desc(transactionsTable.createdAt));

  const result = await Promise.all(pending.map(async (tx) => {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, tx.userId)).limit(1);
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
  }));

  res.json(result);
});

router.post("/admin/withdrawals/:id/approve", async (req: AuthRequest, res) => {
  const id = parseInt(req.params["id"]!);
  const [updated] = await db.update(transactionsTable)
    .set({ status: "completed" })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.type, "withdrawal")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  const user = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);

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
  const [updated] = await db.update(transactionsTable)
    .set({ status: "rejected" })
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.type, "withdrawal")))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  const txUser = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);

  if (txUser.length > 0) {
    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, updated.userId)).limit(1);
    if (wallets.length > 0) {
      const profitBalance = parseFloat(wallets[0]!.profitBalance as string);
      const refundAmount = parseFloat(updated.amount as string);
      await db.update(walletsTable)
        .set({ profitBalance: (profitBalance + refundAmount).toString(), updatedAt: new Date() })
        .where(eq(walletsTable.userId, updated.userId));
    }
  }

  const user = txUser[0];
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
