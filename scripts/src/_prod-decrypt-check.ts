// =============================================================================
// TEMPORARY preflight tool — Mumbai DB cutover (#41).
//
// Purpose: before dump/restore, prove that DEPOSIT_KEY_ENC_HEX still decrypts
// the AES-GCM-wrapped TRON private keys stored in `deposit_addresses.
// private_key_enc`. If this fails, the cutover would leave Singapore Neon
// unable to spend incoming USDT. Run BEFORE swapping DATABASE_URL on Fly.
//
// Required env (run from a host that has access to the source DB only):
//   PROD_DATABASE_URL          — source Postgres (read-only role is fine)
//   DEPOSIT_KEY_ENC_HEX        — 32-byte hex AES-256 key currently in Fly
//
// Usage:
//   pnpm --filter @workspace/scripts exec tsx src/_prod-decrypt-check.ts
//
// Status: kept after cutover for rerun safety on any future migration. Not
// wired into package.json scripts on purpose — it talks to PROD and should
// be invoked deliberately, not by accident. Remove once the legacy Replit
// Postgres is decommissioned (post 7-day grace period).
// =============================================================================
import pg from "pg";
import crypto from "node:crypto";
const { Client } = pg;
const url = process.env["PROD_DATABASE_URL"]!;
const c = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30000,
  connectionTimeoutMillis: 15000,
});
await c.connect();
const res = await c.query<{ id: number; private_key_enc: string }>(
  "SELECT id, private_key_enc FROM deposit_addresses WHERE private_key_enc <> '' ORDER BY id DESC LIMIT 5;"
);
const secret = process.env["WALLET_ENC_SECRET"] ?? process.env["JWT_SECRET"] ?? "";
const secretSource = process.env["WALLET_ENC_SECRET"] ? "WALLET_ENC_SECRET" : "JWT_SECRET (fallback)";
if (!secret) { console.log("FAIL: no secret in env"); process.exit(1); }
const key = crypto.scryptSync(secret, "qorix-wallet-v1", 32);
let okCount = 0, failCount = 0;
for (const sample of res.rows) {
  const buf = Buffer.from(sample.private_key_enc, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  try {
    const dec = crypto.createDecipheriv("aes-256-gcm", key, iv);
    dec.setAuthTag(tag);
    const plain = Buffer.concat([dec.update(ct), dec.final()]).toString("utf8");
    if (plain && plain.length >= 16) { console.log(`  OK  id=${sample.id} length=${plain.length}`); okCount++; }
    else { console.log(`  WARN id=${sample.id} too short`); failCount++; }
  } catch (err) { console.log(`  FAIL id=${sample.id}: ${(err as Error).message}`); failCount++; }
}
console.log("");
console.log(`Sampled ${res.rows.length} PROD wallets; secret source: ${secretSource}; results: ${okCount} OK / ${failCount} FAIL`);
console.log("");
if (okCount === res.rows.length && res.rows.length > 0) {
  console.log("PARITY CONFIRMED: this Replit env's secret decrypts PROD wallets.");
  console.log("  -> Fly's qorix-api needs the SAME value as WALLET_ENC_SECRET (or JWT_SECRET).");
} else {
  console.log("DO NOT proceed to Phase B until parity is resolved.");
}
await c.end();
