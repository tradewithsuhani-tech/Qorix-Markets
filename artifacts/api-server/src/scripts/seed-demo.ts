/**
 * seed-demo.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a fully-populated demo account for Flutter UI development and
 * investor demos. Safe to run multiple times — uses upsert / ON CONFLICT.
 *
 * Run from workspace root:
 *   pnpm --filter @workspace/api-server tsx src/scripts/seed-demo.ts
 *
 * Demo credentials:
 *   Email:    demo@qorix.markets
 *   Password: Demo@Qorix2026
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
import { eq, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_EMAIL    = "demo@qorix.markets";
const DEMO_PASSWORD = "Demo@Qorix2026";
const DEMO_NAME     = "Arjun Mehta";
const DEMO_REFERRAL = "ARJUN7X";
const DEMO_TRON     = "TAi8ZdK3mQpLnJvXcYdF7wBzEtA3sHoU9";

// P2P counterparties (seed these too so P2P orders look real)
const P2P_SELLER_EMAIL    = "fasttrader@qorix.markets";
const P2P_SELLER_NAME     = "FastTrader99";
const P2P_SELLER_REFERRAL = "FAST99X";

const SPONSOR_EMAIL    = "sponsor@qorix.markets";
const SPONSOR_NAME     = "Vikram Singh";
const SPONSOR_REFERRAL = "VIKRAM5S";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 22) + 1, Math.floor(Math.random() * 59));
  return d;
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

function randomBetween(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function fakeTxHash(): string {
  return Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// User creation helper (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
async function upsertUser(data: {
  email: string; password: string; fullName: string; referralCode: string;
  tronAddress?: string; kycStatus?: string; points?: number; sponsorId?: number;
}) {
  const hash = await bcrypt.hash(data.password, 10);
  const existing = await db.select({ id: usersTable.id })
    .from(usersTable).where(eq(usersTable.email, data.email)).limit(1);

  if (existing.length > 0) {
    console.log(`  ↩  User already exists: ${data.email} (id=${existing[0]!.id})`);
    return existing[0]!.id;
  }

  const [user] = await db.insert(usersTable).values({
    email: data.email,
    passwordHash: hash,
    fullName: data.fullName,
    referralCode: data.referralCode,
    tronAddress: data.tronAddress ?? null,
    kycStatus: data.kycStatus ?? "approved",
    kycPersonalStatus: "approved",
    emailVerified: true,
    points: data.points ?? 0,
    sponsorId: data.sponsorId ?? 0,
  }).returning({ id: usersTable.id });

  console.log(`  ✓  Created user: ${data.email} (id=${user!.id})`);
  return user!.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main seed function
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("\n🌱  Qorix Markets — Demo Seed Starting...\n");

  // ── 1. Users ────────────────────────────────────────────────────────────────
  console.log("👤  Creating users...");

  const sponsorId = await upsertUser({
    email: SPONSOR_EMAIL, password: "Sponsor@Qorix26", fullName: SPONSOR_NAME,
    referralCode: SPONSOR_REFERRAL, kycStatus: "approved", points: 890,
  });

  const demoId = await upsertUser({
    email: DEMO_EMAIL, password: DEMO_PASSWORD, fullName: DEMO_NAME,
    referralCode: DEMO_REFERRAL, tronAddress: DEMO_TRON,
    kycStatus: "approved", points: 2450, sponsorId,
  });

  const p2pSellerId = await upsertUser({
    email: P2P_SELLER_EMAIL, password: "Seller@Qorix26", fullName: P2P_SELLER_NAME,
    referralCode: P2P_SELLER_REFERRAL, kycStatus: "approved", points: 1240,
  });

  // ── 2. Wallets ───────────────────────────────────────────────────────────────
  console.log("\n💰  Setting up wallets...");

  const upsertWallet = async (userId: number, main: string, usdt: string, trading: string, profit: string) => {
    const existing = await db.select({ id: walletsTable.id })
      .from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
    if (existing.length > 0) {
      await db.update(walletsTable)
        .set({ mainBalance: main, usdtBalance: usdt, tradingBalance: trading, profitBalance: profit })
        .where(eq(walletsTable.userId, userId));
      console.log(`  ↩  Updated wallet for userId=${userId}`);
    } else {
      await db.insert(walletsTable).values({ userId, mainBalance: main, usdtBalance: usdt, tradingBalance: trading, profitBalance: profit });
      console.log(`  ✓  Created wallet for userId=${userId}`);
    }
  };

  await upsertWallet(demoId,       "245000.00000000", "125.50000000", "5000.00000000", "412.75000000");
  await upsertWallet(p2pSellerId,  "80000.00000000",  "850.00000000", "2500.00000000", "148.20000000");
  await upsertWallet(sponsorId,    "120000.00000000", "60.00000000",  "1500.00000000", "87.40000000");

  // ── 3. Investment ────────────────────────────────────────────────────────────
  console.log("\n📈  Creating investment...");

  const existingInv = await db.select({ id: investmentsTable.id })
    .from(investmentsTable).where(eq(investmentsTable.userId, demoId)).limit(1);

  if (existingInv.length === 0) {
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
    console.log("  ✓  Investment created (5000 USDT, medium risk, active)");
  } else {
    console.log("  ↩  Investment already exists");
  }

  // ── 4. Equity History (90 days) ──────────────────────────────────────────────
  console.log("\n📊  Generating 90-day equity history...");

  const existingEquity = await db.select({ id: equityHistoryTable.id })
    .from(equityHistoryTable).where(eq(equityHistoryTable.userId, demoId)).limit(1);

  if (existingEquity.length === 0) {
    const equityRows: { userId: number; date: string; equity: string; profit: string }[] = [];
    let equity = 5000.0;
    let cumulativeProfit = 0.0;
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;
      // Weekends: no trading
      const dow = d.getDay();
      if (dow === 0 || dow === 6) {
        equityRows.push({ userId: demoId, date: dateStr, equity: equity.toFixed(8), profit: cumulativeProfit.toFixed(8) });
        continue;
      }
      // Realistic daily return: 0.3%–0.7%, occasionally negative (-0.1% to -0.3%)
      const rand = Math.random();
      let dailyReturn: number;
      if (rand < 0.12) {
        dailyReturn = randomBetween(-0.003, -0.001, 6); // Loss day (12% chance)
      } else if (rand < 0.25) {
        dailyReturn = randomBetween(0.001, 0.003, 6);   // Weak day
      } else if (rand < 0.75) {
        dailyReturn = randomBetween(0.003, 0.006, 6);   // Normal day
      } else {
        dailyReturn = randomBetween(0.006, 0.009, 6);   // Strong day
      }
      const dailyPnl = parseFloat((equity * dailyReturn).toFixed(8));
      equity = parseFloat((equity + dailyPnl).toFixed(8));
      cumulativeProfit = parseFloat((cumulativeProfit + dailyPnl).toFixed(8));
      equityRows.push({ userId: demoId, date: dateStr, equity: equity.toFixed(8), profit: cumulativeProfit.toFixed(8) });
    }
    await db.insert(equityHistoryTable).values(equityRows).onConflictDoNothing();
    console.log(`  ✓  ${equityRows.length} equity history rows inserted`);
  } else {
    console.log("  ↩  Equity history already exists");
  }

  // ── 5. Trades (150 simulated bot trades) ─────────────────────────────────────
  console.log("\n🤖  Generating 150 bot trades...");

  const existingTrades = await db.select({ id: tradesTable.id })
    .from(tradesTable).where(eq(tradesTable.userId, demoId)).limit(1);

  if (existingTrades.length === 0) {
    const SYMBOLS = [
      { sym: "XAUUSD", base: 2330, range: 30, pip: 0.01 },
      { sym: "EURUSD", base: 1.084, range: 0.012, pip: 0.00001 },
      { sym: "BTCUSD", base: 66500, range: 1200, pip: 0.5 },
      { sym: "USOIL",  base: 78.0, range: 2.0,   pip: 0.01 },
    ];

    const tradeRows = [];
    let tradeDay = 87;

    for (let i = 0; i < 150; i++) {
      const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!;
      const direction = Math.random() > 0.5 ? "buy" : "sell";
      const entryPrice = sym.base + randomBetween(-sym.range, sym.range, 5);
      const winTrade   = Math.random() > 0.28; // ~72% win rate
      const movePips   = winTrade
        ? randomBetween(8, 30, 1)
        : randomBetween(-12, -3, 1);
      const exitPrice  = direction === "buy"
        ? entryPrice + (movePips * sym.pip * 100)
        : entryPrice - (movePips * sym.pip * 100);

      const profitPercent = ((exitPrice - entryPrice) / entryPrice) * (direction === "sell" ? -1 : 1) * 100;
      const profit = parseFloat((5000 * (profitPercent / 100) * 0.05).toFixed(8)); // 5% position size

      if (i % 4 === 0 && tradeDay > 1) tradeDay--;

      tradeRows.push({
        userId: demoId,
        symbol: sym.sym,
        direction,
        entryPrice: entryPrice.toFixed(8),
        exitPrice:  Math.abs(exitPrice).toFixed(8),
        profit: profit.toFixed(8),
        profitPercent: profitPercent.toFixed(4),
        executedAt: daysAgo(tradeDay),
      });
    }
    await db.insert(tradesTable).values(tradeRows);
    console.log("  ✓  150 bot trades inserted");
  } else {
    console.log("  ↩  Trades already exist");
  }

  // ── 6. Transactions ──────────────────────────────────────────────────────────
  console.log("\n💳  Creating transaction history...");

  const existingTx = await db.select({ id: transactionsTable.id })
    .from(transactionsTable).where(eq(transactionsTable.userId, demoId)).limit(1);

  if (existingTx.length === 0) {
    const txRows = [
      // USDT deposit (TRC20 on-chain)
      { userId: demoId, type: "deposit",         amount: "150.50000000", status: "completed", description: "USDT TRC20 deposit confirmed",         txHash: fakeTxHash(), createdAt: daysAgo(42) },
      { userId: demoId, type: "deposit",         amount: "200.00000000", status: "completed", description: "USDT TRC20 deposit confirmed",         txHash: fakeTxHash(), createdAt: daysAgo(38) },

      // INR deposit (UPI)
      { userId: demoId, type: "deposit",         amount: "145000.00000000", status: "completed", description: "INR deposit via UPI — UTR: 2024051400123", createdAt: daysAgo(45) },
      { userId: demoId, type: "deposit",         amount: "100000.00000000", status: "completed", description: "INR deposit via Net Banking — UTR: 2024052200456", createdAt: daysAgo(30) },

      // Transfer to trading
      { userId: demoId, type: "transfer",        amount: "5000.00000000",  status: "completed", description: "Transfer to trading balance",      createdAt: daysAgo(40) },

      // Daily profits (last 40 working days)
      ...Array.from({ length: 38 }, (_, i) => ({
        userId: demoId, type: "profit",
        amount: randomBetween(18.0, 32.0, 8).toFixed(8),
        status: "completed",
        description: `Daily profit distribution — ${new Date(Date.now() - (i + 1) * 86400000).toISOString().split("T")[0]}`,
        createdAt: daysAgo(i + 1),
      })),

      // Referral bonus (sponsor paid Arjun)
      { userId: demoId, type: "referral_bonus",  amount: "75.00000000",    status: "completed", description: "Referral bonus — 3 referrals activated",   createdAt: daysAgo(20) },
      { userId: demoId, type: "referral_bonus",  amount: "50.00000000",    status: "completed", description: "Sponsor earnings — monthly payout",          createdAt: daysAgo(8) },

      // Withdrawal (pending)
      { userId: demoId, type: "withdrawal",      amount: "50.00000000",    status: "pending",   description: "USDT withdrawal to TRx9K8m...", walletAddress: "TRx9K8mQ2pLnJ4vXcYdF7wBzEtA3sHoU1", createdAt: daysAgo(3) },

      // P2P buy (received USDT from P2P trade)
      { userId: demoId, type: "p2p_trade",       amount: "100.00000000",   status: "completed", description: "P2P buy order #88 — 100 USDT received",     createdAt: daysAgo(10) },

      // Signal trade profit
      { userId: demoId, type: "signal_trade",    amount: "18.50000000",    status: "completed", description: "Signal trade BTCUSD closed +3.38% — your share", createdAt: daysAgo(15) },
    ];

    await db.insert(transactionsTable).values(txRows);
    console.log(`  ✓  ${txRows.length} transactions inserted`);
  } else {
    console.log("  ↩  Transactions already exist");
  }

  // ── 7. Notifications ─────────────────────────────────────────────────────────
  console.log("\n🔔  Creating notifications...");

  const existingNotifs = await db.select({ id: notificationsTable.id })
    .from(notificationsTable).where(eq(notificationsTable.userId, demoId)).limit(1);

  if (existingNotifs.length === 0) {
    const notifRows = [
      // Unread (recent)
      { userId: demoId, type: "trade",      isRead: false, title: "Daily Profit Distributed",     message: "Your bot earned $25.48 today (+0.48%). Profit added to your balance. Total profit: $412.75.",                     createdAt: hoursAgo(1) },
      { userId: demoId, type: "system",     isRead: false, title: "Drawdown Alert",               message: "Portfolio drawdown reached 1.24% of your 5% limit. Bot is continuing — you still have 3.76% buffer.",             createdAt: hoursAgo(4) },
      { userId: demoId, type: "p2p",        isRead: false, title: "P2P Order Update",             message: "FastTrader99 has released 100 USDT to your wallet. Order #88 completed successfully.",                            createdAt: hoursAgo(8) },

      // Read (older)
      { userId: demoId, type: "deposit",    isRead: true,  title: "USDT Deposit Confirmed",       message: "200.00 USDT has been credited to your USDT wallet. Balance: $325.50. Confirmation: 1 block.",                     createdAt: daysAgo(4) },
      { userId: demoId, type: "referral",   isRead: true,  title: "Referral Bonus Earned",        message: "You earned ₹6,250 (≈$50) in sponsor earnings this month. 3 active referrals.",                                    createdAt: daysAgo(8) },
      { userId: demoId, type: "withdrawal", isRead: true,  title: "Withdrawal Submitted",         message: "Your USDT 50.00 withdrawal is being processed. Expected within 24 hours.",                                        createdAt: daysAgo(9) },
      { userId: demoId, type: "trade",      isRead: true,  title: "Daily Profit Distributed",     message: "Your bot earned $23.91 today (+0.46%). Consistent performance — 5-day streak.",                                   createdAt: daysAgo(10) },
      { userId: demoId, type: "system",     isRead: true,  title: "Signal Trade Closed — Profit", message: "Admin signal trade BTCUSD +3.38% closed. Your share: $18.50 credited to trading balance.",                        createdAt: daysAgo(15) },
      { userId: demoId, type: "deposit",    isRead: true,  title: "INR Deposit Approved",         message: "₹1,00,000 deposit approved by admin. ₹3,45,000 total balance. UPI ref: 2024052200456.",                           createdAt: daysAgo(30) },
      { userId: demoId, type: "kyc",        isRead: true,  title: "KYC Approved",                 message: "Your identity verification is complete. Full access to deposits, withdrawals and P2P trading is now unlocked.",    createdAt: daysAgo(44) },
      { userId: demoId, type: "system",     isRead: true,  title: "Welcome to Qorix Markets!",    message: "Your account is active. Start by depositing USDT or INR to begin automated trading. Minimum: $10.",               createdAt: daysAgo(50) },
    ];

    await db.insert(notificationsTable).values(notifRows);
    console.log(`  ✓  ${notifRows.length} notifications inserted (3 unread)`);
  } else {
    console.log("  ↩  Notifications already exist");
  }

  // ── 8. P2P Setup ─────────────────────────────────────────────────────────────
  console.log("\n🤝  Setting up P2P ecosystem...");

  // P2P Wallets
  const upsertP2pWallet = async (userId: number, available: string, frozen: string) => {
    const existing = await db.select({ id: p2pWalletsTable.id })
      .from(p2pWalletsTable).where(eq(p2pWalletsTable.userId, userId)).limit(1);
    if (existing.length === 0) {
      await db.insert(p2pWalletsTable).values({ userId, availableBalance: available, frozenBalance: frozen });
      console.log(`  ✓  P2P wallet created for userId=${userId}`);
    } else {
      console.log(`  ↩  P2P wallet exists for userId=${userId}`);
    }
  };

  await upsertP2pWallet(demoId,      "125.50000000", "0.00000000");
  await upsertP2pWallet(p2pSellerId, "380.00000000", "120.00000000");

  // P2P Payment Method for seller
  const existingPM = await db.select({ id: p2pUserPaymentMethodsTable.id })
    .from(p2pUserPaymentMethodsTable).where(eq(p2pUserPaymentMethodsTable.userId, p2pSellerId)).limit(1);

  if (existingPM.length === 0) {
    await db.insert(p2pUserPaymentMethodsTable).values([
      { userId: p2pSellerId, type: "UPI", displayName: "GPay / PhonePe",   upiId: "fasttrader99@gpay",  isActive: true },
      { userId: p2pSellerId, type: "BANK", displayName: "HDFC Bank — NEFT", bankName: "HDFC Bank", accountHolder: P2P_SELLER_NAME, accountNumber: "50100478291234", ifsc: "HDFC0001234", isActive: true },
    ]);
    console.log("  ✓  P2P payment methods added for seller");
  }

  // Active SELL ad from FastTrader99
  const existingAd = await db.select({ id: p2pAdsTable.id })
    .from(p2pAdsTable).where(eq(p2pAdsTable.userId, p2pSellerId)).limit(1);

  let activeAdId: number;
  if (existingAd.length === 0) {
    const [ad] = await db.insert(p2pAdsTable).values({
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
    activeAdId = ad!.id;
    console.log(`  ✓  Active SELL ad created (id=${activeAdId})`);
  } else {
    activeAdId = existingAd[0]!.id;
    console.log(`  ↩  P2P ad already exists (id=${activeAdId})`);
  }

  // Completed P2P order (demo user bought 100 USDT from seller)
  const existingOrder = await db.select({ id: p2pOrdersTable.id })
    .from(p2pOrdersTable).where(eq(p2pOrdersTable.buyerId, demoId)).limit(1);

  let completedOrderId: number;
  if (existingOrder.length === 0) {
    const deadline = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000);
    const [order] = await db.insert(p2pOrdersTable).values({
      adId: activeAdId,
      buyerId: demoId,
      sellerId: p2pSellerId,
      fiatAmount: "9650.00",
      usdtAmount: "100.00000000",
      price: "96.50",
      paymentMethod: "UPI",
      status: "completed",
      paymentDeadline: deadline,
      paidAt: daysAgo(10),
      completedAt: daysAgo(10),
      paymentRef: "GPay Ref: 416052109334",
    }).returning({ id: p2pOrdersTable.id });
    completedOrderId = order!.id;
    console.log(`  ✓  Completed P2P order #${completedOrderId} (100 USDT)`);

    // Escrow record
    await db.insert(p2pEscrowTransactionsTable).values({
      orderId: completedOrderId,
      sellerId: p2pSellerId,
      buyerId: demoId,
      amount: "100.00000000",
      status: "released",
      releasedAt: daysAgo(10),
    });

    // Chat messages for completed order
    await db.insert(p2pChatMessagesTable).values([
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: true,  message: "Order created. Buyer: deposit ₹9,650 to seller's UPI/bank to receive 100 USDT." },
      { orderId: completedOrderId, senderId: demoId,      isSystem: false, message: "Hi, I'll pay via GPay right now.",                                    createdAt: minutesAgo(14420) },
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: false, message: "Sure, my GPay: fasttrader99@gpay — add note 'USDT purchase'.",          createdAt: minutesAgo(14415) },
      { orderId: completedOrderId, senderId: demoId,      isSystem: false, message: "Payment sent! Reference: 416052109334",                                 createdAt: minutesAgo(14410) },
      { orderId: completedOrderId, senderId: demoId,      isSystem: true,  message: "Buyer has marked the payment as sent. Seller: please verify and release USDT." },
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: false, message: "Received ₹9,650. Releasing USDT now. Thanks!",                          createdAt: minutesAgo(14400) },
      { orderId: completedOrderId, senderId: p2pSellerId, isSystem: true,  message: "USDT released. Order completed successfully. Enjoy trading on Qorix!" },
    ]);

    // Rating
    await db.insert(p2pRatingsTable).values([
      { orderId: completedOrderId, fromUserId: demoId,      toUserId: p2pSellerId, rating: 5, comment: "Fast and reliable. Payment confirmed in under 10 minutes. Highly recommended!" },
      { orderId: completedOrderId, fromUserId: p2pSellerId, toUserId: demoId,      rating: 5, comment: "Quick payer, good communication. Great buyer." },
    ]);

    console.log("  ✓  P2P chat messages and ratings inserted");
  } else {
    completedOrderId = existingOrder[0]!.id;
    console.log(`  ↩  P2P order already exists (id=${completedOrderId})`);
  }

  // Active (pending) P2P order so Flutter dev can see live order UI
  const existingPendingOrder = await db.select({ id: p2pOrdersTable.id })
    .from(p2pOrdersTable)
    .where(sql`${p2pOrdersTable.buyerId} = ${demoId} AND ${p2pOrdersTable.status} = 'pending'`)
    .limit(1);

  if (existingPendingOrder.length === 0) {
    const payDeadline = new Date(Date.now() + 12 * 60 * 1000); // 12 mins from now
    const [pendingOrder] = await db.insert(p2pOrdersTable).values({
      adId: activeAdId,
      buyerId: demoId,
      sellerId: p2pSellerId,
      fiatAmount: "4825.00",
      usdtAmount: "50.00000000",
      price: "96.50",
      paymentMethod: "UPI",
      status: "pending",
      paymentDeadline: payDeadline,
    }).returning({ id: p2pOrdersTable.id });

    const pendingId = pendingOrder!.id;

    await db.insert(p2pChatMessagesTable).values([
      { orderId: pendingId, senderId: p2pSellerId, isSystem: true,  message: "Order created. You have 15 minutes to send ₹4,825 to seller. Pay and click 'Mark as Paid'." },
      { orderId: pendingId, senderId: p2pSellerId, isSystem: false, message: "Hi! Ready when you are. UPI: fasttrader99@gpay or use bank transfer.", createdAt: minutesAgo(2) },
    ]);
    console.log(`  ✓  Active pending P2P order #${pendingId} (50 USDT, 12 min countdown)`);
  } else {
    console.log("  ↩  Pending P2P order already exists");
  }

  // ── Final summary ─────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║          ✅  DEMO SEED COMPLETE — Qorix Markets                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  DEMO LOGIN CREDENTIALS                                          ║
║  ─────────────────────────────────────────────────────────────   ║
║  Email:    demo@qorix.markets                                    ║
║  Password: Demo@Qorix2026                                        ║
║                                                                  ║
║  SEEDED DATA                                                     ║
║  ─────────────────────────────────────────────────────────────   ║
║  Main Balance:     ₹2,45,000 (INR)                              ║
║  USDT Balance:     $125.50                                        ║
║  Trading Balance:  $5,000.00 (ACTIVE bot)                        ║
║  Profit Balance:   $412.75                                        ║
║  Points:           2,450                                          ║
║  KYC:              Approved                                       ║
║  Equity History:   90 days                                        ║
║  Bot Trades:       150                                            ║
║  Transactions:     ~50                                            ║
║  Notifications:    11 (3 unread)                                  ║
║  P2P Orders:       2 (1 completed, 1 pending/live)               ║
║  Referral Code:    ARJUN7X                                        ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

// ─────────────────────────────────────────────────────────────────────────────
seed().then(() => process.exit(0)).catch((err) => {
  console.error("\n❌  Seed failed:", err);
  process.exit(1);
});
