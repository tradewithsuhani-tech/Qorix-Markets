/**
 * routes/demo.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/demo/reset
 *
 * One-call full demo ecosystem reset for Flutter developers, QA engineers,
 * and investor demos. Wipes all demo-account data and re-seeds a fresh,
 * premium, production-like dataset in a single HTTP call.
 *
 * SECURITY GATES (all must pass):
 *   1. DEMO_RESET_SECRET env var must be set.
 *   2. Request must supply matching secret via:
 *        Authorization: Bearer <secret>
 *      OR:
 *        X-Demo-Secret: <secret>
 *   3. In production (NODE_ENV=production) the additional env flag
 *        DEMO_RESET_ENABLED=true
 *      must be set. Without it, the route returns 503 in production so
 *      an accidental deploy of a staging config can never wipe prod data.
 *
 * DEMO CREDENTIALS (post-reset):
 *   Email:    demo@qorix.markets
 *   Password: Demo@Qorix2026
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * API Docs
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Request:
 *   POST /api/demo/reset
 *   Authorization: Bearer <DEMO_RESET_SECRET>
 *   Content-Type: application/json
 *
 *   Body (all optional):
 *   {
 *     "confirm": "RESET_DEMO"   // safety confirmation string (optional extra gate)
 *   }
 *
 * Success response 200:
 *   {
 *     "success": true,
 *     "message": "Demo ecosystem reset complete.",
 *     "demoEmail": "demo@qorix.markets",
 *     "demoPassword": "Demo@Qorix2026",
 *     "resetAt": "2026-05-24T10:30:00.000Z",
 *     "durationMs": 1240,
 *     "seeded": {
 *       "wallets":       { "inr": 245000, "usdt": 125.50, "trading": 5000.00, "profit": 412.75 },
 *       "investment":    { "amount": 5000, "riskLevel": "medium", "isActive": true, "totalProfit": 412.75 },
 *       "trades":        150,
 *       "transactions":  48,
 *       "notifications": { "total": 11, "unread": 3 },
 *       "equityHistory": 90,
 *       "p2p":           { "ads": 1, "completedOrders": 1, "pendingOrders": 1, "chatMessages": 9, "ratings": 2 }
 *     }
 *   }
 *
 * Error responses:
 *   401 — Missing or invalid demo secret
 *   400 — Confirm string mismatch (if provided)
 *   503 — Reset disabled in this environment
 *   500 — Internal error (see message field)
 *
 * Sample cURL:
 *   curl -X POST https://qorix-api.fly.dev/api/demo/reset \
 *     -H "Authorization: Bearer your-demo-reset-secret" \
 *     -H "Content-Type: application/json" \
 *     -d '{}' | jq .
 *
 * Local dev:
 *   curl -X POST http://localhost:8080/api/demo/reset \
 *     -H "Authorization: Bearer dev-demo-secret-2026" \
 *     -H "Content-Type: application/json" \
 *     -d '{}'
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable,
  walletsTable,
  investmentsTable,
  tradesTable,
  transactionsTable,
  notificationsTable,
  equityHistoryTable,
  p2pWalletsTable,
  p2pAdsTable,
  p2pOrdersTable,
  p2pChatMessagesTable,
  p2pEscrowTransactionsTable,
  p2pUserPaymentMethodsTable,
  p2pRatingsTable,
} from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────
const DEMO_EMAIL     = "demo@qorix.markets";
const DEMO_PASSWORD  = "Demo@Qorix2026";
const DEMO_NAME      = "Arjun Mehta";
const DEMO_REFERRAL  = "ARJUN7X";
const DEMO_TRON      = "TAi8ZdK3mQpLnJvXcYdF7wBzEtA3sHoU9";

const P2P_SELLER_EMAIL    = "fasttrader@qorix.markets";
const P2P_SELLER_NAME     = "FastTrader99";
const P2P_SELLER_REFERRAL = "FAST99X";

const SPONSOR_EMAIL    = "sponsor@qorix.markets";
const SPONSOR_NAME     = "Vikram Singh";
const SPONSOR_REFERRAL = "VIKRAM5S";

// Pre-hash the demo password at module load — bcrypt is CPU-intensive so
// we do it once and reuse across multiple calls. Cost factor 10 matches
// production registration.
const DEMO_PASSWORD_HASH_PROMISE = bcrypt.hash(DEMO_PASSWORD, 10);
const SUPPORT_PASSWORD_HASH_PROMISE = bcrypt.hash("Seller@Qorix26", 10);
const SPONSOR_PASSWORD_HASH_PROMISE = bcrypt.hash("Sponsor@Qorix26", 10);

// ─── Auth guard ───────────────────────────────────────────────────────────────
function extractDemoSecret(req: Request): string | null {
  // Accept Bearer token in Authorization header
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  // Also accept X-Demo-Secret for environments where Authorization is stripped
  const header = req.headers["x-demo-secret"];
  if (typeof header === "string" && header.trim()) return header.trim();
  return null;
}

function isDemoResetAllowed(): { allowed: boolean; reason?: string } {
  const secret = process.env["DEMO_RESET_SECRET"];
  if (!secret) {
    return { allowed: false, reason: "DEMO_RESET_SECRET is not configured on this server." };
  }
  if (process.env["NODE_ENV"] === "production" && process.env["DEMO_RESET_ENABLED"] !== "true") {
    return {
      allowed: false,
      reason:
        "Demo reset is disabled in production. " +
        "Set DEMO_RESET_ENABLED=true on the server if this is intentional for a staging deploy.",
    };
  }
  return { allowed: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number, hourJitter = true): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  if (hourJitter) {
    d.setHours(Math.floor(Math.random() * 22) + 1, Math.floor(Math.random() * 59));
  }
  return d;
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 3_600_000);
}

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60_000);
}

function rand(min: number, max: number, dp = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dp));
}

function fakeTxHash(): string {
  return Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
}

// ─── Upsert helpers ───────────────────────────────────────────────────────────
async function upsertUser(data: {
  email: string;
  passwordHash: string;
  fullName: string;
  referralCode: string;
  tronAddress?: string;
  points?: number;
  sponsorId?: number;
}): Promise<number> {
  const existing = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, data.email)).limit(1);

  if (existing.length > 0) {
    // Refresh password hash so demo credentials are always correct post-reset
    await db.update(usersTable).set({
      passwordHash: data.passwordHash,
      points: data.points ?? 0,
      kycStatus: "approved",
      kycPersonalStatus: "approved",
      emailVerified: true,
    }).where(eq(usersTable.email, data.email));
    return existing[0]!.id;
  }

  const [user] = await db.insert(usersTable).values({
    email: data.email,
    passwordHash: data.passwordHash,
    fullName: data.fullName,
    referralCode: data.referralCode,
    tronAddress: data.tronAddress ?? null,
    kycStatus: "approved",
    kycPersonalStatus: "approved",
    emailVerified: true,
    points: data.points ?? 0,
    sponsorId: data.sponsorId ?? 0,
  }).returning({ id: usersTable.id });

  return user!.id;
}

// ─── Core reset function ──────────────────────────────────────────────────────
async function resetDemoEcosystem(): Promise<{
  durationMs: number;
  seeded: {
    wallets: { inr: number; usdt: number; trading: number; profit: number };
    investment: { amount: number; riskLevel: string; isActive: boolean; totalProfit: number };
    trades: number;
    transactions: number;
    notifications: { total: number; unread: number };
    equityHistory: number;
    p2p: { ads: number; completedOrders: number; pendingOrders: number; chatMessages: number; ratings: number };
  };
}> {
  const t0 = Date.now();

  // ── Pre-hash passwords (resolved from module-level promises) ────────────────
  const [demoHash, sellerHash, sponsorHash] = await Promise.all([
    DEMO_PASSWORD_HASH_PROMISE,
    SUPPORT_PASSWORD_HASH_PROMISE,
    SPONSOR_PASSWORD_HASH_PROMISE,
  ]);

  // ── 1. Ensure all 3 users exist / refresh credentials ──────────────────────
  const [sponsorId, demoId, p2pSellerId] = await Promise.all([
    upsertUser({ email: SPONSOR_EMAIL,    passwordHash: sponsorHash, fullName: SPONSOR_NAME,    referralCode: SPONSOR_REFERRAL, points: 890 }),
    upsertUser({ email: DEMO_EMAIL,       passwordHash: demoHash,    fullName: DEMO_NAME,        referralCode: DEMO_REFERRAL,    tronAddress: DEMO_TRON, points: 2450 }),
    upsertUser({ email: P2P_SELLER_EMAIL, passwordHash: sellerHash,  fullName: P2P_SELLER_NAME,  referralCode: P2P_SELLER_REFERRAL, points: 1240 }),
  ]);

  // Fix sponsor FK on demo user (set after the fact since sponsor didn't exist when demo was first inserted)
  await db.update(usersTable).set({ sponsorId }).where(eq(usersTable.id, demoId));

  // ── 2. Delete all existing demo data in parallel ────────────────────────────
  // Find P2P order IDs for the demo user first (needed for cascades)
  const existingOrders = await db.select({ id: p2pOrdersTable.id })
    .from(p2pOrdersTable)
    .where(sql`${p2pOrdersTable.buyerId} = ${demoId} OR ${p2pOrdersTable.sellerId} = ${p2pSellerId}`);

  const orderIds = existingOrders.map(o => o.id);

  // Find P2P ad IDs for the seller
  const existingAds = await db.select({ id: p2pAdsTable.id })
    .from(p2pAdsTable).where(eq(p2pAdsTable.userId, p2pSellerId));
  const adIds = existingAds.map(a => a.id);

  // Delete everything in parallel where possible
  await Promise.all([
    // Core demo user data
    db.delete(tradesTable).where(eq(tradesTable.userId, demoId)),
    db.delete(transactionsTable).where(eq(transactionsTable.userId, demoId)),
    db.delete(notificationsTable).where(eq(notificationsTable.userId, demoId)),
    db.delete(equityHistoryTable).where(eq(equityHistoryTable.userId, demoId)),
    // P2P chat + escrow + ratings (keyed by orderId)
    ...(orderIds.length > 0 ? [
      db.delete(p2pChatMessagesTable).where(inArray(p2pChatMessagesTable.orderId, orderIds)),
      db.delete(p2pEscrowTransactionsTable).where(inArray(p2pEscrowTransactionsTable.orderId, orderIds)),
      db.delete(p2pRatingsTable).where(inArray(p2pRatingsTable.orderId, orderIds)),
    ] : []),
  ]);

  // Delete orders + ads + payment methods after chat/escrow/ratings are gone
  await Promise.all([
    ...(orderIds.length > 0 ? [db.delete(p2pOrdersTable).where(inArray(p2pOrdersTable.id, orderIds))] : []),
    ...(adIds.length > 0 ? [db.delete(p2pAdsTable).where(inArray(p2pAdsTable.id, adIds))] : []),
    db.delete(p2pUserPaymentMethodsTable).where(eq(p2pUserPaymentMethodsTable.userId, p2pSellerId)),
    db.delete(p2pWalletsTable).where(eq(p2pWalletsTable.userId, demoId)),
    db.delete(p2pWalletsTable).where(eq(p2pWalletsTable.userId, p2pSellerId)),
    db.delete(investmentsTable).where(eq(investmentsTable.userId, demoId)),
  ]);

  // ── 3. Wallets (upsert — reset balances to fresh state) ─────────────────────
  const upsertWallet = async (userId: number, main: string, usdt: string, trading: string, profit: string) => {
    const existing = await db.select({ id: walletsTable.id }).from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
    if (existing.length > 0) {
      await db.update(walletsTable).set({
        mainBalance: main, usdtBalance: usdt, tradingBalance: trading, profitBalance: profit, updatedAt: new Date(),
      }).where(eq(walletsTable.userId, userId));
    } else {
      await db.insert(walletsTable).values({ userId, mainBalance: main, usdtBalance: usdt, tradingBalance: trading, profitBalance: profit });
    }
  };

  await Promise.all([
    upsertWallet(demoId,      "245000.00000000", "125.50000000", "5000.00000000", "412.75000000"),
    upsertWallet(p2pSellerId, "80000.00000000",  "850.00000000", "2500.00000000", "148.20000000"),
    upsertWallet(sponsorId,   "120000.00000000", "60.00000000",  "1500.00000000", "87.40000000"),
  ]);

  // ── 4. Investment ─────────────────────────────────────────────────────────────
  await db.insert(investmentsTable).values({
    userId: demoId,
    amount: "5000.00000000",
    riskLevel: "medium",
    isActive: true,
    isPaused: false,
    autoCompound: false,
    totalProfit: "412.75000000",
    dailyProfit: "25.48000000",
    drawdown: "1.24",
    drawdownLimit: "5.00",
    peakBalance: "5412.75000000",
    referralBonusPaid: true,
    startedAt: daysAgo(40),
  });

  // ── 5. Equity History (90 days) ────────────────────────────────────────────
  const equityRows: { userId: number; date: string; equity: string; profit: string }[] = [];
  let equity = 5000.0;
  let cumulativeProfit = 0.0;
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;
    const dow = d.getDay();
    if (dow === 0 || dow === 6) {
      equityRows.push({ userId: demoId, date: dateStr, equity: equity.toFixed(8), profit: cumulativeProfit.toFixed(8) });
      continue;
    }
    const r = Math.random();
    const dailyReturn = r < 0.12
      ? rand(-0.003, -0.001, 6)
      : r < 0.25 ? rand(0.001, 0.003, 6)
      : r < 0.75 ? rand(0.003, 0.006, 6)
      : rand(0.006, 0.009, 6);
    const dailyPnl = parseFloat((equity * dailyReturn).toFixed(8));
    equity = parseFloat((equity + dailyPnl).toFixed(8));
    cumulativeProfit = parseFloat((cumulativeProfit + dailyPnl).toFixed(8));
    equityRows.push({ userId: demoId, date: dateStr, equity: equity.toFixed(8), profit: cumulativeProfit.toFixed(8) });
  }
  await db.insert(equityHistoryTable).values(equityRows);

  // ── 6. Bot Trades (150) ───────────────────────────────────────────────────
  const SYMBOLS = [
    { sym: "XAUUSD", base: 2330, range: 30,   pip: 0.01    },
    { sym: "EURUSD", base: 1.084, range: 0.012, pip: 0.00001 },
    { sym: "BTCUSD", base: 66500, range: 1200, pip: 0.5     },
    { sym: "USOIL",  base: 78.0,  range: 2.0,  pip: 0.01    },
  ];
  const tradeRows = [];
  let tradeDay = 87;
  for (let i = 0; i < 150; i++) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!;
    const direction = Math.random() > 0.5 ? "buy" : "sell";
    const entryPrice = sym.base + rand(-sym.range, sym.range, 5);
    const winTrade = Math.random() > 0.28;
    const movePips = winTrade ? rand(8, 30, 1) : rand(-12, -3, 1);
    const exitPrice = direction === "buy"
      ? entryPrice + movePips * sym.pip * 100
      : entryPrice - movePips * sym.pip * 100;
    const profitPercent = ((exitPrice - entryPrice) / entryPrice) * (direction === "sell" ? -1 : 1) * 100;
    const profit = parseFloat((5000 * (profitPercent / 100) * 0.05).toFixed(8));
    if (i % 4 === 0 && tradeDay > 1) tradeDay--;
    tradeRows.push({
      userId: demoId, symbol: sym.sym, direction,
      entryPrice: entryPrice.toFixed(8),
      exitPrice: Math.abs(exitPrice).toFixed(8),
      profit: profit.toFixed(8),
      profitPercent: profitPercent.toFixed(4),
      executedAt: daysAgo(tradeDay),
    });
  }
  await db.insert(tradesTable).values(tradeRows);

  // ── 7. Transactions ────────────────────────────────────────────────────────
  const txRows = [
    { userId: demoId, type: "deposit",      amount: "150.50000000",     status: "completed", description: "USDT TRC20 deposit confirmed",                         txHash: fakeTxHash(), createdAt: daysAgo(42) },
    { userId: demoId, type: "deposit",      amount: "200.00000000",     status: "completed", description: "USDT TRC20 deposit confirmed",                         txHash: fakeTxHash(), createdAt: daysAgo(38) },
    { userId: demoId, type: "deposit",      amount: "145000.00000000",  status: "completed", description: "INR deposit via UPI — UTR: 2024051400123",            createdAt: daysAgo(45) },
    { userId: demoId, type: "deposit",      amount: "100000.00000000",  status: "completed", description: "INR deposit via Net Banking — UTR: 2024052200456",    createdAt: daysAgo(30) },
    { userId: demoId, type: "transfer",     amount: "5000.00000000",    status: "completed", description: "Transfer to trading balance",                         createdAt: daysAgo(40) },
    ...Array.from({ length: 38 }, (_, i) => ({
      userId: demoId, type: "profit",
      amount: rand(18.0, 32.0, 8).toFixed(8),
      status: "completed",
      description: `Daily profit distribution — ${new Date(Date.now() - (i + 1) * 86_400_000).toISOString().split("T")[0]}`,
      createdAt: daysAgo(i + 1),
    })),
    { userId: demoId, type: "referral_bonus", amount: "75.00000000",   status: "completed", description: "Referral bonus — 3 referrals activated",              createdAt: daysAgo(20) },
    { userId: demoId, type: "referral_bonus", amount: "50.00000000",   status: "completed", description: "Sponsor earnings — monthly payout",                   createdAt: daysAgo(8)  },
    { userId: demoId, type: "withdrawal",   amount: "50.00000000",     status: "pending",   description: "USDT withdrawal to TRx9K8m...", walletAddress: "TRx9K8mQ2pLnJ4vXcYdF7wBzEtA3sHoU1", createdAt: daysAgo(3) },
    { userId: demoId, type: "p2p_trade",    amount: "100.00000000",    status: "completed", description: "P2P buy order — 100 USDT received from FastTrader99", createdAt: daysAgo(10) },
    { userId: demoId, type: "signal_trade", amount: "18.50000000",     status: "completed", description: "Signal trade BTCUSD closed +3.38% — your share",      createdAt: daysAgo(15) },
  ];
  await db.insert(transactionsTable).values(txRows);

  // ── 8. Notifications ──────────────────────────────────────────────────────
  const notifRows = [
    { userId: demoId, type: "trade",      isRead: false, title: "Daily Profit Distributed",     message: "Your bot earned $25.48 today (+0.48%). Profit added to your balance. Total profit: $412.75.",               createdAt: hoursAgo(1) },
    { userId: demoId, type: "system",     isRead: false, title: "Drawdown Alert",               message: "Portfolio drawdown reached 1.24% of your 5% limit. Bot is continuing — you still have 3.76% buffer.",       createdAt: hoursAgo(4) },
    { userId: demoId, type: "p2p",        isRead: false, title: "P2P Order Completed",          message: "FastTrader99 has released 100 USDT to your wallet. Order completed successfully.",                           createdAt: hoursAgo(8) },
    { userId: demoId, type: "deposit",    isRead: true,  title: "USDT Deposit Confirmed",       message: "200.00 USDT has been credited to your USDT wallet. Balance: $325.50.",                                      createdAt: daysAgo(4) },
    { userId: demoId, type: "referral",   isRead: true,  title: "Referral Bonus Earned",        message: "You earned ₹6,250 (≈$50) in sponsor earnings this month. 3 active referrals.",                              createdAt: daysAgo(8) },
    { userId: demoId, type: "withdrawal", isRead: true,  title: "Withdrawal Submitted",         message: "Your USDT 50.00 withdrawal is being processed. Expected within 24 hours.",                                  createdAt: daysAgo(9) },
    { userId: demoId, type: "trade",      isRead: true,  title: "Daily Profit Distributed",     message: "Your bot earned $23.91 today (+0.46%). Consistent performance — 5-day streak.",                             createdAt: daysAgo(10) },
    { userId: demoId, type: "system",     isRead: true,  title: "Signal Trade Closed — Profit", message: "Admin signal trade BTCUSD +3.38% closed. Your share: $18.50 credited to trading balance.",                  createdAt: daysAgo(15) },
    { userId: demoId, type: "deposit",    isRead: true,  title: "INR Deposit Approved",         message: "₹1,00,000 deposit approved. ₹3,45,000 total balance. UPI ref: 2024052200456.",                              createdAt: daysAgo(30) },
    { userId: demoId, type: "kyc",        isRead: true,  title: "KYC Approved",                 message: "Your identity verification is complete. Full access to deposits, withdrawals and P2P trading is now unlocked.", createdAt: daysAgo(44) },
    { userId: demoId, type: "system",     isRead: true,  title: "Welcome to Qorix Markets!",    message: "Your account is active. Start by depositing USDT or INR to begin automated trading. Minimum: $10.",         createdAt: daysAgo(50) },
  ];
  await db.insert(notificationsTable).values(notifRows);

  // ── 9. P2P ecosystem ──────────────────────────────────────────────────────
  await Promise.all([
    db.insert(p2pWalletsTable).values({ userId: demoId,      availableBalance: "125.50000000", frozenBalance: "0.00000000" }),
    db.insert(p2pWalletsTable).values({ userId: p2pSellerId, availableBalance: "380.00000000", frozenBalance: "120.00000000" }),
  ]);

  await db.insert(p2pUserPaymentMethodsTable).values([
    { userId: p2pSellerId, type: "UPI",  displayName: "GPay / PhonePe",    upiId: "fasttrader99@gpay", isActive: true },
    { userId: p2pSellerId, type: "BANK", displayName: "HDFC Bank — NEFT",  bankName: "HDFC Bank", accountHolder: P2P_SELLER_NAME, accountNumber: "50100478291234", ifsc: "HDFC0001234", isActive: true },
  ]);

  const [activeAd] = await db.insert(p2pAdsTable).values({
    userId: p2pSellerId,
    type: "SELL",
    asset: "USDT",
    fiatCurrency: "INR",
    price: "96.50",
    quantity: "500.00000000",
    minLimit: "500.00",
    maxLimit: "48250.00",
    paymentMethods: JSON.stringify(["UPI", "BANK"]),
    terms: "Payment within 15 minutes. GPay/PhonePe preferred. Add reference: USDT purchase.",
    timeLimit: 15,
    status: "active",
    filledQuantity: "120.00000000",
  }).returning({ id: p2pAdsTable.id });

  const adId = activeAd!.id;

  // Completed order
  const completedDeadline = new Date(daysAgo(10).getTime() + 15 * 60_000);
  const [completedOrder] = await db.insert(p2pOrdersTable).values({
    adId,
    buyerId: demoId,
    sellerId: p2pSellerId,
    fiatAmount: "9650.00",
    usdtAmount: "100.00000000",
    price: "96.50",
    paymentMethod: "UPI",
    status: "completed",
    paymentDeadline: completedDeadline,
    paidAt: daysAgo(10),
    completedAt: daysAgo(10),
    paymentRef: "GPay Ref: 416052109334",
  }).returning({ id: p2pOrdersTable.id });

  const completedOrderId = completedOrder!.id;

  await Promise.all([
    db.insert(p2pEscrowTransactionsTable).values({
      orderId: completedOrderId,
      sellerId: p2pSellerId,
      buyerId: demoId,
      amount: "100.00000000",
      status: "released",
      releasedAt: daysAgo(10),
    }),
    db.insert(p2pChatMessagesTable).values([
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: true,  message: "Order created. Buyer: deposit ₹9,650 to seller's UPI/bank to receive 100 USDT." },
      { orderId: completedOrderId, senderId: demoId,      isSystem: false, message: "Hi, I'll pay via GPay right now.",                                                  createdAt: minutesAgo(14420) },
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: false, message: "Sure, my GPay: fasttrader99@gpay — add note 'USDT purchase'.",                      createdAt: minutesAgo(14415) },
      { orderId: completedOrderId, senderId: demoId,      isSystem: false, message: "Payment sent! Reference: 416052109334",                                             createdAt: minutesAgo(14410) },
      { orderId: completedOrderId, senderId: demoId,      isSystem: true,  message: "Buyer has marked the payment as sent. Seller: please verify and release USDT." },
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: false, message: "Received ₹9,650. Releasing USDT now. Thanks!",                                      createdAt: minutesAgo(14400) },
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: true,  message: "USDT released. Order completed successfully. Enjoy trading on Qorix!" },
    ]),
    db.insert(p2pRatingsTable).values([
      { orderId: completedOrderId, fromUserId: demoId,      toUserId: p2pSellerId, rating: 5, comment: "Fast and reliable. Payment confirmed in under 10 minutes. Highly recommended!" },
      { orderId: completedOrderId, fromUserId: p2pSellerId, toUserId: demoId,      rating: 5, comment: "Quick payer, good communication. Great buyer." },
    ]),
  ]);

  // Live pending order (12-minute countdown from reset time)
  const pendingDeadline = new Date(Date.now() + 12 * 60_000);
  const [pendingOrder] = await db.insert(p2pOrdersTable).values({
    adId,
    buyerId: demoId,
    sellerId: p2pSellerId,
    fiatAmount: "4825.00",
    usdtAmount: "50.00000000",
    price: "96.50",
    paymentMethod: "UPI",
    status: "pending",
    paymentDeadline: pendingDeadline,
  }).returning({ id: p2pOrdersTable.id });

  await db.insert(p2pChatMessagesTable).values([
    { orderId: pendingOrder!.id, senderId: p2pSellerId, isSystem: true,  message: "Order created. You have 15 minutes to send ₹4,825 to seller. Pay and click 'Mark as Paid'." },
    { orderId: pendingOrder!.id, senderId: p2pSellerId, isSystem: false, message: "Hi! Ready when you are. UPI: fasttrader99@gpay or use bank transfer.",                         createdAt: minutesAgo(2) },
  ]);

  const durationMs = Date.now() - t0;

  return {
    durationMs,
    seeded: {
      wallets:       { inr: 245000, usdt: 125.50, trading: 5000.00, profit: 412.75 },
      investment:    { amount: 5000, riskLevel: "medium", isActive: true, totalProfit: 412.75 },
      trades:        150,
      transactions:  txRows.length,
      notifications: { total: notifRows.length, unread: 3 },
      equityHistory: equityRows.length,
      p2p:           { ads: 1, completedOrders: 1, pendingOrders: 1, chatMessages: 9, ratings: 2 },
    },
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.post("/demo/reset", async (req: Request, res: Response) => {
  // 1. Environment gate — fail fast before touching any data
  const { allowed, reason } = isDemoResetAllowed();
  if (!allowed) {
    res.status(503).json({ error: reason ?? "Demo reset is not available in this environment." });
    return;
  }

  // 2. Secret auth
  const configuredSecret = process.env["DEMO_RESET_SECRET"]!;
  const suppliedSecret = extractDemoSecret(req);
  if (!suppliedSecret || suppliedSecret !== configuredSecret) {
    res.status(401).json({ error: "Invalid or missing demo reset secret. Provide it via Authorization: Bearer <secret> or X-Demo-Secret header." });
    return;
  }

  // 3. Optional confirmation string (extra safety gate for CI/CD pipelines)
  const { confirm } = req.body as { confirm?: string };
  if (confirm !== undefined && confirm !== "RESET_DEMO") {
    res.status(400).json({ error: "If 'confirm' is provided it must equal the string 'RESET_DEMO'." });
    return;
  }

  logger.info({ ip: req.ip }, "[demo-reset] Demo ecosystem reset initiated");

  try {
    const { durationMs, seeded } = await resetDemoEcosystem();

    logger.info({ durationMs, seeded }, "[demo-reset] Demo ecosystem reset complete");

    res.json({
      success: true,
      message: "Demo ecosystem reset complete. Login with the credentials below.",
      demoEmail: DEMO_EMAIL,
      demoPassword: DEMO_PASSWORD,
      resetAt: new Date().toISOString(),
      durationMs,
      seeded,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "[demo-reset] Demo reset failed");
    res.status(500).json({
      error: "Demo reset failed. See server logs for details.",
      detail: message,
    });
  }
});

// ─── Health-check / info route (no auth) ─────────────────────────────────────
// Returns whether the reset endpoint is available in this environment without
// exposing any secret. Useful for Flutter devs to check before calling reset.
router.get("/demo/status", (_req: Request, res: Response) => {
  const { allowed, reason } = isDemoResetAllowed();
  const hasSecret = !!process.env["DEMO_RESET_SECRET"];
  res.json({
    resetAvailable: allowed && hasSecret,
    reason: allowed ? null : reason,
    demoEmail: DEMO_EMAIL,
    env: process.env["NODE_ENV"] ?? "development",
  });
});

export default router;
