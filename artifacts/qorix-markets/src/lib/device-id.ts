/**
 * Stable per-browser device identity for the security stack.
 *
 * WHY THIS EXISTS
 * The api-server's old fingerprint algorithm hashed `User-Agent + IP`. That
 * had two failure modes:
 *
 *   1. Same browser, IP roams (mobile data → wifi → mobile hotspot) →
 *      different fingerprint each hop → false-positive "new device login"
 *      alerts every time the user moves networks.
 *
 *   2. Two genuinely different browsers on the same machine that happen to
 *      land behind the same NAT IP → similar UAs → potential collision in
 *      the truncated 32-hex hash → two devices look like one.
 *
 * THIS MODULE
 * Generates a UUID once per browser, persists it in localStorage, and lets
 * `auth-fetch` / `merchant-auth-fetch` send it as the `X-Device-Id` header
 * on every API request. Server-side `computeDeviceFingerprint(req)` prefers
 * this opaque ID over the UA+IP hash, giving each browser a stable identity
 * across network changes — and a NEW identity if the user actively wipes
 * site data (which is the correct interpretation: that IS a new "device"
 * from the security perspective, since it can no longer prove continuity
 * with prior sessions).
 *
 * The ID is opaque to the server — we hash it before storing — and to other
 * sites (it's a localStorage value scoped to qorixmarkets.com). It is NOT a
 * tracking cookie; clearing site data resets it.
 */

const STORAGE_KEY = "qorix_device_id";

/** Header name the server reads in `parseClientDeviceId(req)`. */
export const DEVICE_ID_HEADER = "X-Device-Id";

/**
 * Permissive UUID-shape check (8-4-4-4-12 hex, RFC 4122 variant bits in the
 * 17th position). Accepts v1-v8 so a future move to v7 (sortable) doesn't
 * break this guard. Server re-validates with the same regex — this is
 * defence-in-depth against a tampered localStorage value being sent as a
 * header (e.g. a user who manually edited the value to `"<script>"`).
 */
function isValidUuidShape(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

let cached: string | null = null;

/**
 * Returns the persistent device ID for this browser, generating + storing
 * one on first call. Subsequent calls in the same page return the cached
 * value without touching localStorage.
 *
 * Edge cases handled:
 *   - localStorage disabled / quota exceeded / Safari Private Browsing →
 *     returns a transient UUID for this page load (server still treats it
 *     as a stable device for the duration of the session). Next page load
 *     will try again.
 *   - localStorage value tampered with / corrupted to non-UUID shape →
 *     replaced with a fresh UUID (and the user gets one "new device login"
 *     alert, which is the correct security signal — something modified
 *     their device identity).
 *   - `crypto.randomUUID` unavailable (very old browsers) → falls back to
 *     a Math.random-based UUID. Quality is lower but still effectively
 *     unique within the user base. Modern browsers (Chrome 92+, Safari
 *     15.4+, Firefox 95+) all have native randomUUID.
 */
export function getOrCreateDeviceId(): string {
  if (cached) return cached;

  // Generate a fresh UUID using the best available source.
  const generate = (): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Math.random fallback — RFC 4122 v4 layout with reduced entropy.
    // Only reached on browsers older than Qorix officially supports.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    // SSR / Node test path — emit a transient module-cached UUID.
    cached = generate();
    return cached;
  }

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage access threw (Safari Private Browsing in some versions,
    // disabled storage, sandboxed iframe). Treat as missing.
    stored = null;
  }

  if (!stored || !isValidUuidShape(stored)) {
    stored = generate();
    try {
      localStorage.setItem(STORAGE_KEY, stored);
    } catch {
      // Quota / disabled — proceed with the in-memory ID for this session.
    }
  }

  cached = stored;
  return stored;
}

/**
 * Test-only hook to clear the in-memory cache. Production code never needs
 * this — the cache lives for the lifetime of the page anyway.
 */
export function _resetDeviceIdCacheForTests(): void {
  cached = null;
}
