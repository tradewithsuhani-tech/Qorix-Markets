// PKCE (RFC 7636) helpers for the Qorix Play OAuth flow.
//
// We deliberately implement this from scratch in ~30 lines using Web
// Crypto rather than pulling a dependency: this code runs on every
// "Sign in with Markets" click on the landing page, so shipping a 30 kB
// auth library would dominate the bundle for a feature that's just a
// SHA-256 hash + base64url encode.
//
// Compatibility:
//   The matching server-side check (artifacts/api-server/src/routes/oauth-quiz.ts
//   /token-public handler) accepts ONLY method=S256 and a 43..128-char
//   verifier in the unreserved-charset regex [A-Za-z0-9-._~]+. Both
//   constraints are honoured here — generateCodeVerifier emits a 43-char
//   base64url string and generateCodeChallengeS256 hashes it.

const VERIFIER_BYTES = 32; // → 43 base64url chars (RFC 7636 §4.1 minimum)

/**
 * Encode a Uint8Array as base64url (RFC 4648 §5) — the OAuth/PKCE flavour
 * with `+` → `-`, `/` → `_`, and stripped `=` padding. We can't use
 * `btoa` directly because that's base64 standard, not url-safe.
 */
function base64urlEncode(bytes: Uint8Array): string {
  // String.fromCharCode + spread blows the stack on very large inputs,
  // but our inputs are 32 bytes (verifier) and 32 bytes (sha256), so a
  // simple loop is fine and cleaner than the typed-array dance.
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Cryptographically-random 32-byte verifier, base64url-encoded → 43
 * chars. Sits comfortably within the [43..128] window the API enforces.
 *
 * Throws if Web Crypto isn't available — in 2026 every browser has it,
 * but we throw rather than degrading to Math.random because a weak
 * verifier defeats the entire PKCE protection.
 */
export function generateCodeVerifier(): string {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error(
      "Web Crypto unavailable — refusing to generate weak PKCE verifier",
    );
  }
  const buf = new Uint8Array(VERIFIER_BYTES);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf);
}

/**
 * Compute the S256 PKCE challenge: BASE64URL(SHA256(verifier)).
 *
 * Note: the verifier is hashed as ASCII bytes — RFC 7636 §4.2 spells
 * this out — which TextEncoder("utf-8") yields for our base64url
 * alphabet (all chars are < 0x80).
 */
export async function generateCodeChallengeS256(
  verifier: string,
): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("SubtleCrypto unavailable — cannot compute PKCE S256");
  }
  const ascii = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", ascii);
  return base64urlEncode(new Uint8Array(digest));
}

/**
 * Generate a 16-byte random `state` parameter for CSRF protection.
 * 22-char base64url is plenty of entropy and stays well under any
 * reasonable URL length budget.
 */
export function generateState(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return base64urlEncode(buf);
}
