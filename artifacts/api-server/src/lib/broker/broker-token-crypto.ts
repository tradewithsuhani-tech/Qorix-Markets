import crypto from "crypto";

const ALGO = "aes-256-gcm";
const FALLBACK = "dev-only-broker-token-fallback";
const SECRET =
  process.env["BROKER_ENC_SECRET"] ??
  process.env["WALLET_ENC_SECRET"] ??
  process.env["JWT_SECRET"] ??
  FALLBACK;

function getKey(): Buffer {
  return crypto.scryptSync(SECRET, "qorix-broker-v1", 32);
}

export function encryptBrokerToken(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptBrokerToken(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
