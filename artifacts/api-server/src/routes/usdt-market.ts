import { Router } from "express";
import { db, walletsTable, systemSettingsTable, transactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { transactionLogger } from "../lib/logger";

const router = Router();

const INR_RATE_KEY = "inr_to_usdt_rate";
const DEFAULT_INR_RATE = "99";

async function getRate(): Promise<number> {
  const rows = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, INR_RATE_KEY))
    .limit(1);
  const raw = rows[0]?.value ?? DEFAULT_INR_RATE;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : Number(DEFAULT_INR_RATE);
}

// GET /api/usdt-market/rate — public, no auth needed
router.get("/usdt-market/rate", async (_req, res) => {
  try {
    const rate = await getRate();
    const jitter = rate * 0.001;
    const lastPrice = +(rate + (Math.random() * jitter * 2 - jitter)).toFixed(2);
    const high24h  = +(rate * 1.019).toFixed(2);
    const low24h   = +(rate * 0.982).toFixed(2);
    res.json({ rate, lastPrice, high24h, low24h });
  } catch {
    res.status(500).json({ error: "Failed to fetch rate" });
  }
});

// POST /api/usdt-market/swap — authenticated
// Body: { direction: "buy" | "sell", amount: number (USDT), type: "market" | "limit" }
// BUY  → spend INR (mainBalance),  receive USDT (usdtBalance)
// SELL → spend USDT (usdtBalance), receive INR  (mainBalance)
router.post("/usdt-market/swap", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { direction, amount: rawAmount, type = "market" } = req.body ?? {};

  if (!["buy", "sell"].includes(direction)) {
    res.status(400).json({ error: "direction must be 'buy' or 'sell'" });
    return;
  }
  const amount = parseFloat(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }
  if (amount < 1) {
    res.status(400).json({ error: "Minimum order is 1 USDT" });
    return;
  }

  try {
    const rate  = await getRate();
    const inrAmount = +(amount * rate).toFixed(2);
    const amountStr    = amount.toFixed(8);
    const inrAmountStr = inrAmount.toFixed(2);

    const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
    const wallet  = wallets[0];
    if (!wallet) {
      res.status(400).json({ error: "Wallet not found" });
      return;
    }

    const mainBal = parseFloat(wallet.mainBalance as string);
    const usdtBal = parseFloat((wallet.usdtBalance ?? "0") as string);

    if (direction === "buy") {
      if (mainBal < inrAmount) {
        res.status(400).json({
          error: `Insufficient INR balance. Need ₹${inrAmount.toFixed(2)}, available ₹${mainBal.toFixed(2)}`,
        });
        return;
      }
      await db.transaction(async (tx) => {
        await tx.update(walletsTable)
          .set({
            mainBalance: sql`${walletsTable.mainBalance} - ${inrAmountStr}::numeric`,
            usdtBalance: sql`COALESCE(${walletsTable.usdtBalance}, 0) + ${amountStr}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, userId));
        await tx.insert(transactionsTable).values({
          userId,
          type: "usdt_buy",
          amount: amountStr,
          status: "completed",
          description: `Bought ${amount.toFixed(4)} USDT @ ₹${rate}/USDT (Internal Market)`,
        });
      });
      res.json({ success: true, direction: "buy", usdt: amount, inr: inrAmount, rate, type });
    } else {
      if (usdtBal < amount) {
        res.status(400).json({
          error: `Insufficient USDT. Need ${amount.toFixed(4)} USDT, available ${usdtBal.toFixed(4)} USDT`,
        });
        return;
      }
      await db.transaction(async (tx) => {
        await tx.update(walletsTable)
          .set({
            usdtBalance: sql`${walletsTable.usdtBalance} - ${amountStr}::numeric`,
            mainBalance: sql`${walletsTable.mainBalance} + ${inrAmountStr}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, userId));
        await tx.insert(transactionsTable).values({
          userId,
          type: "usdt_sell",
          amount: amountStr,
          status: "completed",
          description: `Sold ${amount.toFixed(4)} USDT @ ₹${rate}/USDT (Internal Market)`,
        });
      });
      res.json({ success: true, direction: "sell", usdt: amount, inr: inrAmount, rate, type });
    }
  } catch (e) {
    transactionLogger.error({ err: e, userId }, "usdt-market swap failed");
    res.status(500).json({ error: "Swap failed. Please try again." });
  }
});

export default router;
