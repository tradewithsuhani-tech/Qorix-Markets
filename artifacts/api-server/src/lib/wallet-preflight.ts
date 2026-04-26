import { db, depositAddressesTable } from "@workspace/db";
import { ne } from "drizzle-orm";
import { decryptPrivateKey } from "./wallet-crypto";
import { logger, errorLogger } from "./logger";

/**
 * Verify that the WALLET_ENC_SECRET / JWT_SECRET key currently loaded into
 * process.env can actually decrypt one of the existing rows in
 * deposit_addresses. If we ever boot with a different key (because someone
 * forgot to set WALLET_ENC_SECRET on the new host, or rotated JWT_SECRET while
 * the wallets were encrypted with WALLET_ENC_SECRET, or vice-versa), the
 * decrypt call throws — and every user's TRC20 deposit address becomes
 * unrecoverable for sweeps. We'd rather hard-fail at startup than silently
 * limp along and lock funds.
 *
 * No-op when there are zero encrypted rows (fresh DB / dev install).
 */
export async function runWalletEncryptionPreflight(): Promise<void> {
  const rows = await db
    .select({
      id: depositAddressesTable.id,
      privateKeyEnc: depositAddressesTable.privateKeyEnc,
    })
    .from(depositAddressesTable)
    .where(ne(depositAddressesTable.privateKeyEnc, ""))
    .limit(1);

  if (rows.length === 0) {
    logger.info(
      "[wallet-preflight] no encrypted deposit addresses found — skipping decrypt check",
    );
    return;
  }

  const sample = rows[0]!;
  try {
    const plain = decryptPrivateKey(sample.privateKeyEnc);
    if (!plain || plain.length < 16) {
      throw new Error("decrypted output is empty or too short");
    }
    logger.info(
      { sampleId: sample.id },
      "[wallet-preflight] OK — wallet encryption secret matches existing data",
    );
  } catch (err) {
    errorLogger.error(
      { err, sampleId: sample.id },
      "[wallet-preflight] FATAL — cannot decrypt existing wallet ciphertext. " +
        "The WALLET_ENC_SECRET / JWT_SECRET on this instance does NOT match " +
        "the key used when these rows were encrypted. Refusing to start so " +
        "no further wallets get encrypted with the wrong key. Set the correct " +
        "WALLET_ENC_SECRET (or JWT_SECRET if that's what the previous deploy " +
        "used) and restart.",
    );
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
    // In dev we log loudly but don't kill the process — local pg may have
    // test data that was encrypted with a throwaway secret.
  }
}
