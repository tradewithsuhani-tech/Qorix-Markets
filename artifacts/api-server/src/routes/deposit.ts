import { Router } from "express";
import { db } from "@workspace/db";
import { depositAddressesTable, blockchainDepositsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { generateTronAddress } from "../lib/tron-address";
import { logger } from "../lib/logger";

const router = Router();
router.use(authMiddleware);

router.get("/deposit/address", async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const existing = await db
    .select()
    .from(depositAddressesTable)
    .where(eq(depositAddressesTable.userId, userId))
    .limit(1);

  if (existing.length > 0) {
    res.json({
      address: existing[0]!.trc20Address,
      network: "TRC20",
      token: "USDT",
    });
    return;
  }

  const { address } = generateTronAddress();

  await db.insert(depositAddressesTable).values({ userId, trc20Address: address });

  logger.info({ userId, address }, "Generated new TRC20 deposit address");

  res.json({
    address,
    network: "TRC20",
    token: "USDT",
  });
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
