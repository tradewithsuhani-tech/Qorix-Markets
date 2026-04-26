// ──────────────────────────────────────────────────────────────────────────
// Two-Factor Authentication (TOTP) — enrolment + login challenge
// ──────────────────────────────────────────────────────────────────────────
// What this gives the user:
//   1) Open Settings → Two-Factor Auth → "Enable" → POST /security/2fa/setup
//      generates a fresh base32 secret, stores it on the user row WITHOUT
//      flipping `twoFactorEnabled`, and returns a QR data URL for the
//      authenticator app to scan PLUS the manual code for hand-typing.
//   2) The user types the first 6-digit code from the app and submits to
//      POST /security/2fa/verify-setup. We validate the code against the
//      pending secret; on success we flip `twoFactorEnabled = true`,
//      generate 8 single-use backup codes (sha256-hashed for storage),
//      and return them ONCE so the UI can show them to the user.
//   3) From here on, every POST /auth/login that succeeds at the password
//      check returns `{ requires2FA, twoFactorToken }` instead of a real
//      session token. The frontend prompts the user for a 6-digit code
//      (or an 8-char backup code), then POSTs to
//      POST /auth/2fa/login-verify with the challenge token + code; on
//      success we run the SAME single-active-device logic the normal login
//      runs, then issue a real session JWT.
//   4) POST /security/2fa/disable requires the user's password AND a fresh
//      6-digit code (or backup code) — losing the device alone shouldn't
//      let the password-only attacker turn 2FA off.
//
// Design decisions worth knowing:
//   - Secret is stored in plaintext. A DB compromise leaks both password
//     hashes and TOTP secrets, so encrypting per-user with a single env
//     key only buys security against a very specific (and uncommon) side
//     channel; we'd rather ship v1 simply than ship encryption-theatre.
//   - Backup codes are sha256-hashed (no salt — they're 40 bits of entropy
//     each, brute-forcing is cheap regardless of salting; sha256 just
//     prevents direct DB-leak-to-login). Used codes are spliced out of
//     the array so each works exactly once.
//   - The challenge token is a separate JWT with `scope: "2fa-challenge"`
//     and a 5-min TTL so a leaked challenge token can't be replayed
//     against /auth/me or any other authenticated endpoint.
//   - Existing 24 live users have `twoFactorEnabled = false` by default,
//     so the login flow is a complete no-op for them until they opt in.
// ──────────────────────────────────────────────────────────────────────────

import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";

const router = Router();

// Per-IP brake on the destructive 2FA management endpoints. A hijacked
// session shouldn't be able to grind through the ~40-bit backup-code
// space to silently disable 2FA. Login + login-verify already have
// their own (separate) limiter inside auth.ts.
const twoFactorMgmtLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const ISSUER = "Qorix Markets";

// ── JWT scopes ──────────────────────────────────────────────────────────
// The login-flow uses a separate, short-lived "2fa-challenge" token so
// it cannot be misused as a real session token. JWT_SECRET is the same
// secret the main session JWT uses — verifying scope is what keeps the
// two namespaces apart.
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const TWO_FA_CHALLENGE_TTL_SECONDS = 5 * 60;

export interface TwoFactorChallengeJwt {
  userId: number;
  scope: "2fa-challenge";
  iat?: number;
  exp?: number;
}

export function signTwoFactorChallenge(userId: number): string {
  return jwt.sign({ userId, scope: "2fa-challenge" }, JWT_SECRET, {
    expiresIn: TWO_FA_CHALLENGE_TTL_SECONDS,
  });
}

export function verifyTwoFactorChallenge(token: string): TwoFactorChallengeJwt | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TwoFactorChallengeJwt;
    if (decoded.scope !== "2fa-challenge") return null;
    return decoded;
  } catch {
    return null;
  }
}

// ── TOTP helpers ────────────────────────────────────────────────────────
function buildTotp(secretBase32: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1", // RFC 6238 default — what every authenticator app expects
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

// Validate a 6-digit code with a ±1-step (±30s) skew window so users on
// slightly slow/fast clocks still get in. Returns true on match.
function verifyTotpCode(secretBase32: string, label: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = buildTotp(secretBase32, label);
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// ── Backup-code helpers ─────────────────────────────────────────────────
// Format: XXXX-XXXX (8 chars, base32 alphabet without ambiguous chars).
// 40 bits of entropy is plenty for "I lost my phone, let me in this once"
// — they are single-use AND only valid once 2FA is already armed.
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
function generateBackupCode(): string {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += BACKUP_CODE_ALPHABET[bytes[i]! % BACKUP_CODE_ALPHABET.length];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
function hashBackupCode(code: string): string {
  // Strip the dash so users can type it with or without — same hash either way.
  const normalized = code.replace(/-/g, "").toUpperCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
function generateBackupCodeSet(): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: 8 }, () => generateBackupCode());
  const hashed = plain.map(hashBackupCode);
  return { plain, hashed };
}

// ── Routes ──────────────────────────────────────────────────────────────
// Everything below requires the user to already be logged in. The login
// challenge endpoint (POST /auth/2fa/login-verify) lives in routes/auth.ts
// because it has to share the device-fingerprint + session-token logic
// with the main login flow.
router.use(authMiddleware);

// GET /security/2fa/status
// Lightweight read used by Settings to render the right button (Enable
// vs Disable). `backupCodesRemaining` powers the "regenerate codes"
// nudge when the user has burned through most of them.
router.get("/security/2fa/status", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = await db
    .select({
      enabled: usersTable.twoFactorEnabled,
      hasSecret: usersTable.twoFactorSecret,
      backupCodes: usersTable.twoFactorBackupCodes,
      enabledAt: usersTable.twoFactorEnabledAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    enabled: row.enabled,
    backupCodesRemaining: row.enabled ? (row.backupCodes ?? []).length : 0,
    enabledAt: row.enabledAt ? row.enabledAt.toISOString() : null,
  });
});

// POST /security/2fa/setup
// Generates a fresh base32 secret + QR. Stores the secret on the user row
// in a "pending" state (enabled stays false). Calling this again throws
// out the previous pending secret — supports the "I closed the modal,
// let me restart" flow without leaving orphans.
router.post("/security/2fa/setup", async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const rows = await db
    .select({
      email: usersTable.email,
      enabled: usersTable.twoFactorEnabled,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (row.enabled) {
    res.status(400).json({ error: "Two-factor authentication is already enabled. Disable it first to set up a new device." });
    return;
  }

  const secret = new OTPAuth.Secret({ size: 20 }); // 160-bit, RFC-recommended
  const secretBase32 = secret.base32;
  const label = row.email;
  const totp = buildTotp(secretBase32, label);
  const otpauthUrl = totp.toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#000000", light: "#FFFFFF" },
  });

  await db
    .update(usersTable)
    .set({ twoFactorSecret: secretBase32 })
    .where(eq(usersTable.id, userId));

  res.json({
    qrDataUrl,
    manualCode: secretBase32,
    issuer: ISSUER,
    accountName: label,
  });
});

// POST /security/2fa/verify-setup
// User has scanned the QR and is submitting the first code. If it
// matches, we flip enabled=true, generate 8 backup codes, and return
// them ONCE for the UI to show. After this response no endpoint will
// ever return them in plaintext again — losing them = regenerate.
router.post("/security/2fa/verify-setup", async (req: AuthRequest, res) => {
  const code: unknown = req.body?.code;
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Code must be 6 digits" });
    return;
  }
  const userId = req.userId!;
  const rows = await db
    .select({
      email: usersTable.email,
      enabled: usersTable.twoFactorEnabled,
      secret: usersTable.twoFactorSecret,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (row.enabled) {
    res.status(400).json({ error: "Two-factor authentication is already enabled" });
    return;
  }
  if (!row.secret) {
    res.status(400).json({ error: "Run setup first to get a QR code" });
    return;
  }
  if (!verifyTotpCode(row.secret, row.email, code)) {
    res.status(400).json({ error: "Invalid code. Make sure your phone time is correct, then try again." });
    return;
  }

  const { plain, hashed } = generateBackupCodeSet();
  await db
    .update(usersTable)
    .set({
      twoFactorEnabled: true,
      twoFactorEnabledAt: new Date(),
      twoFactorBackupCodes: hashed,
    })
    .where(eq(usersTable.id, userId));

  res.json({
    enabled: true,
    backupCodes: plain,
  });
});

// POST /security/2fa/disable
// Requires BOTH the password and a fresh code (TOTP or backup). This
// stops a password-only attacker who happens to grab a session cookie
// from quietly disabling 2FA — they'd still need the device.
router.post("/security/2fa/disable", twoFactorMgmtLimit, async (req: AuthRequest, res) => {
  const password: unknown = req.body?.password;
  const codeIn: unknown = req.body?.code;
  if (typeof password !== "string" || password.length < 1 ||
      typeof codeIn !== "string" || codeIn.length < 6 || codeIn.length > 16) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const userId = req.userId!;
  const rows = await db
    .select({ passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const passwordOk = await bcrypt.compare(password, row.passwordHash);
  if (!passwordOk) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }

  // Accept either a 6-digit TOTP code OR an 8-char backup code. Atomic
  // helper handles the SELECT-FOR-UPDATE + verify + consume in one tx
  // so two concurrent disables can't both burn the same backup code.
  const consumed = await consumeAuthCodeForUser(userId, codeIn.trim());
  if (!consumed.ok) {
    if (consumed.reason === "not-enabled") {
      res.status(400).json({ error: "Two-factor authentication is not enabled" });
    } else {
      res.status(400).json({ error: "Invalid code" });
    }
    return;
  }

  await db
    .update(usersTable)
    .set({
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorEnabledAt: null,
      twoFactorBackupCodes: [],
    })
    .where(eq(usersTable.id, userId));

  res.json({ enabled: false });
});

// POST /security/2fa/regenerate-backup-codes
// Auth-gated, requires a fresh code. Throws out the old set and returns
// a new set of 8 ONCE.
router.post("/security/2fa/regenerate-backup-codes", twoFactorMgmtLimit, async (req: AuthRequest, res) => {
  const codeIn: unknown = req.body?.code;
  if (typeof codeIn !== "string" || codeIn.length < 6 || codeIn.length > 16) {
    res.status(400).json({ error: "Validation failed" });
    return;
  }
  const userId = req.userId!;
  const consumed = await consumeAuthCodeForUser(userId, codeIn.trim());
  if (!consumed.ok) {
    if (consumed.reason === "not-enabled") {
      res.status(400).json({ error: "Two-factor authentication is not enabled" });
    } else {
      res.status(400).json({ error: "Invalid code" });
    }
    return;
  }
  const { plain, hashed } = generateBackupCodeSet();
  await db
    .update(usersTable)
    .set({ twoFactorBackupCodes: hashed })
    .where(eq(usersTable.id, userId));
  res.json({ backupCodes: plain });
});

// ── Shared verification helper ──────────────────────────────────────────
// Used by both /security/2fa/disable AND /auth/2fa/login-verify (in
// routes/auth.ts). Returns { ok, updatedBackupCodes? } — caller is
// responsible for persisting `updatedBackupCodes` if a backup code was
// consumed (otherwise the same backup code could be reused).
export interface ConsumeAuthCodeResult {
  ok: boolean;
  /** Set when a backup code was consumed; caller must persist this. */
  updatedBackupCodes?: string[];
}
export function consumeAuthCode(
  secretBase32: string,
  label: string,
  backupCodesHashed: string[],
  code: string,
): ConsumeAuthCodeResult {
  // TOTP first (the common path).
  if (/^\d{6}$/.test(code)) {
    if (verifyTotpCode(secretBase32, label, code)) return { ok: true };
    return { ok: false };
  }
  // Backup code path. Strip dashes and uppercase so user formatting is forgiving.
  const normalized = code.replace(/[-\s]/g, "").toUpperCase();
  if (normalized.length !== 8) return { ok: false };
  const hashed = hashBackupCode(normalized);
  const idx = backupCodesHashed.indexOf(hashed);
  if (idx === -1) return { ok: false };
  // Single-use: splice it out.
  const updated = [...backupCodesHashed];
  updated.splice(idx, 1);
  return { ok: true, updatedBackupCodes: updated };
}

// ── consumeAuthCodeForUser ─────────────────────────────────────────────
// Atomic, race-safe consumption: SELECT ... FOR UPDATE locks the user
// row, we verify the code against the FRESH backup-codes array, and if
// a backup code was burned we persist the new array — all inside a
// single transaction. Without this, two concurrent requests presenting
// the same backup code could both pass the in-memory `indexOf` check
// before either UPDATE landed.
export async function consumeAuthCodeForUser(
  userId: number,
  code: string,
): Promise<{ ok: boolean; reason?: "not-enabled" | "invalid-code" | "not-found" }> {
  return await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        email: usersTable.email,
        enabled: usersTable.twoFactorEnabled,
        secret: usersTable.twoFactorSecret,
        backupCodes: usersTable.twoFactorBackupCodes,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .for("update")
      .limit(1);
    const row = rows[0];
    if (!row) return { ok: false, reason: "not-found" as const };
    if (!row.enabled || !row.secret) return { ok: false, reason: "not-enabled" as const };
    const result = consumeAuthCode(row.secret, row.email, row.backupCodes ?? [], code);
    if (!result.ok) return { ok: false, reason: "invalid-code" as const };
    if (result.updatedBackupCodes !== undefined) {
      await tx
        .update(usersTable)
        .set({ twoFactorBackupCodes: result.updatedBackupCodes })
        .where(eq(usersTable.id, userId));
    }
    return { ok: true };
  });
}

export default router;
