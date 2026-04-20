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

import TronWeb from "tronweb";

const MAIN_WALLET = process.env["MAIN_WALLET"] ?? "";
const MAIN_PRIVATE_KEY = process.env["MAIN_PRIVATE_KEY"] ?? "";
const USDT_CONTRACT = process.env["USDT_CONTRACT"] ?? "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRONGRID_API_KEY = process.env["TRONGRID_API_KEY"] ?? "";

const TRX_GAS_AMOUNT = 1_000_000;
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

export async function runSweepPipeline(
  userAddress: string,
  userPrivateKey: string,
  usdtAmount: number,
): Promise<void> {
  try {
    await sendTrxForGas(userAddress);
  } catch (err) {
    console.error(`[sweep] Failed to send TRX gas to ${userAddress}:`, err);
    return;
  }

  console.log(
    `[sweep] Waiting ${SWEEP_DELAY_MS / 1000}s for TRX to confirm before sweeping USDT…`,
  );
  await sleep(SWEEP_DELAY_MS);

  try {
    await sweepUsdt(userAddress, userPrivateKey, usdtAmount);
  } catch (err) {
    console.error(`[sweep] Failed to sweep USDT from ${userAddress}:`, err);
  }
}
