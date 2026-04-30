// HMAC-signed anti-replay token for state-changing API requests.
//
// Why this exists (B30 fintech hardening, L6):
//   The B28 originGuard middleware blocks naive curl attackers who
//   omit the Origin header entirely (the vast majority of automated
//   abuse traffic). But a determined attacker can simply set
//   `-H 'Origin: https://qorixmarkets.com'` and slip through the
//   guard.
//
//   This module raises that bar: every state-changing /api request
//   now also has to carry an HMAC-signed token issued by *our* server
//   via GET /api/csrf. The attacker has to:
//     1. Make a GET /api/csrf request (extra round-trip, extra cost)
//     2. Parse the response
//     3. Carry the token on the subsequent POST as X-CSRF-Token
//     4. Repeat the dance every hour as tokens expire
//
//   Most scripted scrapers don't bother with this state-tracking
//   ceremony -- they fire-and-forget POSTs. The handful that DO
//   implement the dance still face captcha, per-IP rate limit,
//   timing gates, disposable email blocklist, and KYC. So this token
//   is one more friction layer in the layered-defense stack rather
//   than a silver bullet.
//
//   We additionally bind the token to a hash of the User-Agent header
//   so a token issued to a real Chrome session can't be silently
//   reused by a Python requests script that grabs the response. UA
//   binding is admittedly forgeable (set the same UA), but it filters
//   out the laziest script-kiddie attacks at zero false-positive cost
//   to legitimate browsers.
//
// Token format (Base64URL, no padding):
//   <expUnix> + ":" + <uaHash> + ":" + <hmacSig>
//
//   - expUnix  : decimal seconds since epoch when this token expires
//   - uaHash   : first 16 hex chars of sha256(req.userAgent || "")
//   - hmacSig  : Base64URL of HMAC_SHA256(secret, expUnix + ":" + uaHash)
//
// Behaviour gate:
//   - CSRF_HMAC_SECRET unset            -> module is a no-op. issueToken
//                                          returns null; verifyToken
//                                          returns { ok: true, reason:
//                                          "CSRF_DISABLED" }. Safe
//                                          default for current prod
//                                          state until web client is
//                                          known to attach the token.
//   - CSRF_HMAC_SECRET set and < 32     -> throws on first issueToken
//                                          call. Force operator to use
//                                          a strong secret.
//   - CSRF_HMAC_SECRET set normally     -> tokens are issued + verified.
//
// Operator deploy playbook:
//   1. openssl rand -hex 32             # 64-char hex secret
//   2. flyctl secrets set CSRF_HMAC_SECRET=<secret> -a qorix-api
//   3. Wait for rolling deploy.
//   4. Verify GET /api/csrf returns { token, expiresAt } and POSTs
//      from the web app continue to succeed (web client auto-fetches
//      the token on first POST).
//   5. Verify a curl POST WITHOUT X-CSRF-Token now returns 403
//      CSRF_REQUIRED, and a curl POST WITH a stale/expired token
//      returns 403 CSRF_INVALID.

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export type VerifyResult =
  | { ok: true; reason?: "CSRF_DISABLED" }
  | { ok: false; reason: "CSRF_REQUIRED" | "CSRF_MALFORMED" | "CSRF_EXPIRED" | "CSRF_BAD_SIG" | "CSRF_UA_MISMATCH" };

function getSecret(): string | null {
  const raw = process.env["CSRF_HMAC_SECRET"]?.trim();
  if (!raw) return null;
  if (raw.length < 32) {
    throw new Error("CSRF_HMAC_SECRET must be at least 32 characters (recommended: openssl rand -hex 32)");
  }
  return raw;
}

export function csrfEnabled(): boolean {
  return getSecret() !== null;
}

function uaHash(userAgent: string | undefined): string {
  return createHash("sha256")
    .update(userAgent || "")
    .digest("hex")
    .slice(0, 16);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlToBuf(s: string): Buffer {
  // Restore padding for the standard atob path.
  const pad = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(padded, "base64");
}

/**
 * Issue a fresh CSRF token bound to (expiry, UA-hash). Returns `null`
 * when CSRF is disabled (secret unset) — caller should treat that as
 * "no enforcement, send no token".
 */
export function issueCsrfToken(userAgent: string | undefined): { token: string; expiresAt: string } | null {
  const secret = getSecret();
  if (!secret) return null;

  const expUnix = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const ua = uaHash(userAgent);
  const payload = `${expUnix}:${ua}`;
  const sig = b64url(createHmac("sha256", secret).update(payload).digest());

  return {
    token: `${payload}:${sig}`,
    expiresAt: new Date(expUnix * 1000).toISOString(),
  };
}

/**
 * Verify an incoming X-CSRF-Token header against the current secret +
 * the request's User-Agent. When CSRF is disabled, returns
 * { ok: true, reason: "CSRF_DISABLED" } so callers (originGuard) can
 * skip enforcement.
 */
export function verifyCsrfToken(token: string | undefined, userAgent: string | undefined): VerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: true, reason: "CSRF_DISABLED" };

  if (!token || typeof token !== "string") {
    return { ok: false, reason: "CSRF_REQUIRED" };
  }

  const parts = token.split(":");
  if (parts.length !== 3) {
    return { ok: false, reason: "CSRF_MALFORMED" };
  }
  const [expStr, ua, sig] = parts;

  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return { ok: false, reason: "CSRF_MALFORMED" };
  if (exp * 1000 < Date.now()) return { ok: false, reason: "CSRF_EXPIRED" };

  // Recompute the expected signature and timing-safe compare. We compare
  // raw HMAC bytes (not strings) to avoid early-exit timing leaks on
  // sig-prefix matches.
  const payload = `${expStr}:${ua}`;
  const expectedSigBuf = createHmac("sha256", secret).update(payload).digest();
  let providedSigBuf: Buffer;
  try {
    providedSigBuf = b64urlToBuf(sig);
  } catch {
    return { ok: false, reason: "CSRF_BAD_SIG" };
  }
  if (providedSigBuf.length !== expectedSigBuf.length) {
    return { ok: false, reason: "CSRF_BAD_SIG" };
  }
  if (!timingSafeEqual(providedSigBuf, expectedSigBuf)) {
    return { ok: false, reason: "CSRF_BAD_SIG" };
  }

  // UA-binding check. Don't compare bytes -- recompute the hash from the
  // current UA and compare hex strings (timing-safe constant length).
  const expectedUa = uaHash(userAgent);
  if (expectedUa.length !== ua.length) {
    return { ok: false, reason: "CSRF_UA_MISMATCH" };
  }
  if (!timingSafeEqual(Buffer.from(expectedUa), Buffer.from(ua))) {
    return { ok: false, reason: "CSRF_UA_MISMATCH" };
  }

  return { ok: true };
}
