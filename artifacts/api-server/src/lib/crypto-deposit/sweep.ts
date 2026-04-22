/**
 * sweep.ts
 * ──────────────────────────────────────────────────────
 * Two-step sweep pipeline for every confirmed deposit:
 *
 *   Step 1 — Send 1 TRX from MAIN_WALLET to the user
 *             wallet so it has gas for the USDT transfer.
 *
 *   Step 2 — Transfer all USDT from the user wallet back
 *             to MAIN_WALLET using the user's private key.
 * ──────────────────────────────────────────────────────
 */

import { TronWeb } from "tronweb";

const MAIN_WALLET = process.env["MAIN_WALLET"] ?? process.env["PLATFORM_TRON_ADDRESS"] ?? "";
const MAIN_PRIVATE_KEY = process.env["MAIN_PRIVATE_KEY"] ?? process.env["PLATFORM_TRON_PRIVATE_KEY"] ?? "";
const USDT_CONTRACT = process.env["USDT_CONTRACT"] ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_API_KEY = process.env["TRONGRID_API_KEY"] ?? "";

const TRX_GAS_AMOUNT = 14_000_000;
const SWEEP_DELAY_MS = 8_000;

function buildTronWeb(privateKey: string): InstanceType<typeof TronWeb> {
  return new TronWeb({
    fullHost: "https://api.trongrid.io",
    headers: TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": TRONGRID_API_KEY } : {},
    privateKey,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendTrxForGas(toAddress: string): Promise<string> {
  if (!MAIN_WALLET || !MAIN_PRIVATE_KEY) {
    throw new Error("MAIN_WALLET / MAIN_PRIVATE_KEY env vars are not set");
  }

  const tronWeb = buildTronWeb(MAIN_PRIVATE_KEY);

  const tx = await tronWeb.transactionBuilder.sendTrx(
    toAddress,
    TRX_GAS_AMOUNT,
    MAIN_WALLET,
  );

  const signedTx = await tronWeb.trx.sign(tx, MAIN_PRIVATE_KEY);
  const result = await tronWeb.trx.sendRawTransaction(signedTx);

  if (!result.result) {
    throw new Error(`TRX send failed: ${JSON.stringify(result)}`);
  }

  const txId: string = result.txid ?? (result as any).transaction?.txID ?? "unknown";
  console.log(`[sweep] Sent 1 TRX for gas → ${toAddress} | txid: ${txId}`);
  return txId;
}

export async function sweepUsdt(
  fromAddress: string,
  fromPrivateKey: string,
  usdtAmount: number,
): Promise<string> {
  if (!MAIN_WALLET) {
    throw new Error("MAIN_WALLET env var is not set");
  }

  const tronWeb = buildTronWeb(fromPrivateKey);

  const contract = await tronWeb.contract().at(USDT_CONTRACT);

  const decimals = 6;
  const rawAmount = BigInt(Math.floor(usdtAmount * Math.pow(10, decimals)));

  const txId: string = await contract.transfer(MAIN_WALLET, rawAmount).send({
    feeLimit: 20_000_000,
    callValue: 0,
    shouldPollResponse: false,
  });

  console.log(
    `[sweep] Swept ${usdtAmount} USDT from ${fromAddress} → ${MAIN_WALLET} | txid: ${txId}`,
  );
  return txId;
}

/**
 * Sends USDT from the treasury (MAIN_WALLET) to an arbitrary external address.
 * Used for processing approved user withdrawals on-chain.
 */
export async function sendUsdtFromTreasury(
  toAddress: string,
  usdtAmount: number,
): Promise<string> {
  if (!MAIN_WALLET || !MAIN_PRIVATE_KEY) {
    throw new Error("MAIN_WALLET / MAIN_PRIVATE_KEY env vars are not set");
  }

  const tronWeb = buildTronWeb(MAIN_PRIVATE_KEY);
  const contract = await tronWeb.contract().at(USDT_CONTRACT);

  const decimals = 6;
  const rawAmount = BigInt(Math.floor(usdtAmount * Math.pow(10, decimals)));

  const txId: string = await contract.transfer(toAddress, rawAmount).send({
    feeLimit: 100_000_000,
    callValue: 0,
    shouldPollResponse: false,
  });

  console.log(
    `[treasury] Sent ${usdtAmount} USDT from ${MAIN_WALLET} → ${toAddress} | txid: ${txId}`,
  );
  return txId;
}

/**
 * Returns the current on-chain USDT balance of the treasury (MAIN_WALLET).
 */
export async function getTreasuryUsdtBalance(): Promise<number> {
  if (!MAIN_WALLET || !MAIN_PRIVATE_KEY) {
    throw new Error("MAIN_WALLET / MAIN_PRIVATE_KEY env vars are not set");
  }
  const tronWeb = buildTronWeb(MAIN_PRIVATE_KEY);
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  const raw = await contract.balanceOf(MAIN_WALLET).call();
  const decimals = 6;
  return Number(BigInt(raw.toString())) / Math.pow(10, decimals);
}

async function sweepRemainingTrx(
  fromAddress: string,
  fromPrivateKey: string,
): Promise<string | null> {
  if (!MAIN_WALLET) return null;
  try {
    const tronWeb = buildTronWeb(fromPrivateKey);
    const balanceSun: number = await tronWeb.trx.getBalance(fromAddress);
    // Leave 1 TRX buffer (covers tx bandwidth fee if free bandwidth is exhausted)
    const buffer = 1_000_000;
    const sendable = balanceSun - buffer;
    if (sendable <= 0) {
      console.log(`[sweep] No leftover TRX to sweep from ${fromAddress} (balance=${balanceSun / 1e6})`);
      return null;
    }
    const tx = await tronWeb.transactionBuilder.sendTrx(MAIN_WALLET, sendable, fromAddress);
    const signed = await tronWeb.trx.sign(tx, fromPrivateKey);
    const result = await tronWeb.trx.sendRawTransaction(signed);
    if (!result.result) {
      console.error(`[sweep] TRX leftover sweep failed: ${JSON.stringify(result)}`);
      return null;
    }
    const txId: string = result.txid ?? (result as any).transaction?.txID ?? "unknown";
    console.log(`[sweep] Returned ${sendable / 1e6} TRX leftover → ${MAIN_WALLET} | txid: ${txId}`);
    return txId;
  } catch (err) {
    console.error(`[sweep] sweepRemainingTrx error:`, err);
    return null;
  }
}

export async function runSweepPipeline(
  userAddress: string,
  userPrivateKey: string,
  usdtAmount: number,
): Promise<string> {
  await sendTrxForGas(userAddress);

  console.log(
    `[sweep] Waiting ${SWEEP_DELAY_MS / 1000}s for TRX to confirm before sweeping USDT…`,
  );
  await sleep(SWEEP_DELAY_MS);

  const sweepTxId = await sweepUsdt(userAddress, userPrivateKey, usdtAmount);

  // After USDT sweep, return any leftover TRX gas back to treasury
  await sleep(SWEEP_DELAY_MS);
  await sweepRemainingTrx(userAddress, userPrivateKey);

  return sweepTxId;
}
