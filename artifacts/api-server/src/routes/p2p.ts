import { Router } from "express";
import { db, walletsTable, usersTable } from "@workspace/db";
import {
  p2pWalletsTable,
  p2pAdsTable,
  p2pOrdersTable,
  p2pEscrowTransactionsTable,
  p2pUserPaymentMethodsTable,
  p2pChatMessagesTable,
  p2pRatingsTable,
} from "@workspace/db";
import { eq, and, or, ne, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();
router.use(authMiddleware);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateP2pWallet(userId: number) {
  const existing = await db.select().from(p2pWalletsTable).where(eq(p2pWalletsTable.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0]!;
  const [created] = await db.insert(p2pWalletsTable).values({ userId }).returning();
  return created!;
}

function parseNum(v: string | number): number {
  return typeof v === "number" ? v : parseFloat(v as string);
}

function formatWallet(w: typeof p2pWalletsTable.$inferSelect) {
  return {
    id: w.id,
    userId: w.userId,
    availableBalance: parseNum(w.availableBalance as string),
    frozenBalance: parseNum(w.frozenBalance as string),
    escrowBalance: parseNum(w.escrowBalance as string),
    updatedAt: w.updatedAt,
  };
}

// ─── P2P Wallet ───────────────────────────────────────────────────────────────

// GET /p2p/wallet
router.get("/p2p/wallet", async (req: AuthRequest, res) => {
  try {
    const wallet = await getOrCreateP2pWallet(req.userId!);
    res.json(formatWallet(wallet));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch P2P wallet" });
  }
});

// POST /p2p/wallet/fund — move USDT from main wallet to P2P wallet
const FundSchema = z.object({ amount: z.number().positive().max(100000) });
router.post("/p2p/wallet/fund", async (req: AuthRequest, res) => {
  const result = FundSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid amount" }); return; }
  const { amount } = result.data;

  try {
    await db.transaction(async (tx) => {
      const [mainWallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
      if (!mainWallet) throw new Error("Main wallet not found");
      const mainBal = parseNum(mainWallet.mainBalance as string);
      if (mainBal < amount) throw new Error("Insufficient main balance");

      await tx.update(walletsTable)
        .set({ mainBalance: sql`${walletsTable.mainBalance} - ${amount}` })
        .where(eq(walletsTable.userId, req.userId!));

      const p2pWallet = await getOrCreateP2pWallet(req.userId!);
      await tx.update(p2pWalletsTable)
        .set({
          availableBalance: sql`${p2pWalletsTable.availableBalance} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(eq(p2pWalletsTable.id, p2pWallet.id));
    });

    const updated = await getOrCreateP2pWallet(req.userId!);
    res.json({ success: true, wallet: formatWallet(updated) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to fund P2P wallet" });
  }
});

// POST /p2p/wallet/withdraw — move USDT back from P2P to main wallet
const WithdrawP2pSchema = z.object({ amount: z.number().positive().max(100000) });
router.post("/p2p/wallet/withdraw", async (req: AuthRequest, res) => {
  const result = WithdrawP2pSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid amount" }); return; }
  const { amount } = result.data;

  try {
    await db.transaction(async (tx) => {
      const [p2pWallet] = await tx.select().from(p2pWalletsTable).where(eq(p2pWalletsTable.userId, req.userId!)).limit(1);
      if (!p2pWallet) throw new Error("P2P wallet not found");
      const avail = parseNum(p2pWallet.availableBalance as string);
      if (avail < amount) throw new Error("Insufficient P2P available balance");

      await tx.update(p2pWalletsTable)
        .set({ availableBalance: sql`${p2pWalletsTable.availableBalance} - ${amount}`, updatedAt: new Date() })
        .where(eq(p2pWalletsTable.userId, req.userId!));

      await tx.update(walletsTable)
        .set({ mainBalance: sql`${walletsTable.mainBalance} + ${amount}` })
        .where(eq(walletsTable.userId, req.userId!));
    });

    const updated = await getOrCreateP2pWallet(req.userId!);
    res.json({ success: true, wallet: formatWallet(updated) });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to withdraw from P2P wallet" });
  }
});

// ─── Payment Methods ──────────────────────────────────────────────────────────

// GET /p2p/payment-methods
router.get("/p2p/payment-methods", async (req: AuthRequest, res) => {
  try {
    const methods = await db.select().from(p2pUserPaymentMethodsTable)
      .where(and(eq(p2pUserPaymentMethodsTable.userId, req.userId!), eq(p2pUserPaymentMethodsTable.isActive, true)))
      .orderBy(desc(p2pUserPaymentMethodsTable.createdAt));
    res.json(methods);
  } catch {
    res.status(500).json({ error: "Failed to fetch payment methods" });
  }
});

const PaymentMethodSchema = z.object({
  type: z.enum(["UPI", "BANK", "IMPS"]),
  displayName: z.string().min(2).max(100),
  upiId: z.string().max(100).optional(),
  bankName: z.string().max(100).optional(),
  accountHolder: z.string().max(200).optional(),
  accountNumber: z.string().max(50).optional(),
  ifsc: z.string().max(20).optional(),
});

// POST /p2p/payment-methods
router.post("/p2p/payment-methods", async (req: AuthRequest, res) => {
  const result = PaymentMethodSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid data", details: result.error.issues }); return; }

  try {
    const count = await db.select({ c: sql<number>`count(*)` }).from(p2pUserPaymentMethodsTable)
      .where(and(eq(p2pUserPaymentMethodsTable.userId, req.userId!), eq(p2pUserPaymentMethodsTable.isActive, true)));
    if (Number(count[0]?.c ?? 0) >= 10) { res.status(400).json({ error: "Maximum 10 payment methods allowed" }); return; }

    const [method] = await db.insert(p2pUserPaymentMethodsTable).values({ userId: req.userId!, ...result.data }).returning();
    res.json(method);
  } catch {
    res.status(500).json({ error: "Failed to add payment method" });
  }
});

// DELETE /p2p/payment-methods/:id
router.delete("/p2p/payment-methods/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.update(p2pUserPaymentMethodsTable)
      .set({ isActive: false })
      .where(and(eq(p2pUserPaymentMethodsTable.id, id), eq(p2pUserPaymentMethodsTable.userId, req.userId!)));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete payment method" });
  }
});

// ─── P2P Ads ──────────────────────────────────────────────────────────────────

// GET /p2p/ads — public listing (filterable by type, paymentMethod)
router.get("/p2p/ads", async (req: AuthRequest, res) => {
  try {
    const type = (req.query.type as string)?.toUpperCase(); // BUY | SELL
    const paymentMethodFilter = (req.query.paymentMethod as string)?.toLowerCase();
    const conditions = [eq(p2pAdsTable.status, "active")];
    if (type === "BUY" || type === "SELL") conditions.push(eq(p2pAdsTable.type, type));

    const ads = await db
      .select({
        id: p2pAdsTable.id,
        userId: p2pAdsTable.userId,
        type: p2pAdsTable.type,
        asset: p2pAdsTable.asset,
        fiatCurrency: p2pAdsTable.fiatCurrency,
        price: p2pAdsTable.price,
        quantity: p2pAdsTable.quantity,
        minLimit: p2pAdsTable.minLimit,
        maxLimit: p2pAdsTable.maxLimit,
        paymentMethods: p2pAdsTable.paymentMethods,
        terms: p2pAdsTable.terms,
        filledQuantity: p2pAdsTable.filledQuantity,
        createdAt: p2pAdsTable.createdAt,
        advertiserName: usersTable.fullName,
      })
      .from(p2pAdsTable)
      .innerJoin(usersTable, eq(p2pAdsTable.userId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(p2pAdsTable.createdAt))
      .limit(50);

    let result = ads.map((a) => ({
      ...a,
      price: parseNum(a.price as string),
      quantity: parseNum(a.quantity as string),
      minLimit: parseNum(a.minLimit as string),
      maxLimit: parseNum(a.maxLimit as string),
      filledQuantity: parseNum(a.filledQuantity as string),
      remainingQuantity: parseNum(a.quantity as string) - parseNum(a.filledQuantity as string),
      paymentMethods: JSON.parse(a.paymentMethods as string) as string[],
      advertiserName: (a.advertiserName as string).split(" ")[0] + "***",
    }));
    // Filter by payment method if specified
    if (paymentMethodFilter) {
      result = result.filter((a) =>
        a.paymentMethods.some((m) => m.toLowerCase().includes(paymentMethodFilter))
      );
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch ads" });
  }
});

// GET /p2p/ads/my — current user's ads
router.get("/p2p/ads/my", async (req: AuthRequest, res) => {
  try {
    const ads = await db.select().from(p2pAdsTable)
      .where(eq(p2pAdsTable.userId, req.userId!))
      .orderBy(desc(p2pAdsTable.createdAt));
    res.json(ads.map((a) => ({
      ...a,
      price: parseNum(a.price as string),
      quantity: parseNum(a.quantity as string),
      minLimit: parseNum(a.minLimit as string),
      maxLimit: parseNum(a.maxLimit as string),
      filledQuantity: parseNum(a.filledQuantity as string),
      remainingQuantity: parseNum(a.quantity as string) - parseNum(a.filledQuantity as string),
      paymentMethods: JSON.parse(a.paymentMethods as string),
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch your ads" });
  }
});

const CreateAdSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  price: z.number().positive(),
  quantity: z.number().positive().max(100000),
  minLimit: z.number().positive(),
  maxLimit: z.number().positive(),
  paymentMethods: z.array(z.string()).min(1),
  terms: z.string().max(500).optional(),
});

// POST /p2p/ads
router.post("/p2p/ads", async (req: AuthRequest, res) => {
  const result = CreateAdSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid data", details: result.error.issues }); return; }
  const { type, price, quantity, minLimit, maxLimit, paymentMethods, terms } = result.data;

  if (minLimit >= maxLimit) { res.status(400).json({ error: "min_limit must be less than max_limit" }); return; }
  if (minLimit / price > quantity) { res.status(400).json({ error: "min_limit exceeds total quantity" }); return; }

  try {
    let ad: typeof p2pAdsTable.$inferSelect;

    if (type === "SELL") {
      // SELL ad: lock seller's USDT from Funding Wallet (tradingBalance) → p2p frozenBalance
      await db.transaction(async (tx) => {
        const [mainWallet] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
        if (!mainWallet) throw new Error("Wallet not found");
        const tradingBal = parseNum(mainWallet.tradingBalance as string);
        if (tradingBal < quantity) throw new Error("Insufficient Funding Wallet balance to create SELL ad");

        // Deduct from Funding Wallet (lock for SELL ad)
        await tx.update(walletsTable).set({
          tradingBalance: sql`${walletsTable.tradingBalance} - ${quantity}`,
        }).where(eq(walletsTable.userId, req.userId!));

        [ad] = await tx.insert(p2pAdsTable).values({
          userId: req.userId!,
          type,
          price: String(price),
          quantity: String(quantity),
          minLimit: String(minLimit),
          maxLimit: String(maxLimit),
          paymentMethods: JSON.stringify(paymentMethods),
          terms,
        }).returning();
      });
    } else {
      // BUY ad: no balance lock needed (buyer pays fiat, receives USDT)
      [ad] = await db.insert(p2pAdsTable).values({
        userId: req.userId!,
        type,
        price: String(price),
        quantity: String(quantity),
        minLimit: String(minLimit),
        maxLimit: String(maxLimit),
        paymentMethods: JSON.stringify(paymentMethods),
        terms,
      }).returning();
    }

    res.status(201).json({ success: true, ad: ad! });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create ad" });
  }
});

// PATCH /p2p/ads/:id/toggle — pause or resume
router.patch("/p2p/ads/:id/toggle", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [ad] = await db.select().from(p2pAdsTable)
      .where(and(eq(p2pAdsTable.id, id), eq(p2pAdsTable.userId, req.userId!))).limit(1);
    if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }
    if (ad.status === "completed" || ad.status === "cancelled") {
      res.status(400).json({ error: "Cannot toggle a completed or cancelled ad" }); return;
    }
    const newStatus = ad.status === "active" ? "paused" : "active";
    await db.update(p2pAdsTable).set({ status: newStatus, updatedAt: new Date() }).where(eq(p2pAdsTable.id, id));
    res.json({ success: true, status: newStatus });
  } catch {
    res.status(500).json({ error: "Failed to toggle ad" });
  }
});

// DELETE /p2p/ads/:id — cancel + return frozen USDT for SELL ads
router.delete("/p2p/ads/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    await db.transaction(async (tx) => {
      const [ad] = await tx.select().from(p2pAdsTable)
        .where(and(eq(p2pAdsTable.id, id), eq(p2pAdsTable.userId, req.userId!))).limit(1);
      if (!ad) throw new Error("Ad not found");
      if (ad.status === "completed") throw new Error("Cannot cancel a completed ad");

      const remainingQty = parseNum(ad.quantity as string) - parseNum(ad.filledQuantity as string);

      // Return unfilled USDT back to Funding Wallet (tradingBalance) for SELL ads
      if (ad.type === "SELL" && remainingQty > 0) {
        await tx.update(walletsTable).set({
          tradingBalance: sql`${walletsTable.tradingBalance} + ${remainingQty}`,
        }).where(eq(walletsTable.userId, req.userId!));
      }

      await tx.update(p2pAdsTable).set({ status: "cancelled", updatedAt: new Date() }).where(eq(p2pAdsTable.id, id));
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to cancel ad" });
  }
});

// GET /p2p/ads/:id — single ad detail with seller payment methods
router.get("/p2p/ads/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [ad] = await db
      .select({
        id: p2pAdsTable.id, userId: p2pAdsTable.userId,
        type: p2pAdsTable.type, asset: p2pAdsTable.asset,
        fiatCurrency: p2pAdsTable.fiatCurrency,
        price: p2pAdsTable.price, quantity: p2pAdsTable.quantity,
        minLimit: p2pAdsTable.minLimit, maxLimit: p2pAdsTable.maxLimit,
        paymentMethods: p2pAdsTable.paymentMethods,
        terms: p2pAdsTable.terms, status: p2pAdsTable.status,
        filledQuantity: p2pAdsTable.filledQuantity,
        createdAt: p2pAdsTable.createdAt,
        advertiserName: usersTable.fullName,
      })
      .from(p2pAdsTable)
      .innerJoin(usersTable, eq(p2pAdsTable.userId, usersTable.id))
      .where(eq(p2pAdsTable.id, id))
      .limit(1);
    if (!ad) { res.status(404).json({ error: "Ad not found" }); return; }

    const methodRefs = JSON.parse(ad.paymentMethods as string) as string[];
    const allSellerMethods = await db.select().from(p2pUserPaymentMethodsTable)
      .where(eq(p2pUserPaymentMethodsTable.userId, ad.userId));
    const sellerPaymentMethods = allSellerMethods.filter((m) =>
      methodRefs.includes(String(m.id)) || methodRefs.includes(m.type)
    );

    res.json({
      ...ad,
      price: parseNum(ad.price as string),
      quantity: parseNum(ad.quantity as string),
      minLimit: parseNum(ad.minLimit as string),
      maxLimit: parseNum(ad.maxLimit as string),
      filledQuantity: parseNum(ad.filledQuantity as string),
      remainingQuantity: parseNum(ad.quantity as string) - parseNum(ad.filledQuantity as string),
      paymentMethods: methodRefs,
      sellerPaymentMethods,
      advertiserName: (ad.advertiserName as string).split(" ")[0] + "***",
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch ad" });
  }
});

// ─── P2P Orders ───────────────────────────────────────────────────────────────

const CreateOrderSchema = z.object({
  adId: z.number().int().positive(),
  fiatAmount: z.number().positive(),
  paymentMethod: z.string().max(30).optional(),
});

// POST /p2p/orders
router.post("/p2p/orders", async (req: AuthRequest, res) => {
  const result = CreateOrderSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid data", details: result.error.issues }); return; }
  const { adId, fiatAmount, paymentMethod } = result.data;

  try {
    let order: typeof p2pOrdersTable.$inferSelect;

    await db.transaction(async (tx) => {
      const [ad] = await tx.select().from(p2pAdsTable).where(eq(p2pAdsTable.id, adId)).limit(1);
      if (!ad) throw new Error("Ad not found");
      if (ad.status !== "active") throw new Error("Ad is not active");
      if (ad.userId === req.userId!) throw new Error("Cannot trade against your own ad");

      const price = parseNum(ad.price as string);
      const minLimit = parseNum(ad.minLimit as string);
      const maxLimit = parseNum(ad.maxLimit as string);
      if (fiatAmount < minLimit) throw new Error(`Minimum order is ₹${minLimit}`);
      if (fiatAmount > maxLimit) throw new Error(`Maximum order is ₹${maxLimit}`);

      const usdtAmount = fiatAmount / price;
      const remaining = parseNum(ad.quantity as string) - parseNum(ad.filledQuantity as string);
      if (usdtAmount > remaining) throw new Error("Insufficient quantity remaining in ad");

      const paymentDeadline = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes to pay

      // Determine buyer/seller
      const buyerId = ad.type === "SELL" ? req.userId! : ad.userId;
      const sellerId = ad.type === "SELL" ? ad.userId : req.userId!;

      // SELL ads: funds already deducted from seller's Funding Wallet at ad creation time

      [order] = await tx.insert(p2pOrdersTable).values({
        adId,
        buyerId,
        sellerId,
        fiatAmount: String(fiatAmount),
        usdtAmount: String(usdtAmount),
        price: String(price),
        paymentMethod: paymentMethod ?? null,
        paymentDeadline,
      }).returning();

      // Escrow audit record
      await tx.insert(p2pEscrowTransactionsTable).values({
        orderId: order!.id,
        sellerId,
        buyerId,
        amount: String(usdtAmount),
        status: "held",
      });

      // Update filled quantity on ad
      await tx.update(p2pAdsTable).set({
        filledQuantity: sql`${p2pAdsTable.filledQuantity} + ${usdtAmount}`,
        updatedAt: new Date(),
      }).where(eq(p2pAdsTable.id, adId));
    });

    res.status(201).json({ success: true, order: order! });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to create order" });
  }
});

// GET /p2p/orders/my — orders where user is buyer or seller
router.get("/p2p/orders/my", async (req: AuthRequest, res) => {
  try {
    const orders = await db
      .select({
        id: p2pOrdersTable.id,
        adId: p2pOrdersTable.adId,
        buyerId: p2pOrdersTable.buyerId,
        sellerId: p2pOrdersTable.sellerId,
        fiatAmount: p2pOrdersTable.fiatAmount,
        usdtAmount: p2pOrdersTable.usdtAmount,
        price: p2pOrdersTable.price,
        paymentMethod: p2pOrdersTable.paymentMethod,
        status: p2pOrdersTable.status,
        paymentDeadline: p2pOrdersTable.paymentDeadline,
        paidAt: p2pOrdersTable.paidAt,
        completedAt: p2pOrdersTable.completedAt,
        cancelledAt: p2pOrdersTable.cancelledAt,
        createdAt: p2pOrdersTable.createdAt,
        adType: p2pAdsTable.type,
      })
      .from(p2pOrdersTable)
      .leftJoin(p2pAdsTable, eq(p2pOrdersTable.adId, p2pAdsTable.id))
      .where(or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)))
      .orderBy(desc(p2pOrdersTable.createdAt))
      .limit(50);

    res.json(orders.map((o) => ({
      ...o,
      fiatAmount: parseNum(o.fiatAmount as string),
      usdtAmount: parseNum(o.usdtAmount as string),
      price: parseNum(o.price as string),
      role: o.buyerId === req.userId! ? "buyer" : "seller",
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /p2p/orders/:id — single order detail (includes seller's payment methods)
router.get("/p2p/orders/:id", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const [order] = await db.select().from(p2pOrdersTable)
      .where(and(
        eq(p2pOrdersTable.id, id),
        or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)),
      )).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    // Fetch the SELLER's payment methods so the buyer knows where to send money
    const sellerPaymentMethods = await db
      .select()
      .from(p2pUserPaymentMethodsTable)
      .where(and(
        eq(p2pUserPaymentMethodsTable.userId, order.sellerId),
        eq(p2pUserPaymentMethodsTable.isActive, true),
      ));

    res.json({
      ...order,
      fiatAmount: parseNum(order.fiatAmount as string),
      usdtAmount: parseNum(order.usdtAmount as string),
      price: parseNum(order.price as string),
      role: order.buyerId === req.userId! ? "buyer" : "seller",
      sellerPaymentMethods,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// PATCH /p2p/orders/:id/paid — buyer marks payment as sent
router.patch("/p2p/orders/:id/paid", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [order] = await db.select().from(p2pOrdersTable)
      .where(and(eq(p2pOrdersTable.id, id), eq(p2pOrdersTable.buyerId, req.userId!))).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found or not your order" }); return; }
    if (order.status !== "pending") { res.status(400).json({ error: "Order is not pending" }); return; }
    await db.update(p2pOrdersTable).set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(p2pOrdersTable.id, id));
    res.json({ success: true, status: "paid" });
  } catch {
    res.status(500).json({ error: "Failed to mark as paid" });
  }
});

// PATCH /p2p/orders/:id/confirm — seller confirms payment received, releases USDT to buyer
router.patch("/p2p/orders/:id/confirm", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(p2pOrdersTable)
        .where(and(eq(p2pOrdersTable.id, id), eq(p2pOrdersTable.sellerId, req.userId!))).limit(1);
      if (!order) throw new Error("Order not found or not your order");
      if (order.status !== "paid") throw new Error("Order must be marked as paid first");
      const usdtAmount = parseNum(order.usdtAmount as string);
      // Release USDT from escrow to buyer's trading balance
      await tx.update(walletsTable).set({
        tradingBalance: sql`${walletsTable.tradingBalance} + ${usdtAmount}`,
      }).where(eq(walletsTable.userId, order.buyerId));
      // Update escrow audit record
      await tx.update(p2pEscrowTransactionsTable).set({ status: "released", releasedAt: new Date() })
        .where(eq(p2pEscrowTransactionsTable.orderId, id));
      await tx.update(p2pOrdersTable).set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(p2pOrdersTable.id, id));
    });
    res.json({ success: true, status: "completed" });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to confirm order" });
  }
});

// PATCH /p2p/orders/:id/cancel — cancel order (pending only; restores ad filled quantity)
router.patch("/p2p/orders/:id/cancel", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(p2pOrdersTable)
        .where(and(
          eq(p2pOrdersTable.id, id),
          or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)),
        )).limit(1);
      if (!order) throw new Error("Order not found");
      if (order.status === "completed" || order.status === "cancelled") throw new Error("Cannot cancel this order");
      if (order.status === "paid") throw new Error("Payment already marked. Raise a dispute if needed.");
      const usdtAmount = parseNum(order.usdtAmount as string);
      // Restore filled quantity so the ad is available again
      await tx.update(p2pAdsTable).set({
        filledQuantity: sql`${p2pAdsTable.filledQuantity} - ${usdtAmount}`,
        updatedAt: new Date(),
      }).where(eq(p2pAdsTable.id, order.adId));
      await tx.update(p2pEscrowTransactionsTable).set({ status: "returned" })
        .where(eq(p2pEscrowTransactionsTable.orderId, id));
      await tx.update(p2pOrdersTable).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(p2pOrdersTable.id, id));
    });
    res.json({ success: true, status: "cancelled" });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to cancel order" });
  }
});

// ─── P2P Chat ─────────────────────────────────────────────────────────────────

// GET /p2p/orders/:id/messages
router.get("/p2p/orders/:id/messages", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [order] = await db.select().from(p2pOrdersTable)
      .where(and(eq(p2pOrdersTable.id, id), or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)))).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }

    const messages = await db
      .select({
        id: p2pChatMessagesTable.id,
        senderId: p2pChatMessagesTable.senderId,
        message: p2pChatMessagesTable.message,
        isSystem: p2pChatMessagesTable.isSystem,
        createdAt: p2pChatMessagesTable.createdAt,
        senderName: usersTable.fullName,
      })
      .from(p2pChatMessagesTable)
      .leftJoin(usersTable, eq(p2pChatMessagesTable.senderId, usersTable.id))
      .where(eq(p2pChatMessagesTable.orderId, id))
      .orderBy(p2pChatMessagesTable.createdAt);

    res.json(messages.map((m) => ({
      ...m,
      senderName: m.isSystem ? "System" : (m.senderName as string || "User").split(" ")[0] + "***",
      isOwn: !m.isSystem && m.senderId === req.userId!,
    })));
  } catch {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /p2p/orders/:id/messages
router.post("/p2p/orders/:id/messages", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { message } = req.body;
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "Message is required" }); return;
  }
  if (message.trim().length > 500) {
    res.status(400).json({ error: "Message too long (max 500 chars)" }); return;
  }
  try {
    const [order] = await db.select().from(p2pOrdersTable)
      .where(and(eq(p2pOrdersTable.id, id), or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)))).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status === "completed" || order.status === "cancelled") {
      res.status(400).json({ error: "Cannot chat on a closed order" }); return;
    }
    const [msg] = await db.insert(p2pChatMessagesTable).values({
      orderId: id, senderId: req.userId!, message: message.trim(),
    }).returning();
    res.status(201).json({ ...msg, isOwn: true, senderName: "You" });
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ─── P2P Ratings ──────────────────────────────────────────────────────────────

// GET /p2p/orders/:id/myrating
router.get("/p2p/orders/:id/myrating", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [rating] = await db.select().from(p2pRatingsTable)
      .where(and(eq(p2pRatingsTable.orderId, id), eq(p2pRatingsTable.fromUserId, req.userId!))).limit(1);
    res.json({ rated: !!rating, rating: rating ?? null });
  } catch {
    res.status(500).json({ error: "Failed to fetch rating" });
  }
});

// POST /p2p/orders/:id/rate
router.post("/p2p/orders/:id/rate", async (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { rating, comment } = req.body;
  if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be 1-5" }); return;
  }
  try {
    const [order] = await db.select().from(p2pOrdersTable)
      .where(and(eq(p2pOrdersTable.id, id), or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)))).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "completed") { res.status(400).json({ error: "Can only rate completed orders" }); return; }
    const [existing] = await db.select().from(p2pRatingsTable)
      .where(and(eq(p2pRatingsTable.orderId, id), eq(p2pRatingsTable.fromUserId, req.userId!))).limit(1);
    if (existing) { res.status(400).json({ error: "Already rated this order" }); return; }
    const toUserId = order.buyerId === req.userId! ? order.sellerId : order.buyerId;
    const [newRating] = await db.insert(p2pRatingsTable).values({
      orderId: id, fromUserId: req.userId!, toUserId, rating: Math.round(rating),
      comment: typeof comment === "string" && comment.trim() ? comment.trim() : null,
    }).returning();
    res.status(201).json(newRating);
  } catch {
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

export default router;
