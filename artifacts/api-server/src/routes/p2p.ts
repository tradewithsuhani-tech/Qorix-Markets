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
  p2pDisputesTable,
  p2pDisputeEvidenceTable,
} from "@workspace/db";
import { eq, and, or, ne, desc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { createNotification } from "../lib/notifications";
import { publishOrderEvent } from "../lib/p2p-realtime";
import {
  getMerchantProfile,
  getMerchantProfiles,
  invalidateMerchantProfiles,
  type MerchantProfile,
} from "../lib/p2p-profile";
import jwt from "jsonwebtoken";

const router = Router();
router.use(authMiddleware);

// POST /p2p/orders/:id/stream-token — issues a 5-minute SSE-only JWT.
// Frontend calls this first (with the normal Bearer header) and then opens
// EventSource using the returned token in the query string. This avoids
// putting the long-lived session JWT in URLs / proxy access logs.
router.post("/p2p/orders/:id/stream-token", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [order] = await db.select({ buyerId: p2pOrdersTable.buyerId, sellerId: p2pOrdersTable.sellerId })
    .from(p2pOrdersTable)
    .where(and(
      eq(p2pOrdersTable.id, id),
      or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)),
    )).limit(1);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  const SECRET = process.env.SESSION_SECRET || "qorix-markets-secret";
  const token = jwt.sign(
    { userId: req.userId!, orderId: id, purpose: "p2p-stream", aud: "markets" },
    SECRET,
    { expiresIn: "5m" },
  );
  res.json({ token, expiresIn: 300 });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Enforces that the caller has completed KYC before allowing
 * trade-creating actions (create ad, create order). Returns true if the
 * request should proceed; otherwise sends 403 and returns false.
 */
async function requireKycApproved(req: AuthRequest, res: any): Promise<boolean> {
  const [u] = await db
    .select({ kycStatus: usersTable.kycStatus })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);
  if (!u || u.kycStatus !== "approved") {
    res.status(403).json({
      error: "KYC required",
      message: "Complete KYC verification to use P2P trading.",
      kycStatus: u?.kycStatus ?? "not_submitted",
    });
    return false;
  }
  return true;
}

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
  type: z.enum(["UPI", "BANK", "IMPS", "PHONEPE", "GPAY", "PAYTM", "DIGITAL_ERUPEE", "NEFT", "RTGS"]),
  displayName: z.string().min(2).max(100),
  upiId: z.string().max(100).optional(),
  bankName: z.string().max(100).optional(),
  accountHolder: z.string().max(200).optional(),
  accountNumber: z.string().max(50).optional(),
  ifsc: z.string().max(20).optional(),
  qrCodeData: z.string().max(600000).optional().nullable(), // base64 data URL, ~450kb max
});

// POST /p2p/payment-methods
router.post("/p2p/payment-methods", async (req: AuthRequest, res) => {
  const result = PaymentMethodSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid data", details: result.error.issues }); return; }

  try {
    const count = await db.select({ c: sql<number>`count(*)` }).from(p2pUserPaymentMethodsTable)
      .where(and(eq(p2pUserPaymentMethodsTable.userId, req.userId!), eq(p2pUserPaymentMethodsTable.isActive, true)));
    if (Number(count[0]?.c ?? 0) >= 10) { res.status(400).json({ error: "Maximum 10 payment methods allowed" }); return; }

    const { qrCodeData, ...rest } = result.data;
    const [method] = await db.insert(p2pUserPaymentMethodsTable).values({
      userId: req.userId!, ...rest, qrCodeData: qrCodeData ?? null,
    }).returning();
    res.json(method);
  } catch (err: any) {
    console.error("POST /p2p/payment-methods error:", err?.message || err);
    res.status(500).json({ error: "Failed to add payment method" });
  }
});

// DELETE /p2p/payment-methods/:id
router.delete("/p2p/payment-methods/:id", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
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
        timeLimit: p2pAdsTable.timeLimit,
        filledQuantity: p2pAdsTable.filledQuantity,
        createdAt: p2pAdsTable.createdAt,
        advertiserName: usersTable.fullName,
      })
      .from(p2pAdsTable)
      .innerJoin(usersTable, eq(p2pAdsTable.userId, usersTable.id))
      .where(and(...conditions))
      .orderBy(desc(p2pAdsTable.createdAt))
      .limit(50);

    let result = ads.map((a) => {
      let paymentMethods: string[] = [];
      try { paymentMethods = JSON.parse(a.paymentMethods as string) as string[]; } catch { /* use empty array fallback */ }
      return {
        ...a,
        price: parseNum(a.price as string),
        quantity: parseNum(a.quantity as string),
        minLimit: parseNum(a.minLimit as string),
        maxLimit: parseNum(a.maxLimit as string),
        filledQuantity: parseNum(a.filledQuantity as string),
        remainingQuantity: parseNum(a.quantity as string) - parseNum(a.filledQuantity as string),
        paymentMethods,
        advertiserName: (a.advertiserName as string).split(" ")[0] + "***",
      };
    });
    // Filter by payment method if specified
    if (paymentMethodFilter) {
      result = result.filter((a) =>
        a.paymentMethods.some((m) => m.toLowerCase().includes(paymentMethodFilter))
      );
    }

    // Compute per-advertiser trade stats
    const userIds = [...new Set(result.map((a) => a.userId))];
    const statsMap = new Map<number, { trades: number; completionRate: number }>();
    if (userIds.length > 0) {
      const [buyerRows, sellerRows] = await Promise.all([
        db.select({
          userId: p2pOrdersTable.buyerId,
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${p2pOrdersTable.status} = 'completed')::int`,
        }).from(p2pOrdersTable).where(inArray(p2pOrdersTable.buyerId, userIds)).groupBy(p2pOrdersTable.buyerId),
        db.select({
          userId: p2pOrdersTable.sellerId,
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${p2pOrdersTable.status} = 'completed')::int`,
        }).from(p2pOrdersTable).where(inArray(p2pOrdersTable.sellerId, userIds)).groupBy(p2pOrdersTable.sellerId),
      ]);
      for (const r of [...buyerRows, ...sellerRows]) {
        const e = statsMap.get(r.userId) ?? { trades: 0, completionRate: 100 };
        const prevCompleted = Math.round(e.completionRate / 100 * e.trades);
        const newTotal = e.trades + (r.total ?? 0);
        const newCompleted = prevCompleted + (r.completed ?? 0);
        statsMap.set(r.userId, {
          trades: newTotal,
          completionRate: newTotal > 0 ? Math.round((newCompleted / newTotal) * 100) : 100,
        });
      }
    }
    // Pull per-user trust profiles (verified badge + avg release time + rating)
    // from the cache. This is O(unique-userIds) Redis GETs; cold misses fan
    // out to compute() under single-flight, so a list page that surfaces 20
    // ads from ~10 distinct advertisers hits the DB at most 10 times on the
    // very first request and 0 times for the next 5 minutes.
    // Non-fatal: Redis/cache failure must not block the ad listing.
    let profiles = new Map<number, MerchantProfile>();
    try { profiles = await getMerchantProfiles(userIds); } catch { /* profile enrichment is best-effort */ }
    const finalResult = result.map((a) => {
      const p = profiles.get(a.userId);
      return {
        ...a,
        tradesCount: statsMap.get(a.userId)?.trades ?? 0,
        completionRate: statsMap.get(a.userId)?.completionRate ?? 100,
        isVerifiedMerchant: p?.isVerifiedMerchant ?? false,
        kycVerified: p?.kycVerified ?? false,
        avgReleaseSeconds: p?.avgReleaseSeconds ?? null,
        avgRating: p?.avgRating ?? null,
        ratingCount: p?.ratingCount ?? 0,
      };
    });
    res.json(finalResult);
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

    // Per-ad order stats — advertiser dashboard needs to know which ads are
    // generating live trades vs sitting idle. One grouped query per user
    // (not per ad) so this stays O(1) regardless of ad count.
    const adIds = ads.map((a) => a.id);
    type AdStat = { adId: number; active: number; completed: number; revenue: string };
    const statRows: AdStat[] = adIds.length === 0 ? [] : (await db
      .select({
        adId: p2pOrdersTable.adId,
        active: sql<number>`count(*) filter (where ${p2pOrdersTable.status} in ('pending','paid','disputed'))::int`,
        completed: sql<number>`count(*) filter (where ${p2pOrdersTable.status} = 'completed')::int`,
        revenue: sql<string>`coalesce(sum(${p2pOrdersTable.usdtAmount}) filter (where ${p2pOrdersTable.status} = 'completed'), 0)`,
      })
      .from(p2pOrdersTable)
      .where(inArray(p2pOrdersTable.adId, adIds))
      .groupBy(p2pOrdersTable.adId)) as AdStat[];
    const statByAd = new Map(statRows.map((s) => [s.adId, s]));

    res.json(ads.map((a) => {
      const s = statByAd.get(a.id);
      return {
        ...a,
        price: parseNum(a.price as string),
        quantity: parseNum(a.quantity as string),
        minLimit: parseNum(a.minLimit as string),
        maxLimit: parseNum(a.maxLimit as string),
        filledQuantity: parseNum(a.filledQuantity as string),
        remainingQuantity: parseNum(a.quantity as string) - parseNum(a.filledQuantity as string),
        paymentMethods: JSON.parse(a.paymentMethods as string),
        activeOrdersCount: s?.active ?? 0,
        completedOrdersCount: s?.completed ?? 0,
        completedRevenueUsdt: parseNum((s?.revenue as string) ?? "0"),
      };
    }));
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
  if (!(await requireKycApproved(req, res))) return;
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
    console.error("POST /p2p/ads error:", err?.message || err);
    res.status(400).json({ error: err.message || "Failed to create ad" });
  }
});

// PATCH /p2p/ads/:id — edit price / limits / quantity / terms / payment methods.
// Optimistic-lock via `expectedUpdatedAt` so two concurrent edits (e.g. two
// browser tabs, or a price refresh racing a manual edit) can't silently
// clobber each other. SELL ads rebalance the seller's locked USDT when
// quantity changes:
//   - increasing qty  → lock the delta from Funding Wallet (fail if short)
//   - decreasing qty  → return the delta to Funding Wallet (forbidden if
//     it would drop below filledQuantity + currently-reserved active orders)
const UpdateAdSchema = z.object({
  price: z.number().positive().optional(),
  quantity: z.number().positive().max(100000).optional(),
  minLimit: z.number().positive().optional(),
  maxLimit: z.number().positive().optional(),
  paymentMethods: z.array(z.string()).min(1).optional(),
  terms: z.string().max(500).nullable().optional(),
  expectedUpdatedAt: z.string().min(1), // ISO timestamp; required
});

router.patch("/p2p/ads/:id", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateAdSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid data", details: parsed.error.issues });
    return;
  }
  const patch = parsed.data;

  // At least one editable field must be present.
  const hasEdit = ["price", "quantity", "minLimit", "maxLimit", "paymentMethods", "terms"]
    .some((k) => (patch as any)[k] !== undefined);
  if (!hasEdit) { res.status(400).json({ error: "No editable fields supplied" }); return; }

  try {
    const updated = await db.transaction(async (tx) => {
      const [ad] = await tx.select().from(p2pAdsTable)
        .where(and(eq(p2pAdsTable.id, id), eq(p2pAdsTable.userId, req.userId!))).limit(1);
      if (!ad) throw new Error("Ad not found");
      if (ad.status === "completed" || ad.status === "cancelled") {
        throw new Error("Cannot edit a completed or cancelled ad");
      }

      // Optimistic lock — client sends the `updatedAt` it last saw. If the
      // row has moved since (someone else edited, or a fill bumped it),
      // reject so the client can refresh and retry.
      const currentTs = (ad.updatedAt as Date).toISOString();
      if (currentTs !== patch.expectedUpdatedAt) {
        const e: any = new Error("Ad was modified by another action — please refresh and try again");
        e.code = "stale";
        throw e;
      }

      const oldQty = parseNum(ad.quantity as string);
      const filledQty = parseNum(ad.filledQuantity as string);
      const newQty = patch.quantity ?? oldQty;
      const newMin = patch.minLimit ?? parseNum(ad.minLimit as string);
      const newMax = patch.maxLimit ?? parseNum(ad.maxLimit as string);
      const newPrice = patch.price ?? parseNum(ad.price as string);

      // Limit invariants.
      if (newMin >= newMax) throw new Error("min_limit must be less than max_limit");
      // Min order in USDT must be deliverable from total quantity.
      if (newMin / newPrice > newQty) throw new Error("min_limit exceeds total quantity");

      // Quantity invariants — never below already-filled amount.
      if (newQty < filledQty) {
        throw new Error(`new quantity (${newQty}) cannot be below already-filled (${filledQty})`);
      }

      // SELL ads: rebalance Funding Wallet escrow on qty change.
      if (ad.type === "SELL" && newQty !== oldQty) {
        // Active orders (pending/paid/disputed) reserve USDT against the ad
        // until they settle. Reducing below that reserve would orphan the
        // running orders' escrow, so block it.
        const [reserveRow] = await tx
          .select({
            reserved: sql<string>`coalesce(sum(${p2pOrdersTable.usdtAmount}) filter (where ${p2pOrdersTable.status} in ('pending','paid','disputed')), 0)`,
          })
          .from(p2pOrdersTable)
          .where(eq(p2pOrdersTable.adId, id));
        const reservedActive = parseNum((reserveRow?.reserved as string) ?? "0");
        const minSafeQty = filledQty + reservedActive;
        if (newQty < minSafeQty) {
          throw new Error(
            `Cannot reduce quantity below ${minSafeQty} USDT (filled + active orders)`,
          );
        }

        const delta = newQty - oldQty; // positive = lock more, negative = release
        const [w] = await tx.select().from(walletsTable).where(eq(walletsTable.userId, req.userId!)).limit(1);
        if (!w) throw new Error("Wallet not found");
        if (delta > 0) {
          // Guard the deduction at the SQL layer so two concurrent ad
          // increases on different ads of the same user can't both pass an
          // earlier read-time balance check and overdraw the wallet. The
          // conditional UPDATE matches zero rows if the live balance is
          // insufficient — we treat that as the same insufficient-funds
          // failure the read-time check would have raised.
          const upd = await tx.update(walletsTable).set({
            tradingBalance: sql`${walletsTable.tradingBalance} - ${delta}`,
          }).where(and(
            eq(walletsTable.userId, req.userId!),
            sql`${walletsTable.tradingBalance} >= ${delta}`,
          )).returning({ userId: walletsTable.userId });
          if (upd.length === 0) {
            throw new Error("Insufficient Funding Wallet balance to increase quantity");
          }
        } else {
          const refund = -delta;
          await tx.update(walletsTable).set({
            tradingBalance: sql`${walletsTable.tradingBalance} + ${refund}`,
          }).where(eq(walletsTable.userId, req.userId!));
        }
      }

      // Build SET payload — only fields the client sent.
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (patch.price !== undefined) set.price = String(newPrice);
      if (patch.quantity !== undefined) set.quantity = String(newQty);
      if (patch.minLimit !== undefined) set.minLimit = String(newMin);
      if (patch.maxLimit !== undefined) set.maxLimit = String(newMax);
      if (patch.paymentMethods !== undefined) set.paymentMethods = JSON.stringify(patch.paymentMethods);
      if (patch.terms !== undefined) set.terms = patch.terms;

      // Conditional update guards the optimistic lock at the SQL layer too —
      // belt-and-braces against the read-check-write race between the
      // tx.select() above and this update inside a serializable boundary.
      const result = await tx.update(p2pAdsTable)
        .set(set)
        .where(and(
          eq(p2pAdsTable.id, id),
          eq(p2pAdsTable.updatedAt, ad.updatedAt as Date),
        ))
        .returning();
      if (result.length === 0) {
        const e: any = new Error("Ad was modified by another action — please refresh and try again");
        e.code = "stale";
        throw e;
      }
      return result[0];
    });

    res.json({
      success: true,
      ad: {
        ...updated,
        price: parseNum(updated.price as string),
        quantity: parseNum(updated.quantity as string),
        minLimit: parseNum(updated.minLimit as string),
        maxLimit: parseNum(updated.maxLimit as string),
        filledQuantity: parseNum(updated.filledQuantity as string),
        paymentMethods: JSON.parse(updated.paymentMethods as string),
      },
    });
  } catch (err: any) {
    if (err?.code === "stale") {
      res.status(409).json({ error: err.message, code: "stale" });
      return;
    }
    res.status(400).json({ error: err?.message || "Failed to update ad" });
  }
});

// PATCH /p2p/ads/:id/toggle — pause or resume
router.patch("/p2p/ads/:id/toggle", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
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
  const id = parseInt(String(req.params.id));
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
  const id = parseInt(String(req.params.id));
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

    let methodRefs: string[] = [];
    try { methodRefs = JSON.parse(ad.paymentMethods as string) as string[]; } catch { /* fallback to empty */ }
    const allSellerMethods = await db.select().from(p2pUserPaymentMethodsTable)
      .where(eq(p2pUserPaymentMethodsTable.userId, ad.userId));
    const sellerPaymentMethods = allSellerMethods.filter((m) =>
      methodRefs.includes(String(m.id)) || methodRefs.includes(m.type)
    );

    // Reuse the cached merchant trust profile — single Redis GET vs two
    // group-by aggregates over p2p_orders on every detail-page hit. The
    // numbers stay fresh because we punch through the cache on every order
    // state mutation (see invalidateMerchantProfiles calls below).
    // Non-fatal: Redis/cache failure must not prevent placing an order.
    let profile: MerchantProfile | null = null;
    try { profile = await getMerchantProfile(ad.userId); } catch { /* best-effort */ }
    const tradesCount = profile?.totalCompletedAllTime ?? 0;
    // For the ad detail card we surface the 30d completion rate (matches
    // the trust modal); falls back to 100% when no trades yet to avoid
    // scaring buyers off brand-new sellers.
    const completionRate = profile?.completionRate30d ?? 100;

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
      tradesCount,
      completionRate,
      isVerifiedMerchant: profile?.isVerifiedMerchant ?? false,
      kycVerified: profile?.kycVerified ?? false,
      avgReleaseSeconds: profile?.avgReleaseSeconds ?? null,
      avgRating: profile?.avgRating ?? null,
      ratingCount: profile?.ratingCount ?? 0,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch ad" });
  }
});

// GET /p2p/users/:id/profile — Binance-style merchant trust card.
// Surfaces verified badge, completion rate, avg release time, 30d volume,
// rating average. All numbers come from a 5-minute Redis cache; mutations
// (order completed / cancelled / rated, admin dispute resolved, expiry
// cron) punch through the cache so the card stays honest after a trade
// settles. Auth-gated because the masked first name is still PII-adjacent.
router.get("/p2p/users/:id/profile", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const profile = await getMerchantProfile(id);
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
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
  if (!(await requireKycApproved(req, res))) return;
  const result = CreateOrderSchema.safeParse(req.body);
  if (!result.success) { res.status(400).json({ error: "Invalid data", details: result.error.issues }); return; }
  const { adId, fiatAmount, paymentMethod } = result.data;

  try {
    let order: typeof p2pOrdersTable.$inferSelect | undefined;

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

      const timeLimitMinutes = Number(ad.timeLimit ?? 15);
      const paymentDeadline = new Date(Date.now() + timeLimitMinutes * 60 * 1000);

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

      // Update filled quantity on ad — guarded at the SQL layer so two
      // buyers racing the same ad can't both pass the earlier remaining-qty
      // check and overfill it. Under READ COMMITTED the prior select is a
      // snapshot, so we re-assert the invariant atomically here. If the
      // condition fails (status flipped to paused/cancelled, or a sibling
      // order consumed the remainder first) we abort the order.
      const fillRes = await tx.update(p2pAdsTable).set({
        filledQuantity: sql`${p2pAdsTable.filledQuantity} + ${usdtAmount}`,
        updatedAt: new Date(),
      }).where(and(
        eq(p2pAdsTable.id, adId),
        eq(p2pAdsTable.status, "active"),
        sql`${p2pAdsTable.quantity} - ${p2pAdsTable.filledQuantity} >= ${usdtAmount}`,
      )).returning({ id: p2pAdsTable.id });
      if (fillRes.length === 0) {
        throw new Error("Ad is no longer available — quantity exhausted or ad paused");
      }
    });

    // Order creation grows both parties' 30d total — invalidate so the
    // completion-rate denominator updates immediately. Without this, a
    // buyer could refresh the ad page and still see the seller's pre-order
    // numbers for up to 5 minutes.
    if (order) {
      await invalidateMerchantProfiles([order.buyerId, order.sellerId]);
    }

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
  const id = parseInt(String(req.params.id));
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
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [order] = await db.select().from(p2pOrdersTable)
      .where(and(eq(p2pOrdersTable.id, id), eq(p2pOrdersTable.buyerId, req.userId!))).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found or not your order" }); return; }
    if (order.status !== "pending") { res.status(400).json({ error: "Order is not pending" }); return; }
    const paymentRef = typeof req.body?.paymentRef === "string" && req.body.paymentRef.trim()
      ? req.body.paymentRef.trim() : null;

    // Optional payment proof screenshot (base64 data URL, ~450kb cap to match
    // the QR code limit used elsewhere). Validated against image/* data URL
    // shape; anything else is rejected so we never store arbitrary text.
    const rawProof = req.body?.paymentProofUrl;
    let paymentProofUrl: string | null = null;
    if (typeof rawProof === "string" && rawProof.length > 0) {
      if (rawProof.length > 600000) {
        res.status(400).json({ error: "Payment proof too large (max ~450KB)" }); return;
      }
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(rawProof)) {
        res.status(400).json({ error: "Invalid payment proof format" }); return;
      }
      paymentProofUrl = rawProof;
    }

    await db.update(p2pOrdersTable).set({ status: "paid", paidAt: new Date(), updatedAt: new Date(), paymentRef, paymentProofUrl })
      .where(eq(p2pOrdersTable.id, id));

    // Notify the seller that the buyer has marked the payment as sent.
    const fiat = parseNum(order.fiatAmount as string).toFixed(2);
    await createNotification(
      order.sellerId,
      "p2p_order",
      "Buyer marked payment as sent",
      `Order #${order.id} (₹${fiat}): buyer says payment was sent${paymentRef ? ` (UTR: ${paymentRef})` : ""}. Please verify and confirm to release USDT.`,
    ).catch(() => {});

    publishOrderEvent({ type: "order.paid", orderId: id, actorId: req.userId! });
    res.json({ success: true, status: "paid" });
  } catch {
    res.status(500).json({ error: "Failed to mark as paid" });
  }
});

// PATCH /p2p/orders/:id/confirm — seller confirms payment received, releases USDT to buyer
router.patch("/p2p/orders/:id/confirm", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
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

    // Notify the buyer that the USDT has been released to their wallet.
    const [orderForNotif] = await db
      .select({
        buyerId: p2pOrdersTable.buyerId,
        usdtAmount: p2pOrdersTable.usdtAmount,
      })
      .from(p2pOrdersTable)
      .where(eq(p2pOrdersTable.id, id))
      .limit(1);
    if (orderForNotif) {
      const usdt = parseNum(orderForNotif.usdtAmount as string).toFixed(2);
      await createNotification(
        orderForNotif.buyerId,
        "p2p_order",
        "USDT received",
        `Order #${id} completed. ${usdt} USDT has been credited to your Funding Wallet.`,
      ).catch(() => {});
    }

    publishOrderEvent({ type: "order.completed", orderId: id, actorId: req.userId! });
    // Trust profile aggregates changed for BOTH parties — bust their caches
    // so the merchant card on the ad list reflects the new completion +
    // release-time stats immediately on the next request.
    if (orderForNotif) {
      await invalidateMerchantProfiles([orderForNotif.buyerId, req.userId!]);
    }
    res.json({ success: true, status: "completed" });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to confirm order" });
  }
});

// PATCH /p2p/orders/:id/cancel — cancel order (pending only; restores ad filled quantity)
router.patch("/p2p/orders/:id/cancel", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  let buyerIdForInvalidate: number | null = null;
  let sellerIdForInvalidate: number | null = null;
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx.select().from(p2pOrdersTable)
        .where(and(
          eq(p2pOrdersTable.id, id),
          or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)),
        )).limit(1);
      if (!order) throw new Error("Order not found");
      buyerIdForInvalidate = order.buyerId;
      sellerIdForInvalidate = order.sellerId;
      if (order.status === "completed" || order.status === "cancelled") throw new Error("Cannot cancel this order");
      if (order.status === "disputed") throw new Error("Order is under admin review and cannot be cancelled");
      if (order.status === "paid") throw new Error("Payment already marked. Raise a dispute if needed.");
      const usdtAmount = parseNum(order.usdtAmount as string);
      // Restore filled quantity so the ad is available again
      await tx.update(p2pAdsTable).set({
        filledQuantity: sql`${p2pAdsTable.filledQuantity} - ${usdtAmount}`,
        updatedAt: new Date(),
      }).where(eq(p2pAdsTable.id, order.adId));
      await tx.update(p2pEscrowTransactionsTable).set({ status: "returned" })
        .where(eq(p2pEscrowTransactionsTable.orderId, id));
      const cancelReason = typeof req.body?.cancelReason === "string" && req.body.cancelReason.trim()
        ? req.body.cancelReason.trim() : null;
      await tx.update(p2pOrdersTable).set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date(), cancelReason })
        .where(eq(p2pOrdersTable.id, id));
    });
    publishOrderEvent({ type: "order.cancelled", orderId: id, actorId: req.userId!, reason: typeof req.body?.cancelReason === "string" ? req.body.cancelReason : null });
    // Cancel changes both parties' 30d completion rate (denominator grew,
    // numerator didn't). Bust trust profile caches.
    if (buyerIdForInvalidate && sellerIdForInvalidate) {
      await invalidateMerchantProfiles([buyerIdForInvalidate, sellerIdForInvalidate]);
    }
    res.json({ success: true, status: "cancelled" });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to cancel order" });
  }
});

// POST /p2p/orders/:id/dispute — buyer or seller raises a dispute (only when paid)
router.post("/p2p/orders/:id/dispute", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const reasonRaw = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim().slice(0, 1000) : null;
  const evidenceUrl = typeof req.body?.evidenceUrl === "string" ? req.body.evidenceUrl : null;
  if (!reasonRaw || reasonRaw.length < 3 || reasonRaw.length > 60) {
    res.status(400).json({ error: "Reason is required (3-60 chars)" }); return;
  }
  if (evidenceUrl && (evidenceUrl.length > 600_000 || !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(evidenceUrl))) {
    res.status(400).json({ error: "Invalid evidence image" }); return;
  }
  try {
    const created = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(p2pOrdersTable)
        .where(and(
          eq(p2pOrdersTable.id, id),
          or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)),
        )).limit(1);
      if (!order) throw new Error("Order not found");
      if (order.status !== "paid") throw new Error("Disputes can only be raised on orders marked as paid");
      const [existing] = await tx.select({ id: p2pDisputesTable.id }).from(p2pDisputesTable)
        .where(eq(p2pDisputesTable.orderId, id)).limit(1);
      if (existing) throw new Error("Dispute already exists for this order");
      const openerRole = order.buyerId === req.userId! ? "buyer" : "seller";
      const [row] = await tx.insert(p2pDisputesTable).values({
        orderId: id, openedByUserId: req.userId!, openerRole,
        reason: reasonRaw, description, evidenceUrl,
      }).returning();
      await tx.update(p2pOrdersTable).set({ status: "disputed", updatedAt: new Date() })
        .where(eq(p2pOrdersTable.id, id));
      return { dispute: row, order, openerRole };
    });

    // Notify counterparty
    const counterpartyId = created.openerRole === "buyer" ? created.order.sellerId : created.order.buyerId;
    await createNotification(
      counterpartyId,
      "p2p_order",
      "Dispute raised on your order",
      `A dispute has been raised on Order #${id}. Our team will review and contact you. Reason: ${reasonRaw}`,
    ).catch(() => {});

    publishOrderEvent({ type: "order.disputed", orderId: id, actorId: req.userId!, reason: reasonRaw });
    res.status(201).json({ success: true, dispute: created.dispute });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to raise dispute" });
  }
});

// ─── P2P Dispute Evidence (Phase 8) ──────────────────────────────────────────
// Once a dispute is open, EITHER party (buyer or seller) can attach further
// evidence — counter-screenshots, bank statements, additional UPI proofs —
// so admin sees both sides instead of only the opener's single image.
// Cap: 600 KB base64 per file, max 6 files per dispute, image MIME only for
// now (matches the opener's evidenceUrl validation pattern).

const MAX_EVIDENCE_BYTES = 600_000;
const MAX_EVIDENCE_PER_DISPUTE = 6;
const EVIDENCE_DATAURL_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/;

// POST /p2p/orders/:id/dispute/evidence — add evidence to an open dispute.
// Only buyer/seller of the order can post, and only while dispute.status === "open".
// Once admin resolves, evidence is read-only.
router.post("/p2p/orders/:id/dispute/evidence", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const fileData = typeof req.body?.fileData === "string" ? req.body.fileData : "";
  const captionRaw = typeof req.body?.caption === "string" ? req.body.caption.trim() : "";
  const caption = captionRaw ? captionRaw.slice(0, 280) : null;

  if (!fileData || fileData.length > MAX_EVIDENCE_BYTES || !EVIDENCE_DATAURL_RE.test(fileData)) {
    res.status(400).json({ error: "Invalid evidence image (jpeg/png/webp, ≤600KB base64)" });
    return;
  }

  try {
    const created = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(p2pOrdersTable)
        .where(and(
          eq(p2pOrdersTable.id, id),
          or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)),
        )).limit(1);
      if (!order) throw new Error("Order not found");
      // FOR UPDATE on the dispute row serializes concurrent evidence uploads
      // for the same dispute, so the 6-file cap can't be raced past by two
      // simultaneous POSTs from buyer + seller.
      const [dispute] = await tx.select().from(p2pDisputesTable)
        .where(eq(p2pDisputesTable.orderId, id))
        .limit(1)
        .for("update");
      if (!dispute) throw new Error("No dispute exists for this order");
      if (dispute.status !== "open") {
        throw new Error("Dispute is closed — evidence can no longer be added");
      }

      // Cap files per dispute to keep DB pages tight and prevent a single
      // bad actor from spamming the admin queue. Under the FOR UPDATE lock
      // above this count is authoritative for the rest of the txn.
      const [{ count }] = await tx.select({
        count: sql<number>`count(*)::int`,
      }).from(p2pDisputeEvidenceTable)
        .where(eq(p2pDisputeEvidenceTable.disputeId, dispute.id));
      if (count >= MAX_EVIDENCE_PER_DISPUTE) {
        throw new Error(`Evidence limit reached (max ${MAX_EVIDENCE_PER_DISPUTE} files per dispute)`);
      }

      const role = order.buyerId === req.userId! ? "buyer" : "seller";
      const [row] = await tx.insert(p2pDisputeEvidenceTable).values({
        disputeId: dispute.id,
        uploadedByUserId: req.userId!,
        uploaderRole: role,
        fileType: "image",
        fileData,
        caption,
      }).returning();
      // Bump dispute updatedAt so admin queue surfaces freshly-evidenced
      // disputes — gives reviewers a signal that new material has arrived.
      await tx.update(p2pDisputesTable)
        .set({ updatedAt: new Date() })
        .where(eq(p2pDisputesTable.id, dispute.id));

      // Counterparty notification — they should know the other side just
      // posted something so they can match or rebut it.
      const counterpartyId = role === "buyer" ? order.sellerId : order.buyerId;
      return { row, counterpartyId };
    });

    await createNotification(
      created.counterpartyId,
      "p2p_order",
      "New evidence on dispute",
      `The other party added evidence to the dispute on Order #${id}.`,
    ).catch(() => {});

    res.status(201).json({
      success: true,
      evidence: {
        id: created.row.id,
        disputeId: created.row.disputeId,
        uploaderRole: created.row.uploaderRole,
        fileType: created.row.fileType,
        // Echo the data URL so the client can render optimistically.
        fileData: created.row.fileData,
        caption: created.row.caption,
        createdAt: created.row.createdAt,
      },
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "Failed to attach evidence" });
  }
});

// GET /p2p/orders/:id/dispute/evidence — both parties can list all attachments.
router.get("/p2p/orders/:id/dispute/evidence", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [order] = await db.select().from(p2pOrdersTable)
      .where(and(
        eq(p2pOrdersTable.id, id),
        or(eq(p2pOrdersTable.buyerId, req.userId!), eq(p2pOrdersTable.sellerId, req.userId!)),
      )).limit(1);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    const [dispute] = await db.select().from(p2pDisputesTable)
      .where(eq(p2pDisputesTable.orderId, id)).limit(1);
    if (!dispute) { res.json({ evidence: [], disputeStatus: null }); return; }

    const rows = await db.select().from(p2pDisputeEvidenceTable)
      .where(eq(p2pDisputeEvidenceTable.disputeId, dispute.id))
      .orderBy(p2pDisputeEvidenceTable.createdAt);

    res.json({
      disputeStatus: dispute.status,
      evidence: rows.map((r) => ({
        id: r.id,
        uploaderRole: r.uploaderRole,
        uploadedByUserId: r.uploadedByUserId,
        fileType: r.fileType,
        fileData: r.fileData,
        caption: r.caption,
        createdAt: r.createdAt,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to load evidence" });
  }
});

// ─── P2P Chat ─────────────────────────────────────────────────────────────────

// GET /p2p/orders/:id/messages
router.get("/p2p/orders/:id/messages", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
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
  const id = parseInt(String(req.params.id));
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
    publishOrderEvent({ type: "chat.message", orderId: id, messageId: msg.id, senderId: req.userId! });
    res.status(201).json({ ...msg, isOwn: true, senderName: "You" });
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ─── P2P Ratings ──────────────────────────────────────────────────────────────

// GET /p2p/orders/:id/myrating
router.get("/p2p/orders/:id/myrating", async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id));
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
  const id = parseInt(String(req.params.id));
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
    // Recipient's avgRating + ratingCount changed — bust their trust card.
    await invalidateMerchantProfiles([toUserId]);
    res.status(201).json(newRating);
  } catch {
    res.status(500).json({ error: "Failed to submit rating" });
  }
});

export default router;
