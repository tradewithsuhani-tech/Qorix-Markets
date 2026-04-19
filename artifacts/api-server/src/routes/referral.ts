import { Router } from "express";
import { db, usersTable, investmentsTable, transactionsTable } from "@workspace/db";
import { eq, sum } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

router.get("/referral", async (req: AuthRequest, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const user = users[0];
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const referredUsers = await db.select().from(usersTable).where(eq(usersTable.sponsorId, req.userId!));
  const activeCount = referredUsers.filter((u) => u.id).length;

  const bonusTxs = await db.select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId!));

  const bonusRows = await db.select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "referral_bonus"));

  const totalEarned = 0;
  const monthlyEarnings = 0;

  res.json({
    referralCode: user.referralCode,
    totalReferred: referredUsers.length,
    activeReferrals: activeCount,
    totalEarned,
    monthlyEarnings,
  });
});

router.get("/referral/referred-users", async (req: AuthRequest, res) => {
  const referredUsers = await db.select().from(usersTable).where(eq(usersTable.sponsorId, req.userId!));

  const result = await Promise.all(referredUsers.map(async (u) => {
    const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, u.id)).limit(1);
    const inv = invs[0];
    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      investmentAmount: inv ? parseFloat(inv.amount as string) : 0,
      isActive: inv?.isActive ?? false,
      joinedAt: u.createdAt.toISOString(),
    };
  }));

  res.json(result);
});

export default router;
