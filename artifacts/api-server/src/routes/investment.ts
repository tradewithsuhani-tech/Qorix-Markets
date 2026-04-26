import { Router } from "express";
import { db, investmentsTable, walletsTable, transactionsTable, tradesTable, equityHistoryTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, getQueryInt, type AuthRequest } from "../middlewares/auth";
import { StartInvestmentBody, ToggleCompoundingBody } from "@workspace/api-zod";
import { ensureUserAccounts, postJournalEntry, journalForTransaction } from "../lib/ledger-service";
import { createNotification } from "../lib/notifications";
import { checkAndFireMilestones } from "../lib/milestone-service";
import { logger } from "../lib/logger";

const REFERRAL_SIGNUP_BONUS_RATE = 0.03;
const REFERRAL_SIGNUP_MIN_DEPOSIT = 100;

const router = Router();
router.use(authMiddleware);

const RISK_DEFAULT_DRAWDOWN: Record<string, number> = {
  low: 3,
  medium: 5,
  high: 10,
};

function formatInvestment(inv: typeof investmentsTable.$inferSelect) {
  const amount = parseFloat(inv.amount as string);
  const totalProfit = parseFloat(inv.totalProfit as string);
  const rawPeak = parseFloat(inv.peakBalance as string);
  const peakBalance = rawPeak > 0 ? rawPeak : amount;
  const currentEquity = amount + totalProfit;
  const drawdownFromPeak = peakBalance > 0
    ? Math.max(0, (peakBalance - currentEquity) / peakBalance * 100)
    : 0;
  const recoveryPct = currentEquity > 0 && peakBalance > currentEquity
    ? (peakBalance / currentEquity - 1) * 100
    : 0;

  return {
    id: inv.id,
    userId: inv.userId,
    amount,
    riskLevel: inv.riskLevel,
    isActive: inv.isActive,
    isPaused: inv.isPaused,
    autoCompound: inv.autoCompound,
    totalProfit,
    dailyProfit: parseFloat(inv.dailyProfit as string),
    drawdown: parseFloat(inv.drawdown as string),
    drawdownLimit: parseFloat(inv.drawdownLimit as string),
    peakBalance,
    drawdownFromPeak: parseFloat(drawdownFromPeak.toFixed(4)),
    recoveryPct: parseFloat(recoveryPct.toFixed(4)),
    startedAt: inv.startedAt?.toISOString() ?? null,
    stoppedAt: inv.stoppedAt?.toISOString() ?? null,
    pausedAt: inv.pausedAt?.toISOString() ?? null,
  };
}

router.get("/investment", async (req: AuthRequest, res) => {
  const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, req.userId!)).limit(1);
  if (invs.length === 0) {
    const [newInv] = await db.insert(investmentsTable).values({ userId: req.userId! }).returning();
    res.json(formatInvestment(newInv!));
    return;
  }
  res.json(formatInvestment(invs[0]!));
});

router.post("/investment/start", async (req: AuthRequest, res) => {
  const result = StartInvestmentBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const { amount, riskLevel } = result.data;
  const riskKey = riskLevel.toLowerCase();
  if (!["low", "medium", "high"].includes(riskKey)) {
    res.status(400).json({ error: "Invalid risk level. Use low, medium, or high" });
    return;
  }
  if (amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }

  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
  const wallet = wallets[0];
  if (!wallet) {
    res.status(404).json({ error: "Wallet not found" });
    return;
  }

  const tradingBalance = parseFloat(wallet.tradingBalance as string);
  if (amount > tradingBalance) {
    res.status(400).json({ error: "Insufficient trading balance" });
    return;
  }

  const existingInvs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, req.userId!)).limit(1);
  const existingDrawdownLimit = existingInvs[0]
    ? parseFloat(existingInvs[0].drawdownLimit as string)
    : RISK_DEFAULT_DRAWDOWN[riskKey] ?? 5;

  const drawdownLimit = existingDrawdownLimit > 0 ? existingDrawdownLimit : (RISK_DEFAULT_DRAWDOWN[riskKey] ?? 5);

  const updated = await db.transaction(async (tx) => {
    const [inv] = await tx.update(investmentsTable)
      .set({
        amount: amount.toString(),
        riskLevel: riskKey,
        isActive: true,
        isPaused: false,
        dailyProfit: "0",
        drawdown: "0",
        peakBalance: amount.toString(),
        drawdownLimit: drawdownLimit.toString(),
        startedAt: new Date(),
        stoppedAt: null,
        pausedAt: null,
      })
      .where(eq(investmentsTable.userId, req.userId!))
      .returning();

    // Read referralBonusPaid AFTER the row is locked by the update above to avoid TOCTOU race.
    const alreadyPaidReferralBonus = inv?.referralBonusPaid ?? false;

    await tx.insert(transactionsTable).values({
      userId: req.userId!,
      type: "investment",
      amount: amount.toString(),
      status: "completed",
      description: `Started auto trading with $${amount.toFixed(2)} at ${riskKey} risk (${drawdownLimit}% protection)`,
    });

    // ── One-time referral signup bonus (3% of first activation amount) ──
    // Conditions:
    //   1) sponsor exists and is not the user themselves
    //   2) bonus not already paid for this referral
    //   3) activation amount meets minimum deposit threshold
    //   4) sponsor has an active investment of their own
    if (!alreadyPaidReferralBonus && amount >= REFERRAL_SIGNUP_MIN_DEPOSIT) {
      const userRows = await tx
        .select({ sponsorId: usersTable.sponsorId })
        .from(usersTable)
        .where(eq(usersTable.id, req.userId!))
        .limit(1);

      const sponsorId = userRows[0]?.sponsorId;
      if (sponsorId && sponsorId !== req.userId && sponsorId !== 0) {
        const sponsorInvRows = await tx
          .select({ isActive: investmentsTable.isActive })
          .from(investmentsTable)
          .where(eq(investmentsTable.userId, sponsorId))
          .limit(1);

        if (sponsorInvRows[0]?.isActive) {
          const signupBonus = amount * REFERRAL_SIGNUP_BONUS_RATE;

          const sponsorWalletRows = await tx
            .select()
            .from(walletsTable)
            .where(eq(walletsTable.userId, sponsorId))
            .limit(1);

          if (sponsorWalletRows.length > 0) {
            const sponsorWallet = sponsorWalletRows[0]!;
            const sponsorProfitBalance = parseFloat(sponsorWallet.profitBalance as string);

            await tx
              .update(walletsTable)
              .set({
                profitBalance: (sponsorProfitBalance + signupBonus).toString(),
                updatedAt: new Date(),
              })
              .where(eq(walletsTable.userId, sponsorId));

            const [bonusTxn] = await tx.insert(transactionsTable).values({
              userId: sponsorId,
              type: "referral_bonus",
              amount: signupBonus.toString(),
              status: "completed",
              description: `Partner activation bonus: 3% of $${amount.toFixed(2)} first investment ($${signupBonus.toFixed(2)})`,
            }).returning({ id: transactionsTable.id });

            await ensureUserAccounts(sponsorId, tx);
            await postJournalEntry(
              journalForTransaction(bonusTxn!.id),
              [
                { accountCode: "platform:referral_expense", entryType: "debit", amount: signupBonus, description: `Partner activation bonus to sponsor ${sponsorId}` },
                { accountCode: `user:${sponsorId}:profit`, entryType: "credit", amount: signupBonus, description: `Partner activation bonus credited to sponsor ${sponsorId}` },
              ],
              bonusTxn!.id,
              tx,
            );

            await tx
              .update(investmentsTable)
              .set({ referralBonusPaid: true })
              .where(eq(investmentsTable.userId, req.userId!));

            await createNotification(
              sponsorId,
              "referral_bonus",
              "🎉 New Partner Activated",
              `Your partner just started trading with $${amount.toFixed(2)}. You earned $${signupBonus.toFixed(2)} activation bonus — credited to your profit balance.`,
            );

            logger.info({ sponsorId, referralUserId: req.userId, amount, bonus: signupBonus }, "Referral signup bonus credited");
          }
        }
      }
    }

    return inv!;
  });

  // Fire milestone check for sponsor (post-commit, fire-and-forget — never blocks user response)
  try {
    const sponsorRows = await db
      .select({ sponsorId: usersTable.sponsorId })
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);
    const sponsorId = sponsorRows[0]?.sponsorId;
    if (sponsorId && sponsorId !== req.userId && sponsorId > 0) {
      void checkAndFireMilestones(sponsorId);
    }
  } catch (err) {
    logger.warn({ err, userId: req.userId }, "Milestone check enqueue failed (non-fatal)");
  }

  res.json(formatInvestment(updated));
});

router.post("/investment/stop", async (req: AuthRequest, res) => {
  const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, req.userId!)).limit(1);
  const inv = invs[0];
  if (!inv) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  const [updated] = await db.update(investmentsTable)
    .set({ isActive: false, stoppedAt: new Date() })
    .where(eq(investmentsTable.userId, req.userId!))
    .returning();

  res.json(formatInvestment(updated!));
});

router.patch("/investment/protection", async (req: AuthRequest, res) => {
  const { drawdownLimit } = req.body ?? {};
  if (typeof drawdownLimit !== "number" || drawdownLimit < 1 || drawdownLimit > 50) {
    res.status(400).json({ error: "drawdownLimit must be a number between 1 and 50" });
    return;
  }
  const [updated] = await db.update(investmentsTable)
    .set({ drawdownLimit: drawdownLimit.toString() })
    .where(eq(investmentsTable.userId, req.userId!))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Investment not found" });
    return;
  }

  res.json(formatInvestment(updated));
});

router.patch("/investment/compounding", async (req: AuthRequest, res) => {
  const result = ToggleCompoundingBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [updated] = await db.update(investmentsTable)
    .set({ autoCompound: result.data.autoCompound })
    .where(eq(investmentsTable.userId, req.userId!))
    .returning();

  res.json(formatInvestment(updated!));
});

router.get("/investment/trades", async (req: AuthRequest, res) => {
  const limit = getQueryInt(req, "limit", 10);

  const trades = await db.select().from(tradesTable)
    .where(eq(tradesTable.userId, req.userId!))
    .orderBy(desc(tradesTable.executedAt))
    .limit(limit);

  res.json(trades.map((t) => ({
    id: t.id,
    symbol: t.symbol,
    direction: t.direction,
    entryPrice: parseFloat(t.entryPrice as string),
    exitPrice: parseFloat(t.exitPrice as string),
    profit: parseFloat(t.profit as string),
    profitPercent: parseFloat(t.profitPercent as string),
    executedAt: t.executedAt.toISOString(),
  })));
});

export default router;
