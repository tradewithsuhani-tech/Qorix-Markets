import { db, walletsTable, investmentsTable, transactionsTable, systemSettingsTable, equityHistoryTable, monthlyPerformanceTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { ensureUserAccounts, postJournalEntry, journalForTransaction, journalForSystem } from "./ledger-service";
import { logger } from "./logger";

export const DEMO_DEFAULT_AMOUNT = 500;

export async function getDemoSignupAmount(): Promise<number> {
  const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "demo_signup_amount")).limit(1);
  const v = parseFloat(rows[0]?.value ?? "");
  return Number.isFinite(v) && v > 0 ? v : DEMO_DEFAULT_AMOUNT;
}

/** Toggle: when not explicitly enabled, new signups start with $0 balance.
 *  Production default: OFF (admin can flip on via system_settings if needed). */
export async function isAutoDemoSignupEnabled(): Promise<boolean> {
  const rows = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "auto_demo_signup")).limit(1);
  const v = (rows[0]?.value ?? "false").toLowerCase();
  return v === "true" || v === "1" || v === "on";
}

/**
 * Credit a user with demo funds: deposit + 30% allocated to trading + active investment row + ledger entries.
 * Idempotent guard: skips if a "[DEMO] Welcome funds" deposit already exists for the user.
 */
export async function seedDemoFunds(userId: number, amount?: number): Promise<{ credited: boolean; amount: number }> {
  const amt = amount ?? (await getDemoSignupAmount());

  const existing = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId));
  if (existing.some(t => (t.description ?? "").startsWith("[DEMO] Welcome"))) {
    return { credited: false, amount: 0 };
  }

  await ensureUserAccounts(userId);

  let wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  if (wallets.length === 0) {
    await db.insert(walletsTable).values({ userId });
    wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  }

  const [txn] = await db.insert(transactionsTable).values({
    userId,
    type: "deposit",
    amount: amt.toString(),
    status: "completed",
    description: `[DEMO] Welcome funds $${amt.toFixed(2)}`,
  }).returning();

  const tradingAlloc = +(amt * 0.3).toFixed(2);
  const mainRemainder = +(amt - tradingAlloc).toFixed(2);

  await db.update(walletsTable).set({
    mainBalance: mainRemainder.toString(),
    tradingBalance: tradingAlloc.toString(),
    profitBalance: "0",
    updatedAt: new Date(),
  }).where(eq(walletsTable.userId, userId));

  await postJournalEntry(
    journalForTransaction(txn!.id),
    [
      { accountCode: "platform:usdt_pool", entryType: "debit", amount: amt, description: "Demo welcome deposit" },
      { accountCode: `user:${userId}:main`, entryType: "credit", amount: amt, description: "Demo welcome deposit" },
    ],
    txn!.id,
  );

  await postJournalEntry(
    journalForSystem(`demo-alloc-${userId}`),
    [
      { accountCode: `user:${userId}:main`,    entryType: "debit",  amount: tradingAlloc, description: "Demo: allocate to trading" },
      { accountCode: `user:${userId}:trading`, entryType: "credit", amount: tradingAlloc, description: "Demo: allocate to trading" },
    ],
  );

  const invs = await db.select().from(investmentsTable).where(eq(investmentsTable.userId, userId)).limit(1);
  if (invs.length === 0) {
    await db.insert(investmentsTable).values({
      userId,
      amount: tradingAlloc.toString(),
      riskLevel: "medium",
      isActive: true,
      startedAt: new Date(),
      drawdownLimit: "5",
    });
  } else {
    await db.update(investmentsTable).set({
      amount: tradingAlloc.toString(),
      riskLevel: invs[0]!.riskLevel || "medium",
      isActive: true,
      startedAt: invs[0]!.startedAt ?? new Date(),
      drawdownLimit: invs[0]!.drawdownLimit ?? "5",
    }).where(eq(investmentsTable.userId, userId));
  }

  // Backfill 30-day equity history so Advanced Analytics charts render a real curve
  try {
    await backfillEquityHistory(userId, amt);
  } catch (e) {
    logger.error(`[DEMO] Equity backfill failed for user ${userId}: ${(e as Error).message}`);
  }

  logger.info(`[DEMO] Credited user #${userId} with $${amt} (main=${mainRemainder}, trading=${tradingAlloc})`);
  return { credited: true, amount: amt };
}

/**
 * Seed 30 days of realistic equity progression ending at the current equity.
 * Skip if rows already exist (idempotent). Uses SQL generate_series for efficiency.
 */
export async function backfillEquityHistory(userId: number, currentEquity: number): Promise<void> {
  const existing = await db.select().from(equityHistoryTable).where(eq(equityHistoryTable.userId, userId)).limit(1);
  if (existing.length > 0) return;

  // 30 days of sinusoidal growth ending at current equity (today's row is separate)
  await db.execute(sql`
    INSERT INTO equity_history (user_id, date, equity, profit)
    SELECT
      ${userId}::int,
      (CURRENT_DATE - (29 - gs.n) * INTERVAL '1 day')::date,
      ROUND((
        ${currentEquity}::numeric * 0.80
        + ${currentEquity}::numeric * 0.20 * (gs.n / 29.0)
        + ${currentEquity}::numeric * 0.01 * SIN(gs.n * 0.7 + ${userId}::int * 0.3)
      )::numeric, 8),
      ROUND((
        ${currentEquity}::numeric * 0.007
        + ${currentEquity}::numeric * 0.005 * SIN(gs.n * 0.7 + ${userId}::int * 0.3)
      )::numeric, 8)
    FROM generate_series(0, 28) AS gs(n)
    ON CONFLICT DO NOTHING
  `);

  // Today's row = actual current equity
  await db.insert(equityHistoryTable).values({
    userId,
    date: new Date().toISOString().split("T")[0]!,
    equity: currentEquity.toString(),
    profit: "0",
  }).onConflictDoNothing();

  // Monthly performance starter row
  const ym = new Date().toISOString().slice(0, 7);
  const startEq = +(currentEquity * 0.80).toFixed(2);
  const monthlyReturn = startEq > 0 ? +(((currentEquity - startEq) / startEq) * 100).toFixed(4) : 0;
  await db.insert(monthlyPerformanceTable).values({
    userId,
    yearMonth: ym,
    monthlyReturn: monthlyReturn.toString(),
    maxDrawdown: "0",
    winRate: "100",
    totalProfit: (currentEquity - startEq).toFixed(2),
    tradingDays: 30,
    winningDays: 20,
    startEquity: startEq.toString(),
    peakEquity: currentEquity.toString(),
  }).onConflictDoNothing();
}
