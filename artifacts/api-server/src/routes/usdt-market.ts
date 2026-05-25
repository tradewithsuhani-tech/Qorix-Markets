import { Router } from "express";
import { db, walletsTable, systemSettingsTable, transactionsTable } from "@workspace/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { transactionLogger } from "../lib/logger";

const router = Router();

const INR_RATE_KEY = "inr_to_usdt_rate";
const DEFAULT_INR_RATE = "99";

const LIMIT_ORDER_TYPES = ["usdt_limit_buy", "usdt_limit_sell"] as const;

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

// ─── GET /api/usdt-market/rate — public ──────────────────────────────────────
router.get("/usdt-market/rate", async (_req, res) => {
  try {
    const rate = await getRate();
    const jitter = rate * 0.001;
    const lastPrice = +(rate + (Math.random() * jitter * 2 - jitter)).toFixed(2);
    const high24h   = +(rate * 1.019).toFixed(2);
    const low24h    = +(rate * 0.982).toFixed(2);
    res.json({ rate, lastPrice, high24h, low24h });
  } catch {
    res.status(500).json({ error: "Failed to fetch rate" });
  }
});

// ─── GET /api/usdt-market/open-orders — authenticated ────────────────────────
router.get("/usdt-market/open-orders", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.status, "pending"),
          inArray(transactionsTable.type, [...LIMIT_ORDER_TYPES])
        )
      )
      .orderBy(transactionsTable.createdAt);

    const orders = rows.map((r) => {
      // walletAddress field repurposed to store limit price for internal market limit orders
      const limitPrice = r.walletAddress ? parseFloat(r.walletAddress) : null;
      const usdt = parseFloat(r.amount as string);
      const direction = r.type === "usdt_limit_buy" ? "buy" : "sell";
      return {
        id: r.id,
        direction,
        usdt,
        limitPrice,
        inr: limitPrice ? +(usdt * limitPrice).toFixed(2) : null,
        createdAt: r.createdAt,
        status: r.status,
      };
    });

    res.json({ orders });
  } catch (e) {
    transactionLogger.error({ err: e, userId }, "open-orders fetch failed");
    res.status(500).json({ error: "Failed to fetch open orders" });
  }
});

// ─── DELETE /api/usdt-market/open-orders/:id — cancel & refund ───────────────
router.delete("/usdt-market/open-orders/:id", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const orderId = parseInt(req.params.id, 10);
  if (!Number.isFinite(orderId)) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.id, orderId),
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.status, "pending"),
          inArray(transactionsTable.type, [...LIMIT_ORDER_TYPES])
        )
      )
      .limit(1);

    const order = rows[0];
    if (!order) {
      res.status(404).json({ error: "Order not found or already cancelled" });
      return;
    }

    const limitPrice = order.walletAddress ? parseFloat(order.walletAddress) : null;
    const usdt       = parseFloat(order.amount as string);
    const isBuy      = order.type === "usdt_limit_buy";

    await db.transaction(async (tx) => {
      // Refund locked funds
      if (isBuy && limitPrice) {
        const inrLocked = +(usdt * limitPrice).toFixed(2);
        const inrStr    = inrLocked.toFixed(2);
        await tx.update(walletsTable)
          .set({
            mainBalance: sql`${walletsTable.mainBalance} + ${inrStr}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, userId));
      } else if (!isBuy) {
        const amtStr = usdt.toFixed(8);
        await tx.update(walletsTable)
          .set({
            usdtBalance: sql`COALESCE(${walletsTable.usdtBalance}, 0) + ${amtStr}::numeric`,
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, userId));
      }

      // Mark as rejected
      await tx.update(transactionsTable)
        .set({ status: "rejected" })
        .where(eq(transactionsTable.id, orderId));
    });

    res.json({ success: true, orderId });
  } catch (e) {
    transactionLogger.error({ err: e, userId }, "cancel order failed");
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// ─── GET /api/usdt-market/history — completed orders ────────────────────────
router.get("/usdt-market/history", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  try {
    const rows = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          inArray(transactionsTable.type, ["usdt_buy", "usdt_sell", "usdt_limit_buy", "usdt_limit_sell"])
        )
      )
      .orderBy(sql`${transactionsTable.createdAt} DESC`)
      .limit(50);

    const history = rows.map((r) => {
      const isBuy = r.type === "usdt_buy" || r.type === "usdt_limit_buy";
      const isLimit = r.type === "usdt_limit_buy" || r.type === "usdt_limit_sell";
      const limitPrice = isLimit && r.walletAddress ? parseFloat(r.walletAddress) : null;
      const usdt = parseFloat(r.amount as string);
      return {
        id: r.id,
        direction: isBuy ? "buy" : "sell",
        type: isLimit ? "limit" : "market",
        usdt,
        limitPrice,
        status: r.status,
        description: r.description,
        createdAt: r.createdAt,
      };
    });

    res.json({ history });
  } catch (e) {
    transactionLogger.error({ err: e, userId }, "usdt-market history fetch failed");
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// ─── POST /api/usdt-market/swap — authenticated ──────────────────────────────
// Body: { direction: "buy"|"sell", amount: number (USDT), type: "market"|"limit", limitPrice?: number }
// MARKET orders → execute immediately
// LIMIT orders  → lock funds, store as pending (walletAddress = limitPrice)
router.post("/usdt-market/swap", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { direction, amount: rawAmount, type = "market", limitPrice: rawLimitPrice } = req.body ?? {};

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

  const isLimit = type === "limit";
  let limitPrice: number | null = null;
  if (isLimit) {
    limitPrice = parseFloat(rawLimitPrice);
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) {
      res.status(400).json({ error: "Limit orders require a valid limitPrice" });
      return;
    }
  }

  try {
    const marketRate = await getRate();
    const execRate   = isLimit ? limitPrice! : marketRate;
    const inrAmount  = +(amount * execRate).toFixed(2);
    const amountStr  = amount.toFixed(8);
    const inrStr     = inrAmount.toFixed(2);

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

      if (isLimit) {
        // Lock INR, store as pending limit order
        await db.transaction(async (tx) => {
          await tx.update(walletsTable)
            .set({
              mainBalance: sql`${walletsTable.mainBalance} - ${inrStr}::numeric`,
              updatedAt: new Date(),
            })
            .where(eq(walletsTable.userId, userId));
          await tx.insert(transactionsTable).values({
            userId,
            type: "usdt_limit_buy",
            amount: amountStr,
            status: "pending",
            description: `Limit Buy ${amount.toFixed(4)} USDT @ ₹${limitPrice}/USDT (locked ₹${inrAmount})`,
            walletAddress: String(limitPrice),  // repurposed: stores limit price
          });
        });
        res.json({ success: true, direction: "buy", type: "limit", usdt: amount, inr: inrAmount, limitPrice });
      } else {
        // Market: execute immediately
        await db.transaction(async (tx) => {
          await tx.update(walletsTable)
            .set({
              mainBalance: sql`${walletsTable.mainBalance} - ${inrStr}::numeric`,
              usdtBalance: sql`COALESCE(${walletsTable.usdtBalance}, 0) + ${amountStr}::numeric`,
              updatedAt: new Date(),
            })
            .where(eq(walletsTable.userId, userId));
          await tx.insert(transactionsTable).values({
            userId,
            type: "usdt_buy",
            amount: amountStr,
            status: "completed",
            description: `Bought ${amount.toFixed(4)} USDT @ ₹${marketRate}/USDT (Internal Market)`,
          });
        });
        res.json({ success: true, direction: "buy", type: "market", usdt: amount, inr: inrAmount, rate: marketRate });
      }

    } else {
      // SELL
      if (usdtBal < amount) {
        res.status(400).json({
          error: `Insufficient USDT. Need ${amount.toFixed(4)} USDT, available ${usdtBal.toFixed(4)} USDT`,
        });
        return;
      }

      if (isLimit) {
        // Lock USDT, store as pending limit order
        await db.transaction(async (tx) => {
          await tx.update(walletsTable)
            .set({
              usdtBalance: sql`${walletsTable.usdtBalance} - ${amountStr}::numeric`,
              updatedAt: new Date(),
            })
            .where(eq(walletsTable.userId, userId));
          await tx.insert(transactionsTable).values({
            userId,
            type: "usdt_limit_sell",
            amount: amountStr,
            status: "pending",
            description: `Limit Sell ${amount.toFixed(4)} USDT @ ₹${limitPrice}/USDT (locked ${amount} USDT)`,
            walletAddress: String(limitPrice),
          });
        });
        res.json({ success: true, direction: "sell", type: "limit", usdt: amount, inr: inrAmount, limitPrice });
      } else {
        // Market: execute immediately
        await db.transaction(async (tx) => {
          await tx.update(walletsTable)
            .set({
              usdtBalance: sql`${walletsTable.usdtBalance} - ${amountStr}::numeric`,
              mainBalance: sql`${walletsTable.mainBalance} + ${inrStr}::numeric`,
              updatedAt: new Date(),
            })
            .where(eq(walletsTable.userId, userId));
          await tx.insert(transactionsTable).values({
            userId,
            type: "usdt_sell",
            amount: amountStr,
            status: "completed",
            description: `Sold ${amount.toFixed(4)} USDT @ ₹${marketRate}/USDT (Internal Market)`,
          });
        });
        res.json({ success: true, direction: "sell", type: "market", usdt: amount, inr: inrAmount, rate: marketRate });
      }
    }
  } catch (e) {
    transactionLogger.error({ err: e, userId }, "usdt-market swap failed");
    res.status(500).json({ error: "Swap failed. Please try again." });
  }
});

export default router;
