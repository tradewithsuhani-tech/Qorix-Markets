import { db, walletsTable, transactionsTable } from "@workspace/db";
import { depositAddressesTable, blockchainDepositsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { logger, errorLogger } from "./logger";
import { createNotification } from "./notifications";
import { emitDepositEvent } from "./event-bus";
import { ensureUserAccounts, postJournalEntry, journalForTransaction } from "./ledger-service";

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_BASE = "https://api.trongrid.io";
const TRONGRID_API_KEY = process.env["TRONGRID_API_KEY"] ?? "";
const MIN_AMOUNT_USDT = 1;
const POLL_INTERVAL_MS = 15_000;

function tronHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (TRONGRID_API_KEY) h["TRON-PRO-API-KEY"] = TRONGRID_API_KEY;
  return h;
}

interface TRC20Transfer {
  transaction_id: string;
  token_info: { symbol: string; address: string; decimals: number };
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: string;
}

async function fetchTRC20Transfers(address: string): Promise<TRC20Transfer[]> {
  const url = `${TRONGRID_BASE}/v1/accounts/${address}/transactions/trc20?contract_address=${USDT_CONTRACT}&limit=20&only_to=true`;
  const res = await fetch(url, { headers: tronHeaders() });
  if (!res.ok) {
    throw new Error(`TronGrid error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: TRC20Transfer[] };
  return json.data ?? [];
}

async function creditUserDeposit(
  userId: number,
  amount: number,
  txHash: string,
  depositId: number,
): Promise<void> {
  const wallets = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId)).limit(1);
  const wallet = wallets[0];
  if (!wallet) {
    errorLogger.error({ userId }, "Wallet not found for blockchain deposit credit");
    return;
  }

  const newMain = parseFloat(wallet.mainBalance as string) + amount;

  await db.transaction(async (tx) => {
    await ensureUserAccounts(userId, tx);

    await tx
      .update(walletsTable)
      .set({ mainBalance: newMain.toString(), updatedAt: new Date() })
      .where(eq(walletsTable.userId, userId));

    const [txn] = await tx
      .insert(transactionsTable)
      .values({
        userId,
        type: "deposit",
        amount: amount.toString(),
        status: "completed",
        description: `Blockchain USDT deposit (TRC20) — tx: ${txHash.slice(0, 16)}…`,
      })
      .returning();

    await postJournalEntry(
      journalForTransaction(txn!.id),
      [
        {
          accountCode: "platform:usdt_pool",
          entryType: "debit",
          amount,
          description: `Blockchain deposit received from user ${userId}`,
        },
        {
          accountCode: `user:${userId}:main`,
          entryType: "credit",
          amount,
          description: `Blockchain deposit credited to main wallet`,
        },
      ],
      txn!.id,
      tx,
    );

    await tx
      .update(blockchainDepositsTable)
      .set({ status: "confirmed", credited: true, creditedAt: new Date() })
      .where(eq(blockchainDepositsTable.id, depositId));
  });

  await createNotification(
    userId,
    "deposit",
    "USDT Deposit Confirmed",
    `$${amount.toFixed(2)} USDT (TRC20) has been credited to your main balance.`,
  );

  await emitDepositEvent({ userId, amount, newMainBalance: newMain }).catch((err) => {
    errorLogger.error({ err, userId, amount }, "Failed to emit deposit event after blockchain credit");
  });

  logger.info({ userId, amount, txHash }, "Blockchain USDT deposit credited");
}

async function pollAddress(userId: number, address: string): Promise<void> {
  const transfers = await fetchTRC20Transfers(address);

  for (const t of transfers) {
    if (t.type !== "Transfer") continue;
    if (t.token_info.address !== USDT_CONTRACT) continue;

    const decimals = t.token_info.decimals ?? 6;
    const amount = parseFloat(t.value) / Math.pow(10, decimals);
    if (amount < MIN_AMOUNT_USDT) continue;

    const txHash = t.transaction_id;

    const existing = await db
      .select({ id: blockchainDepositsTable.id, credited: blockchainDepositsTable.credited })
      .from(blockchainDepositsTable)
      .where(eq(blockchainDepositsTable.txHash, txHash))
      .limit(1);

    if (existing.length > 0) {
      if (!existing[0]!.credited) {
        await creditUserDeposit(userId, amount, txHash, existing[0]!.id);
      }
      continue;
    }

    const [inserted] = await db
      .insert(blockchainDepositsTable)
      .values({
        userId,
        txHash,
        fromAddress: t.from,
        toAddress: t.to,
        amount: amount.toString(),
        status: "pending",
        credited: false,
        blockTimestamp: new Date(t.block_timestamp),
      })
      .returning({ id: blockchainDepositsTable.id });

    logger.info({ userId, txHash, amount, from: t.from }, "New blockchain USDT deposit detected");

    await creditUserDeposit(userId, amount, txHash, inserted!.id);
  }
}

let monitorTimer: ReturnType<typeof setTimeout> | null = null;

async function runPollCycle(): Promise<void> {
  try {
    const addresses = await db
      .select({ userId: depositAddressesTable.userId, address: depositAddressesTable.trc20Address })
      .from(depositAddressesTable);

    for (const { userId, address } of addresses) {
      await pollAddress(userId, address).catch((err) =>
        errorLogger.error({ err, userId, address }, "Error polling address"),
      );
    }
  } catch (err) {
    errorLogger.error({ err }, "Error in TronGrid poll cycle");
  } finally {
    monitorTimer = setTimeout(runPollCycle, POLL_INTERVAL_MS);
  }
}

export function startTronMonitor(): { stop: () => void } {
  logger.info({ interval: POLL_INTERVAL_MS }, "TronGrid USDT monitor started");
  monitorTimer = setTimeout(runPollCycle, 5_000);
  return {
    stop: () => {
      if (monitorTimer) {
        clearTimeout(monitorTimer);
        monitorTimer = null;
      }
    },
  };
}
