import { Router } from "express";
import { db, transactionsTable } from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { authMiddleware, getQueryInt, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

router.get("/transactions", async (req: AuthRequest, res) => {
  const page = getQueryInt(req, "page", 1);
  const limit = getQueryInt(req, "limit", 20);
  const offset = (page - 1) * limit;

  const [totalResult] = await db.select({ count: count() }).from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId!));
  const total = Number(totalResult?.count ?? 0);

  const txs = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId!))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({
    data: txs.map((t) => ({
      id: t.id,
      userId: t.userId,
      type: t.type,
      amount: parseFloat(t.amount as string),
      status: t.status,
      description: t.description,
      walletAddress: t.walletAddress ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

export default router;
