import crypto from "crypto";

const ALGO = "aes-256-gcm";

// In production we MUST use an explicit secret because every TRON deposit
// address private key in the wallets table is encrypted with this key. If a
// new instance comes up with the dev fallback (or a different secret), every
// existing deposit address becomes undecryptable — the platform sweep stops
// working and user funds get stuck. Hard-fail at module load instead of
// silently corrupting future encrypted data with a mismatched key.
const WALLET_ENC_FALLBACK = "dev-only-fallback-do-not-use-in-production";
const WALLET_ENC_RESOLVED =
  process.env["WALLET_ENC_SECRET"] ??
  process.env["JWT_SECRET"] ??
  WALLET_ENC_FALLBACK;
if (
  WALLET_ENC_RESOLVED === WALLET_ENC_FALLBACK &&
  process.env.NODE_ENV === "production"
) {
  throw new Error(
    "WALLET_ENC_SECRET (or JWT_SECRET as fallback) is required in production. " +
      "It MUST be the same value the existing deployment uses, otherwise " +
      "previously encrypted deposit-address private keys cannot be decrypted.",
  );
}

function getKey(): Buffer {
  return crypto.scryptSync(WALLET_ENC_RESOLVED, "qorix-wallet-v1", 32);
}

export function encryptPrivateKey(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptPrivateKey(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
