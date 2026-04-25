/**
 * depositWatcher.ts
 * ──────────────────────────────────────────────────────
 * Background polling job (every 15 s) that:
 *
 *   1. Iterates every wallet in the in-memory store.
 *   2. Fetches recent TRC20 (USDT) transfers from TronGrid.
 *   3. Skips any tx hash already seen (dedup set).
 *   4. Credits the user balance for new deposits.
 *   5. Kicks off the sweep pipeline (TRX gas → USDT sweep).
 * ──────────────────────────────────────────────────────
 */

import { getAllWallets, creditBalance } from "./wallet.js";
import { runSweepPipeline } from "./sweep.js";
import { db, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isStagingMode, logStagingSkip } from "../staging-mode";

async function isTestModeEnabled(): Promise<boolean> {
  try {
    const rows = await db.select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, "test_mode"))
      .limit(1);
    return rows[0]?.value === "true";
  } catch {
    return false;
  }
}

const USDT_CONTRACT = process.env["USDT_CONTRACT"] ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_API_KEY = process.env["TRONGRID_API_KEY"] ?? "";
const TRONGRID_BASE = "https://api.trongrid.io";
const POLL_INTERVAL_MS = 15_000;
const MIN_USDT = 1;

const processedTxHashes = new Set<string>();

interface TRC20Transfer {
  transaction_id: string;
  token_info: { symbol: string; address: string; decimals: number };
  block_timestamp: number;
  from: string;
  to: string;
  type: string;
  value: string;
}

function tronHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (TRONGRID_API_KEY) h["TRON-PRO-API-KEY"] = TRONGRID_API_KEY;
  return h;
}

async function fetchTRC20Transfers(address: string): Promise<TRC20Transfer[]> {
  const url =
    `${TRONGRID_BASE}/v1/accounts/${address}/transactions/trc20` +
    `?contract_address=${USDT_CONTRACT}&limit=20&only_to=true`;

  const res = await fetch(url, { headers: tronHeaders() });

  if (!res.ok) {
    throw new Error(`TronGrid ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { data?: TRC20Transfer[] };
  return json.data ?? [];
}

async function checkWallet(address: string, privateKey: string): Promise<void> {
  let transfers: TRC20Transfer[];

  try {
    transfers = await fetchTRC20Transfers(address);
  } catch (err) {
    console.error(`[depositWatcher] TronGrid error for ${address}:`, err);
    return;
  }

  for (const t of transfers) {
    if (t.type !== "Transfer") continue;

    if (t.token_info.address.toLowerCase() !== USDT_CONTRACT.toLowerCase()) {
      continue;
    }

    const txHash = t.transaction_id;

    if (processedTxHashes.has(txHash)) continue;

    const decimals = t.token_info.decimals ?? 6;
    const amount = parseFloat(t.value) / Math.pow(10, decimals);

    if (amount < MIN_USDT) continue;

    processedTxHashes.add(txHash);

    console.log(
      `[depositWatcher] Deposit detected! ${amount} USDT → ${address} | tx: ${txHash}`,
    );

    creditBalance(address, amount);

    runSweepPipeline(address, privateKey, amount).catch((err) => {
      console.error(`[depositWatcher] Sweep pipeline failed for ${address}:`, err);
    });
  }
}

async function pollAllWallets(): Promise<void> {
  if (await isTestModeEnabled()) {
    console.log("[depositWatcher] Test mode active — blockchain polling suspended to protect real funds.");
    return;
  }

  const wallets = getAllWallets();

  if (wallets.length === 0) return;

  await Promise.allSettled(
    wallets.map((w) => checkWallet(w.address, w.privateKey)),
  );
}

let watcherTimer: ReturnType<typeof setTimeout> | null = null;

async function runPollCycle(): Promise<void> {
  try {
    await pollAllWallets();
  } catch (err) {
    console.error("[depositWatcher] Unexpected error in poll cycle:", err);
  } finally {
    watcherTimer = setTimeout(runPollCycle, POLL_INTERVAL_MS);
  }
}

export function startDepositWatcher(): { stop: () => void } {
  // STAGING_MODE guard — see comment in tron-monitor.ts
  if (isStagingMode()) {
    logStagingSkip("deposit-watcher");
    return { stop: () => {} };
  }

  console.log(
    `[depositWatcher] Started — polling every ${POLL_INTERVAL_MS / 1000}s for USDT deposits`,
  );

  watcherTimer = setTimeout(runPollCycle, 5_000);

  return {
    stop() {
      if (watcherTimer) {
        clearTimeout(watcherTimer);
        watcherTimer = null;
        console.log("[depositWatcher] Stopped.");
      }
    },
  };
}
