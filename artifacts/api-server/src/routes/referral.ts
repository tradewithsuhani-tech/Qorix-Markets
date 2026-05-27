import { Router } from "express";
import { db, usersTable, investmentsTable, transactionsTable } from "@workspace/db";
import { and, eq, sum, count, gte, lte } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

const REFERRAL_LINK_BASE = "https://qorixmarkets.com/register?ref=";

function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx <= 0) return email;
  return email[0] + "***" + email.slice(atIdx);
}

// ── GET /referral ────────────────────────────────────────────────────────────
// Returns the calling user's referral summary.
// activeReferrals = referred users who have a currently active investment.
// totalEarned / monthlyEarnings = sum of referral_bonus transactions
//   (calendar month for monthly, all-time for total).
router.get("/referral", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const user = users[0];
  if (!user) {
    res.status(404).json({ error: "user_not_found", message: "User not found." });
    return;
  }

  // Count referred users (excluding smoke-test account)
  const [totalCountResult] = await db
    .select({ cnt: count() })
    .from(usersTable)
    .where(and(eq(usersTable.sponsorId, userId), eq(usersTable.isSmokeTest, false)));
  const totalReferred = Number(totalCountResult?.cnt ?? 0);

  // Count active referrals = referred users with isActive investment
  const [activeCountResult] = await db
    .select({ cnt: count() })
    .from(usersTable)
    .innerJoin(
      investmentsTable,
      and(
        eq(investmentsTable.userId, usersTable.id),
        eq(investmentsTable.isActive, true),
      ),
    )
    .where(and(eq(usersTable.sponsorId, userId), eq(usersTable.isSmokeTest, false)));
  const activeReferrals = Number(activeCountResult?.cnt ?? 0);

  // Total referral_bonus earned (all-time)
  const [totalRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(
      and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "referral_bonus")),
    );
  const totalEarned = +(parseFloat(totalRow?.total ?? "0") || 0).toFixed(6);

  // Monthly referral_bonus earned (calendar month)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [monthlyRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "referral_bonus"),
        gte(transactionsTable.createdAt, monthStart),
        lte(transactionsTable.createdAt, monthEnd),
      ),
    );
  const monthlyEarnings = +(parseFloat(monthlyRow?.total ?? "0") || 0).toFixed(6);

  res.json({
    referralCode: user.referralCode,
    totalReferred,
    activeReferrals,
    totalEarned,
    monthlyEarnings,
    referralLink: REFERRAL_LINK_BASE + user.referralCode,
  });
});

// ── GET /referral/referred-users ─────────────────────────────────────────────
// Paginated list of referred users with masked email.
// Query: page (default 1), limit (default 50, max 100)
// Returns a flat array matching the Flutter spec.
router.get("/referral/referred-users", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const page = Math.max(1, parseInt(String(req.query["page"] ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] ?? "50"), 10) || 50));
  const offset = (page - 1) * limit;

  const [totalCountResult] = await db
    .select({ cnt: count() })
    .from(usersTable)
    .where(and(eq(usersTable.sponsorId, userId), eq(usersTable.isSmokeTest, false)));
  const total = Number(totalCountResult?.cnt ?? 0);

  const referredUsers = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.sponsorId, userId), eq(usersTable.isSmokeTest, false)))
    .orderBy(usersTable.createdAt)
    .limit(limit)
    .offset(offset);

  const result = await Promise.all(
    referredUsers.map(async (u) => {
      const [inv] = await db
        .select({
          amount: investmentsTable.amount,
          isActive: investmentsTable.isActive,
        })
        .from(investmentsTable)
        .where(eq(investmentsTable.userId, u.id))
        .limit(1);
      return {
        id: u.id,
        fullName: u.fullName,
        email: maskEmail(u.email),
        investmentAmount: inv ? +parseFloat(inv.amount as string).toFixed(6) : 0,
        isActive: inv?.isActive ?? false,
        joinedAt: u.createdAt.toISOString(),
      };
    }),
  );

  res.json(result);
});

export default router;
