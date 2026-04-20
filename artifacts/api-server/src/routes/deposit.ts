import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { blockchainDepositsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { isValidTronAddress } from "../lib/tron-address";
import { logger } from "../lib/logger";

const PLATFORM_TRON_ADDRESS = process.env["PLATFORM_TRON_ADDRESS"] ?? "";

const router = Router();
router.use(authMiddleware);

router.get("/deposit/address", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const users = await db.select({ tronAddress: usersTable.tronAddress })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const tronAddress = users[0]?.tronAddress ?? null;

  res.json({
    platformAddress: PLATFORM_TRON_ADDRESS,
    userTronAddress: tronAddress,
    network: "TRC20",
    token: "USDT",
  });
});

router.post("/deposit/tron-address", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { tronAddress } = req.body;

  if (!tronAddress || !isValidTronAddress(tronAddress)) {
    res.status(400).json({ error: "Invalid TRC20 address" });
    return;
  }

  await db.update(usersTable)
    .set({ tronAddress })
    .where(eq(usersTable.id, userId));

  logger.info({ userId, tronAddress }, "User registered TronLink wallet address");

  res.json({ success: true, tronAddress });
});

router.get("/deposit/history", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(parseInt((req.query["limit"] as string) ?? "20", 10), 50);

  const deposits = await db
    .select()
    .from(blockchainDepositsTable)
    .where(eq(blockchainDepositsTable.userId, userId))
    .orderBy(desc(blockchainDepositsTable.createdAt))
    .limit(limit);

  res.json({
    deposits: deposits.map((d) => ({
      id: d.id,
      txHash: d.txHash,
      fromAddress: d.fromAddress,
      amount: parseFloat(d.amount as string),
      status: d.status,
      credited: d.credited,
      blockTimestamp: d.blockTimestamp?.toISOString() ?? null,
      creditedAt: d.creditedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
  });
});

export default router;
