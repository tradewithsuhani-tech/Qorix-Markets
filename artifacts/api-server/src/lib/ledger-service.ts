import { db, glAccountsTable, ledgerEntriesTable, walletsTable } from "@workspace/db";
import { eq, sql, inArray, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Chart of accounts — platform-level system accounts
// ---------------------------------------------------------------------------
export const SYSTEM_ACCOUNTS = [
  {
    code: "platform:usdt_pool",
    name: "Platform USDT Pool",
    accountType: "asset",
    normalBalance: "debit",
  },
  {
    code: "platform:fee_revenue",
    name: "Platform Fee Revenue",
    accountType: "revenue",
    normalBalance: "credit",
  },
  {
    code: "platform:profit_expense",
    name: "Daily Profit Distributed",
    accountType: "expense",
    normalBalance: "debit",
  },
  {
    code: "platform:referral_expense",
    name: "Referral Bonuses Paid",
    accountType: "expense",
    normalBalance: "debit",
  },
] as const;

// Per-user account definitions (suffix → metadata)
const USER_ACCOUNT_DEFS = [
  { suffix: "main",    name: "Main Wallet",    accountType: "liability", normalBalance: "credit" },
  { suffix: "trading", name: "Trading Wallet", accountType: "liability", normalBalance: "credit" },
  { suffix: "profit",  name: "Profit Wallet",  accountType: "liability", normalBalance: "credit" },
] as const;

export type JournalLine = {
  accountCode: string;
  entryType: "debit" | "credit";
  amount: number;
  description?: string;
};

// ---------------------------------------------------------------------------
// Internal: resolve or create a GL account by code, returning its id
// ---------------------------------------------------------------------------
async function getOrCreateAccount(
  code: string,
  name: string,
  accountType: string,
  normalBalance: string,
  userId?: number,
  isSystem = false,
  txn?: any,
): Promise<number> {
  const db_ = txn ?? db;
  const existing = await db_
    .select({ id: glAccountsTable.id })
    .from(glAccountsTable)
    .where(eq(glAccountsTable.code, code))
    .limit(1);
  if (existing.length > 0) return existing[0]!.id;

  const [created] = await db_
    .insert(glAccountsTable)
    .values({ code, name, accountType, normalBalance, userId, isSystem })
    .onConflictDoNothing()
    .returning({ id: glAccountsTable.id });

  if (created) return created.id;

  // Race condition: another request created it first — fetch it
  const fallback = await db_
    .select({ id: glAccountsTable.id })
    .from(glAccountsTable)
    .where(eq(glAccountsTable.code, code))
    .limit(1);
  return fallback[0]!.id;
}

// ---------------------------------------------------------------------------
// Seed system accounts at application startup
// ---------------------------------------------------------------------------
export async function initSystemAccounts(): Promise<void> {
  for (const acc of SYSTEM_ACCOUNTS) {
    await db
      .insert(glAccountsTable)
      .values({ ...acc, isSystem: true })
      .onConflictDoNothing();
  }
  logger.info("Ledger: system GL accounts seeded");
}

// ---------------------------------------------------------------------------
// Ensure a user's three GL accounts exist (lazy creation)
// ---------------------------------------------------------------------------
export async function ensureUserAccounts(userId: number, txn?: any): Promise<void> {
  const db_ = txn ?? db;
  const codes = USER_ACCOUNT_DEFS.map((d) => `user:${userId}:${d.suffix}`);
  const existing = await db_
    .select({ code: glAccountsTable.code })
    .from(glAccountsTable)
    .where(inArray(glAccountsTable.code, codes));
  const existingCodes = new Set(existing.map((r) => r.code));

  for (const def of USER_ACCOUNT_DEFS) {
    const code = `user:${userId}:${def.suffix}`;
    if (!existingCodes.has(code)) {
      await db_
        .insert(glAccountsTable)
        .values({
          code,
          name: `User ${userId} ${def.name}`,
          accountType: def.accountType,
          normalBalance: def.normalBalance,
          userId,
          isSystem: false,
        })
        .onConflictDoNothing();
    }
  }
}

// ---------------------------------------------------------------------------
// Post a balanced journal entry
// journalId should be unique per event. Use genJournalId() helpers below.
// ---------------------------------------------------------------------------
export async function postJournalEntry(
  journalId: string,
  lines: JournalLine[],
  transactionId: number | null = null,
  txn?: any,
): Promise<void> {
  if (lines.length < 2) {
    throw new Error(`Journal ${journalId}: must have at least 2 lines`);
  }

  const totalDebits = lines
    .filter((l) => l.entryType === "debit")
    .reduce((s, l) => s + l.amount, 0);
  const totalCredits = lines
    .filter((l) => l.entryType === "credit")
    .reduce((s, l) => s + l.amount, 0);

  const diff = Math.abs(totalDebits - totalCredits);
  if (diff > 0.000001) {
    throw new Error(
      `Journal ${journalId}: debits (${totalDebits}) ≠ credits (${totalCredits})`,
    );
  }

  const db_ = txn ?? db;

  // Resolve account IDs for all lines
  const accountMap = new Map<string, number>();
  for (const line of lines) {
    if (accountMap.has(line.accountCode)) continue;
    const existing = await db_
      .select({ id: glAccountsTable.id })
      .from(glAccountsTable)
      .where(eq(glAccountsTable.code, line.accountCode))
      .limit(1);
    if (existing.length === 0) {
      throw new Error(`Journal ${journalId}: unknown account code "${line.accountCode}"`);
    }
    accountMap.set(line.accountCode, existing[0]!.id);
  }

  const entries = lines.map((line) => ({
    journalId,
    transactionId: transactionId ?? undefined,
    accountId: accountMap.get(line.accountCode)!,
    accountCode: line.accountCode,
    entryType: line.entryType,
    amount: line.amount.toFixed(8),
    description: line.description,
  }));

  await db_.insert(ledgerEntriesTable).values(entries);
}

// ---------------------------------------------------------------------------
// Journal ID helpers
// ---------------------------------------------------------------------------
export function journalForTransaction(txnId: number): string {
  return `txn:${txnId}`;
}

export function journalForSystem(prefix: string): string {
  return `sys:${prefix}:${randomUUID().slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Get running balance for an account (debits - credits for debit-normal,
// credits - debits for credit-normal)
// ---------------------------------------------------------------------------
export async function getLedgerBalance(accountCode: string): Promise<number> {
  const rows = await db
    .select({
      entryType: ledgerEntriesTable.entryType,
      total: sql<string>`sum(${ledgerEntriesTable.amount})`,
    })
    .from(ledgerEntriesTable)
    .where(eq(ledgerEntriesTable.accountCode, accountCode))
    .groupBy(ledgerEntriesTable.entryType);

  let debits = 0;
  let credits = 0;
  for (const r of rows) {
    if (r.entryType === "debit") debits = parseFloat(r.total ?? "0");
    else credits = parseFloat(r.total ?? "0");
  }

  // Determine normal balance from gl_accounts
  const acct = await db
    .select({ normalBalance: glAccountsTable.normalBalance })
    .from(glAccountsTable)
    .where(eq(glAccountsTable.code, accountCode))
    .limit(1);
  const normalBalance = acct[0]?.normalBalance ?? "debit";

  return normalBalance === "debit" ? debits - credits : credits - debits;
}

// ---------------------------------------------------------------------------
// Full reconciliation check
// ---------------------------------------------------------------------------
export interface ReconciliationResult {
  passed: boolean;
  summary: {
    totalEntries: number;
    totalJournals: number;
    globalDebits: number;
    globalCredits: number;
    globalBalanced: boolean;
  };
  unbalancedJournals: Array<{
    journalId: string;
    debits: number;
    credits: number;
    diff: number;
  }>;
  walletDiscrepancies: Array<{
    userId: number;
    wallet: string;
    walletBalance: number;
    ledgerBalance: number;
    diff: number;
  }>;
  accountBalances: Array<{
    code: string;
    name: string;
    accountType: string;
    normalBalance: string;
    balance: number;
  }>;
}

export async function runReconciliation(): Promise<ReconciliationResult> {
  // 1. Global debit vs credit totals
  const globalRows = await db
    .select({
      entryType: ledgerEntriesTable.entryType,
      total: sql<string>`sum(${ledgerEntriesTable.amount})`,
    })
    .from(ledgerEntriesTable)
    .groupBy(ledgerEntriesTable.entryType);

  let globalDebits = 0;
  let globalCredits = 0;
  for (const r of globalRows) {
    if (r.entryType === "debit") globalDebits = parseFloat(r.total ?? "0");
    else globalCredits = parseFloat(r.total ?? "0");
  }
  const globalBalanced = Math.abs(globalDebits - globalCredits) < 0.01;

  // 2. Per-journal balance check
  const journalRows = await db
    .select({
      journalId: ledgerEntriesTable.journalId,
      entryType: ledgerEntriesTable.entryType,
      total: sql<string>`sum(${ledgerEntriesTable.amount})`,
      cnt: sql<string>`count(*)`,
    })
    .from(ledgerEntriesTable)
    .groupBy(ledgerEntriesTable.journalId, ledgerEntriesTable.entryType);

  const journalMap = new Map<string, { debits: number; credits: number }>();
  for (const r of journalRows) {
    if (!journalMap.has(r.journalId)) journalMap.set(r.journalId, { debits: 0, credits: 0 });
    const j = journalMap.get(r.journalId)!;
    if (r.entryType === "debit") j.debits += parseFloat(r.total ?? "0");
    else j.credits += parseFloat(r.total ?? "0");
  }

  const unbalancedJournals: ReconciliationResult["unbalancedJournals"] = [];
  for (const [journalId, { debits, credits }] of journalMap.entries()) {
    const diff = Math.abs(debits - credits);
    if (diff > 0.01) {
      unbalancedJournals.push({ journalId, debits, credits, diff });
    }
  }

  // 3. Wallet vs ledger discrepancies
  const walletDiscrepancies: ReconciliationResult["walletDiscrepancies"] = [];
  const wallets = await db.select().from(walletsTable);

  for (const w of wallets) {
    const uid = w.userId;
    const checks = [
      { wallet: "main", balance: parseFloat(w.mainBalance as string), code: `user:${uid}:main` },
      { wallet: "trading", balance: parseFloat(w.tradingBalance as string), code: `user:${uid}:trading` },
      { wallet: "profit", balance: parseFloat(w.profitBalance as string), code: `user:${uid}:profit` },
    ];

    for (const c of checks) {
      const acctRows = await db
        .select({ id: glAccountsTable.id })
        .from(glAccountsTable)
        .where(eq(glAccountsTable.code, c.code))
        .limit(1);

      if (acctRows.length === 0) continue; // account not created yet — skip

      const ledgerBal = await getLedgerBalance(c.code);
      const diff = Math.abs(c.balance - ledgerBal);
      if (diff > 0.01) {
        walletDiscrepancies.push({
          userId: uid,
          wallet: c.wallet,
          walletBalance: c.balance,
          ledgerBalance: ledgerBal,
          diff,
        });
      }
    }
  }

  // 4. Account balances
  const allAccounts = await db.select().from(glAccountsTable);
  const accountBalances: ReconciliationResult["accountBalances"] = [];
  for (const acc of allAccounts) {
    const balance = await getLedgerBalance(acc.code);
    accountBalances.push({
      code: acc.code,
      name: acc.name,
      accountType: acc.accountType,
      normalBalance: acc.normalBalance,
      balance,
    });
  }

  const totalEntries = globalRows.reduce((s, r) => s + Number(r.cnt ?? 0), 0);

  const passed =
    globalBalanced &&
    unbalancedJournals.length === 0 &&
    walletDiscrepancies.length === 0;

  return {
    passed,
    summary: {
      totalEntries,
      totalJournals: journalMap.size,
      globalDebits,
      globalCredits,
      globalBalanced,
    },
    unbalancedJournals,
    walletDiscrepancies,
    accountBalances,
  };
}
