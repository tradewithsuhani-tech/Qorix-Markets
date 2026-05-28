import { db, investmentsTable, walletsTable, systemSettingsTable } from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";

export type FundingSourceWallet = "inr" | "usdt";

const INR_RATE_KEY = "inr_to_usdt_rate";
const DEFAULT_INR_RATE = 99;

export async function getInrToUsdtRate(): Promise<number> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, INR_RATE_KEY))
    .limit(1);
  const raw = rows[0]?.value ?? DEFAULT_INR_RATE.toString();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_INR_RATE;
}

/** Return wallet for funding → wallet moves after stop (defaults INR for legacy rows). */
export async function getPreferredReturnTarget(userId: number): Promise<"main" | "usdt"> {
  const [inv] = await db
    .select({ fundingSourceWallet: investmentsTable.fundingSourceWallet })
    .from(investmentsTable)
    .where(eq(investmentsTable.userId, userId))
    .limit(1);
  return inv?.fundingSourceWallet === "usdt" ? "usdt" : "main";
}

/**
 * Move USDT-equivalent capital from INR or USDT wallet into tradingBalance.
 * Used at investment start/top-up so deployed capital is tied to a source wallet.
 */
export async function fundTradingFromSourceWallet(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: number,
  sourceWallet: FundingSourceWallet,
  amountUsdt: number,
  fxRate: number,
): Promise<void> {
  const amountStr = amountUsdt.toFixed(8);
  if (sourceWallet === "usdt") {
    const updated = await tx
      .update(walletsTable)
      .set({
        usdtBalance: sql`${walletsTable.usdtBalance} - ${amountStr}::numeric`,
        tradingBalance: sql`${walletsTable.tradingBalance} + ${amountStr}::numeric`,
        updatedAt: new Date(),
      })
      .where(and(eq(walletsTable.userId, userId), gte(walletsTable.usdtBalance, amountStr)))
      .returning();
    if (updated.length === 0) throw new Error("INSUFFICIENT_USDT_WALLET");
    return;
  }

  const inrStr = (amountUsdt * fxRate).toFixed(8);
  const updated = await tx
    .update(walletsTable)
    .set({
      mainBalance: sql`${walletsTable.mainBalance} - ${inrStr}::numeric`,
      tradingBalance: sql`${walletsTable.tradingBalance} + ${amountStr}::numeric`,
      updatedAt: new Date(),
    })
    .where(and(eq(walletsTable.userId, userId), gte(walletsTable.mainBalance, inrStr)))
    .returning();
  if (updated.length === 0) throw new Error("INSUFFICIENT_INR_WALLET");
}
