import {
  db,
  walletsTable,
  transactionsTable,
  inrDepositsTable,
  inrWithdrawalsTable,
  blockchainDepositsTable,
} from "@workspace/db";
import { and, eq, sql, inArray } from "drizzle-orm";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Channel-cap accounting for the "withdraw via the same channel you deposited
 * from" anti-fraud rule.
 *
 * Returns USDT-denominated totals for each source/sink so callers can compute:
 *
 *   inrChannelOwed   = max(0, inrDepositedUsdt   - inrWithdrawnUsdt)
 *   usdtChannelOwed  = max(0, usdtDepositedUsdt  - usdtWithdrawnUsdt)
 *
 * Then for a new withdrawal of X USDT:
 *   - USDT channel: requires (totalBalance - X) >= inrChannelOwed
 *   - INR channel:  requires (totalBalance - X) >= usdtChannelOwed
 *
 * Status filters intentionally include `pending` for withdrawals (so a user
 * cannot stack multiple pending withdrawals to bypass the cap) and `approved`
 * for deposits (only credited deposits count toward the cap).
 */
export async function getWithdrawalCaps(userId: number, executor: DbExecutor = db) {
  const [
    [w],
    [inrDep],
    [usdtDep],
    [inrWdr],
    [usdtWdr],
  ] = await Promise.all([
    executor
      .select({
        mainBalance: walletsTable.mainBalance,
        profitBalance: walletsTable.profitBalance,
      })
      .from(walletsTable)
      .where(eq(walletsTable.userId, userId))
      .limit(1),
    executor
      .select({ total: sql<string>`COALESCE(SUM(${inrDepositsTable.amountUsdt}), 0)` })
      .from(inrDepositsTable)
      .where(and(eq(inrDepositsTable.userId, userId), eq(inrDepositsTable.status, "approved"))),
    executor
      .select({ total: sql<string>`COALESCE(SUM(${blockchainDepositsTable.amount}), 0)` })
      .from(blockchainDepositsTable)
      .where(and(eq(blockchainDepositsTable.userId, userId), eq(blockchainDepositsTable.credited, true))),
    executor
      .select({ total: sql<string>`COALESCE(SUM(${inrWithdrawalsTable.amountUsdt}), 0)` })
      .from(inrWithdrawalsTable)
      .where(
        and(
          eq(inrWithdrawalsTable.userId, userId),
          inArray(inrWithdrawalsTable.status, ["pending", "approved"]),
        ),
      ),
    executor
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "withdrawal"),
          inArray(transactionsTable.status, ["pending", "completed"]),
        ),
      ),
  ]);

  const mainBalance = w ? parseFloat(w.mainBalance as string) : 0;
  const profitBalance = w ? parseFloat(w.profitBalance as string) : 0;
  const totalBalance = +(mainBalance + profitBalance).toFixed(6);

  const inrDepositedUsdt = parseFloat((inrDep?.total as string) ?? "0");
  const usdtDepositedUsdt = parseFloat((usdtDep?.total as string) ?? "0");
  const inrWithdrawnUsdt = parseFloat((inrWdr?.total as string) ?? "0");
  const usdtWithdrawnUsdt = parseFloat((usdtWdr?.total as string) ?? "0");

  const inrChannelOwed = Math.max(0, +(inrDepositedUsdt - inrWithdrawnUsdt).toFixed(6));
  const usdtChannelOwed = Math.max(0, +(usdtDepositedUsdt - usdtWithdrawnUsdt).toFixed(6));

  // Maximum that can leave each channel without breaking the other channel's lock.
  const usdtChannelMax = Math.max(0, +(totalBalance - inrChannelOwed).toFixed(6));
  const inrChannelMax = Math.max(0, +(totalBalance - usdtChannelOwed).toFixed(6));

  return {
    mainBalance,
    profitBalance,
    totalBalance,
    inrDepositedUsdt,
    usdtDepositedUsdt,
    inrWithdrawnUsdt,
    usdtWithdrawnUsdt,
    inrChannelOwed,
    usdtChannelOwed,
    usdtChannelMax,
    inrChannelMax,
  };
}

export type WithdrawalCaps = Awaited<ReturnType<typeof getWithdrawalCaps>>;
