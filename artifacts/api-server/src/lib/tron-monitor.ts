import { db, walletsTable, transactionsTable, usersTable, systemSettingsTable } from "@workspace/db";
import { blockchainDepositsTable, promoRedemptionsTable } from "@workspace/db/schema";
import { eq, isNotNull, or, isNull, sql } from "drizzle-orm";
import { logger, errorLogger } from "./logger";
import { createNotification } from "./notifications";
import { emitDepositEvent } from "./event-bus";
import { ensureUserAccounts, postJournalEntry, journalForTransaction } from "./ledger-service";
import { getAllDepositAddresses, decryptDepositPrivateKey } from "./deposit-address-service";
import { runSweepPipeline, sweepLeftoverTrxFrom } from "./crypto-deposit/sweep";

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_BASE = "https://api.trongrid.io";
const TRONGRID_API_KEY = process.env["TRONGRID_API_KEY"] ?? "";
const PLATFORM_TRON_ADDRESS = process.env["PLATFORM_TRON_ADDRESS"] ?? "";
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

    // --- 5% promo-code bonus (one-per-user, credited on first qualifying deposit) ---
    const promoRows = await tx
      .select()
      .from(promoRedemptionsTable)
      .where(eq(promoRedemptionsTable.userId, userId))
      .limit(1);
    const promo = promoRows[0];
    if (promo && promo.status === "redeemed") {
      const bonusPct = Number(promo.bonusPercent ?? 5);
      const bonus = +(amount * (bonusPct / 100)).toFixed(8);
      if (bonus > 0) {
        // Bonus goes to TRADING balance (non-withdrawable; only usable for trading
        // and realized as profit, which IS withdrawable). Atomic SQL increment.
        await tx
          .update(walletsTable)
          .set({
            tradingBalance: sql`${walletsTable.tradingBalance} + ${bonus.toString()}`,
            updatedAt: new Date(),
          })
          .where(eq(walletsTable.userId, userId));

        const [bonusTxn] = await tx
          .insert(transactionsTable)
          .values({
            userId,
            type: "bonus",
            amount: bonus.toString(),
            status: "completed",
            description: `Promo ${promo.code} — ${bonusPct}% trading bonus (non-withdrawable)`,
          })
          .returning();

        await postJournalEntry(
          journalForTransaction(bonusTxn!.id),
          [
            {
              accountCode: "platform:usdt_pool",
              entryType: "debit",
              amount: bonus,
              description: `Promo ${promo.code} bonus funded from platform pool`,
            },
            {
              accountCode: `user:${userId}:trading`,
              entryType: "credit",
              amount: bonus,
              description: `Promo ${promo.code} ${bonusPct}% trading bonus (non-withdrawable)`,
            },
          ],
          bonusTxn!.id,
          tx,
        );

        await tx
          .update(promoRedemptionsTable)
          .set({
            status: "credited",
            creditedAt: new Date(),
            depositId,
            bonusAmount: bonus.toString(),
          })
          .where(eq(promoRedemptionsTable.userId, userId));

        logger.info({ userId, code: promo.code, bonus, depositId }, "Promo bonus credited");
      }
    }
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

async function pollPlatformAddress(): Promise<void> {
  if (!PLATFORM_TRON_ADDRESS) {
    errorLogger.warn("PLATFORM_TRON_ADDRESS not set — skipping TronGrid poll");
    return;
  }

  const transfers = await fetchTRC20Transfers(PLATFORM_TRON_ADDRESS);

  // Load all users who have registered a TronLink address
  const usersWithTron = await db
    .select({ id: usersTable.id, tronAddress: usersTable.tronAddress })
    .from(usersTable)
    .where(isNotNull(usersTable.tronAddress));

  // Build a map: senderAddress (lowercase) → userId
  const senderMap = new Map<string, number>();
  for (const u of usersWithTron) {
    if (u.tronAddress) {
      senderMap.set(u.tronAddress.toLowerCase(), u.id);
    }
  }

  for (const t of transfers) {
    if (t.type !== "Transfer") continue;
    if (t.token_info.address !== USDT_CONTRACT) continue;

    const decimals = t.token_info.decimals ?? 6;
    const amount = parseFloat(t.value) / Math.pow(10, decimals);
    if (amount < MIN_AMOUNT_USDT) continue;

    const txHash = t.transaction_id;

    // Check if already processed
    const existing = await db
      .select({ id: blockchainDepositsTable.id, credited: blockchainDepositsTable.credited })
      .from(blockchainDepositsTable)
      .where(eq(blockchainDepositsTable.txHash, txHash))
      .limit(1);

    if (existing.length > 0) {
      if (!existing[0]!.credited) {
        const rec = existing[0]!;
        const dep = await db.select().from(blockchainDepositsTable).where(eq(blockchainDepositsTable.id, rec.id)).limit(1);
        if (dep[0]?.userId) {
          await creditUserDeposit(dep[0].userId, amount, txHash, rec.id);
        }
      }
      continue;
    }

    // Match sender to a registered user
    const userId = senderMap.get(t.from.toLowerCase()) ?? null;

    const [inserted] = await db
      .insert(blockchainDepositsTable)
      .values({
        userId: userId ?? 0,
        txHash,
        fromAddress: t.from,
        toAddress: t.to,
        amount: amount.toString(),
        status: userId ? "pending" : "unmatched",
        credited: false,
        blockTimestamp: new Date(t.block_timestamp),
      })
      .returning({ id: blockchainDepositsTable.id });

    if (userId) {
      logger.info({ userId, txHash, amount, from: t.from }, "New USDT deposit detected — auto-crediting matched user");
      await creditUserDeposit(userId, amount, txHash, inserted!.id);
    } else {
      logger.warn({ txHash, amount, from: t.from }, "New USDT deposit detected — no matching user (needs admin review)");
    }
  }
}

// ---------------------------------------------------------------------------
// Per-user deposit address polling. Each user has a unique TRC20 address
// stored in `deposit_addresses`. We iterate every address and credit any new
// inbound USDT transfer to the owning user.
// ---------------------------------------------------------------------------
async function pollUserDepositAddresses(): Promise<void> {
  const records = await getAllDepositAddresses();
  if (records.length === 0) return;

  for (const rec of records) {
    let transfers: TRC20Transfer[];
    try {
      transfers = await fetchTRC20Transfers(rec.address);
    } catch (err) {
      errorLogger.warn({ err: (err as Error).message, address: rec.address }, "TronGrid fetch failed for user deposit address");
      continue;
    }

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
          await creditUserDeposit(rec.userId, amount, txHash, existing[0]!.id);
          triggerSweep(rec.address, rec.privateKeyEnc, amount);
        }
        continue;
      }

      const [inserted] = await db
        .insert(blockchainDepositsTable)
        .values({
          userId: rec.userId,
          txHash,
          fromAddress: t.from,
          toAddress: t.to,
          amount: amount.toString(),
          status: "pending",
          credited: false,
          blockTimestamp: new Date(t.block_timestamp),
        })
        .returning({ id: blockchainDepositsTable.id });

      logger.info(
        { userId: rec.userId, txHash, amount, from: t.from, depositAddress: rec.address },
        "New USDT deposit detected on per-user address — auto-crediting",
      );
      await creditUserDeposit(rec.userId, amount, txHash, inserted!.id);
      triggerSweep(rec.address, rec.privateKeyEnc, amount);
    }
  }
}

function triggerSweep(address: string, encryptedPrivateKey: string, amount: number, depositId?: number): void {
  try {
    const privateKey = decryptDepositPrivateKey(encryptedPrivateKey);
    (async () => {
      try {
        const sweepTxId = await runSweepPipeline(address, privateKey, amount);
        if (depositId && sweepTxId) {
          await db
            .update(blockchainDepositsTable)
            .set({ swept: true, sweptAt: new Date(), sweepTxHash: sweepTxId })
            .where(eq(blockchainDepositsTable.id, depositId));
        }
        logger.info({ address, amount, depositId, sweepTxId }, "Sweep pipeline completed");
      } catch (err) {
        errorLogger.error({ err, address, amount, depositId }, "Sweep pipeline failed - leaving swept=false for retry");
      }
    })();
    logger.info({ address, amount }, "Sweep pipeline triggered for deposit address");
  } catch (err) {
    errorLogger.error({ err, address }, "Failed to trigger sweep pipeline");
  }
}

async function getOnchainUsdtBalance(address: string): Promise<number> {
  try {
    const url = `${TRONGRID_BASE}/v1/accounts/${address}`;
    const r = await fetch(url, { headers: tronHeaders() });
    if (!r.ok) return 0;
    const j: any = await r.json();
    const acc = j?.data?.[0];
    if (!acc) return 0;
    const tokens = acc.trc20 ?? [];
    for (const t of tokens) {
      const bal = t[USDT_CONTRACT];
      if (bal != null) return Number(BigInt(bal)) / 1_000_000;
    }
    return 0;
  } catch {
    return 0;
  }
}

async function retryStuckSweeps(): Promise<void> {
  // Pick recent deposits — verify on-chain whether USDT still sits at user address.
  const recent = await db
    .select({
      id: blockchainDepositsTable.id,
      toAddress: blockchainDepositsTable.toAddress,
      amount: blockchainDepositsTable.amount,
      swept: blockchainDepositsTable.swept,
      sweepTxHash: blockchainDepositsTable.sweepTxHash,
    })
    .from(blockchainDepositsTable)
    .orderBy(sql`${blockchainDepositsTable.createdAt} DESC`)
    .limit(50);

  if (recent.length === 0) return;

  const addrs = await getAllDepositAddresses();
  const addrMap = new Map(addrs.map((a) => [a.address, a.privateKeyEnc]));

  for (const d of recent) {
    const enc = addrMap.get(d.toAddress);
    if (!enc) continue;
    const amt = parseFloat(d.amount as unknown as string);
    if (amt < 1) continue;

    const onchainBal = await getOnchainUsdtBalance(d.toAddress);
    if (onchainBal < 1) continue; // already swept on-chain

    if (d.swept && d.sweepTxHash) {
      // Marked swept but funds still on user address -> previous tx failed (e.g., OUT_OF_ENERGY)
      await db
        .update(blockchainDepositsTable)
        .set({ swept: false, sweepTxHash: null, sweptAt: null })
        .where(eq(blockchainDepositsTable.id, d.id));
      logger.info({ depositId: d.id, onchainBal }, "Detected failed sweep on-chain; resetting for retry");
    }

    logger.info({ depositId: d.id, address: d.toAddress, amount: amt, onchainBal }, "Retrying stuck sweep");
    triggerSweep(d.toAddress, enc, onchainBal, d.id);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// Sweeps any leftover TRX (from past deposits where USDT already swept) back to treasury.
async function sweepLeftoverTrx(): Promise<void> {
  const addrs = await getAllDepositAddresses();
  for (const a of addrs) {
    try {
      const url = `${TRONGRID_BASE}/v1/accounts/${a.address}`;
      const r = await fetch(url, { headers: tronHeaders() });
      if (!r.ok) continue;
      const j: any = await r.json();
      const acc = j?.data?.[0];
      if (!acc) continue;
      const trxSun = Number(acc.balance ?? 0);
      // Only sweep if leftover > 2 TRX (covers fee + buffer; below that not worth it)
      if (trxSun < 2_000_000) continue;
      // Skip if address still has USDT (will be handled by sweep pipeline)
      const tokens = acc.trc20 ?? [];
      let hasUsdt = false;
      for (const t of tokens) {
        const bal = t[USDT_CONTRACT];
        if (bal != null && Number(BigInt(bal)) >= 1_000_000) { hasUsdt = true; break; }
      }
      if (hasUsdt) continue;
      const pk = decryptDepositPrivateKey(a.privateKeyEnc);
      const txid = await sweepLeftoverTrxFrom(a.address, pk);
      if (txid) logger.info({ address: a.address, trx: trxSun / 1e6, txid }, "Swept leftover TRX to treasury");
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      errorLogger.error({ err, address: a.address }, "Leftover TRX sweep failed");
    }
  }
}

let monitorTimer: ReturnType<typeof setTimeout> | null = null;

async function runPollCycle(): Promise<void> {
  try {
    const testModeRows = await db.select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, "test_mode"))
      .limit(1);
    if (testModeRows[0]?.value === "true") {
      logger.debug("TronGrid monitor paused — test mode active");
    } else {
      // Poll per-user addresses (primary) and the platform address (legacy).
      await pollUserDepositAddresses();
      if (PLATFORM_TRON_ADDRESS) {
        await pollPlatformAddress();
      }
      // Retry any deposits that were credited but never swept to treasury.
      await retryStuckSweeps();
      // Sweep any leftover TRX gas at deposit addresses back to treasury.
      await sweepLeftoverTrx();
    }
  } catch (err) {
    errorLogger.error({ err }, "Error in TronGrid poll cycle");
  } finally {
    monitorTimer = setTimeout(runPollCycle, POLL_INTERVAL_MS);
  }
}

export function startTronMonitor(): { stop: () => void } {
  logger.info({ interval: POLL_INTERVAL_MS, platformAddress: PLATFORM_TRON_ADDRESS }, "TronGrid USDT monitor started");
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
