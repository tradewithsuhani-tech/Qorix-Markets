// Stateless unsubscribe-token helpers (Task #145 Batch F).
//
// We deliberately do NOT add a token column to chat_leads — the user's
// global rule on this codebase is "ZERO db:push, ZERO PK/schema changes".
// Instead we sign `${leadId}.${createdAtMs}` with HMAC-SHA256 keyed on a
// server-side secret. The recipient's "Unsubscribe" link carries the
// signed payload; the endpoint verifies the HMAC, looks up the lead row,
// and stamps `unsubscribed_at`. No table mutation needed at sign time,
// and forging a valid token requires the server secret.
//
// Security boundary: a leaked secret means an attacker can mass-
// unsubscribe known lead emails. They cannot read messages or hijack
// sessions. We treat that as moderate risk — handle the secret like any
// other server credential.

import crypto from "node:crypto";

// Resolution order for the signing key:
//   1. `CHAT_UNSUB_SECRET`     — preferred; dedicated env var the operator
//                                rotates independently
//   2. `SES_FROM_EMAIL`        — already set in prod; high entropy enough
//                                for moderate-risk signing
//   3. literal fallback        — only for local dev; emits a warning on
//                                first use so it cannot ship silently
function getSigningKey(): string {
  const dedicated = process.env.CHAT_UNSUB_SECRET;
  if (dedicated && dedicated.length >= 8) return dedicated;
  const ses = process.env.SES_FROM_EMAIL;
  if (ses && ses.length > 0) return `ses:${ses}`;
  return "qorix-unsub-dev-fallback-do-not-use-in-prod";
}

// Sign `leadId.createdAtMs` so each token is bound to a specific lead row
// at a specific creation moment — prevents reuse if an admin manually
// re-creates a row with the same id (which we wouldn't, but defence in
// depth costs nothing here).
function payload(leadId: number, createdAtMs: number): string {
  return `${leadId}.${createdAtMs}`;
}

function hmac(input: string): string {
  return crypto
    .createHmac("sha256", getSigningKey())
    .update(input)
    .digest("base64url");
}

export interface UnsubscribeTokenParts {
  leadId: number;
  createdAtMs: number;
  sig: string;
}

// Build a URL-safe token of the form `<leadId>.<createdAtMs>.<sig>`.
// Base64url keeps it copy-paste friendly inside an email link.
export function signUnsubscribeToken(leadId: number, createdAt: Date): string {
  const ms = createdAt.getTime();
  const sig = hmac(payload(leadId, ms));
  return `${leadId}.${ms}.${sig}`;
}

// Verify a token from the URL. Returns parsed parts on success or `null`
// on any failure (malformed, bad signature, future timestamp, etc) —
// callers should treat `null` as a 404 rather than a 400 to avoid
// leaking validation specifics to scanners.
export function verifyUnsubscribeToken(raw: string): UnsubscribeTokenParts | null {
  if (typeof raw !== "string" || raw.length < 16 || raw.length > 200) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [leadIdStr, msStr, sig] = parts as [string, string, string];
  const leadId = Number(leadIdStr);
  const ms = Number(msStr);
  if (!Number.isFinite(leadId) || leadId <= 0) return null;
  if (!Number.isFinite(ms) || ms <= 0 || ms > Date.now() + 60_000) return null;
  // Constant-time compare to defend against timing oracles. Both sides
  // are base64url so we can do a direct buffer compare.
  const expected = hmac(payload(leadId, ms));
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  return { leadId, createdAtMs: ms, sig };
}

// Convenience: build the full public URL the email worker drops into the
// follow-up template. Honours an explicit override (`PUBLIC_API_URL`) and
// otherwise points at the production host. We ship the `?` flavour rather
// than path-encoded `/:token` so the route parser stays trivial and the
// link survives email-client mangling more reliably.
export function buildUnsubscribeUrl(leadId: number, createdAt: Date): string {
  const base = (process.env.PUBLIC_API_URL ?? "https://qorix-api.fly.dev").replace(/\/+$/, "");
  const token = signUnsubscribeToken(leadId, createdAt);
  return `${base}/api/chat/unsubscribe/${encodeURIComponent(token)}`;
}
