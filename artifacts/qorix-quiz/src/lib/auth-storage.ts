// Single source of truth for the Qorix Markets access-token + identity
// the SPA holds locally after a successful OAuth handshake.
//
// Storage choice: localStorage. Trade-offs we accepted:
//   + Survives tab refresh and "open in new tab" flows that quiz play
//     screens will rely on (results page, leaderboard).
//   + Simpler than juggling http-only cookies between two Fly apps.
//   - Subject to XSS exfil if we ever ship an unsanitized HTML render.
//     Mitigated by being strict about React jsx-only rendering, no
//     dangerouslySetInnerHTML anywhere in this app, and a CSP that
//     forbids inline scripts (set on the API origin already, and the
//     static host's index.html serves only our bundled JS).
//
// All keys are namespaced with `qorixplay_` so they never collide with
// localStorage keys the Markets SPA writes (it uses `qorix_` for its
// own JWT). Each Fly app is on a different origin so there's no actual
// localStorage sharing — but the prefix makes intent unambiguous if we
// ever co-host them.

const ACCESS_TOKEN_KEY = "qorixplay_access_token";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "qorixplay_access_token_expires_at";

export type StoredToken = {
  accessToken: string;
  expiresAt: number; // unix ms
};

/**
 * Persist a freshly-minted access token. `expiresIn` is the number of
 * seconds the API said the token is good for — we convert to an
 * absolute wall-clock ms so a closed/reopened tab doesn't have to
 * remember when "now" was at storage time.
 */
export function storeToken(accessToken: string, expiresInSec: number): void {
  if (
    typeof accessToken !== "string" ||
    accessToken.length === 0 ||
    !Number.isFinite(expiresInSec) ||
    expiresInSec <= 0
  ) {
    // Refuse to write garbage — better to fail loudly during dev than
    // silently store a malformed token and fight a NaN bug later.
    throw new Error("storeToken: invalid token or expiry");
  }
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(
      ACCESS_TOKEN_EXPIRES_AT_KEY,
      String(Date.now() + expiresInSec * 1000),
    );
  } catch {
    // Quota / private mode → token simply isn't persisted; user will
    // re-login next page load. Acceptable degradation.
  }
}

/**
 * Read the current token if present and unexpired. Returns null in any
 * other case so callers can use a single nullish check instead of
 * checking expiry themselves.
 */
export function readToken(): StoredToken | null {
  let token: string | null;
  let expiresAtRaw: string | null;
  try {
    token = localStorage.getItem(ACCESS_TOKEN_KEY);
    expiresAtRaw = localStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  } catch {
    return null;
  }
  if (!token || !expiresAtRaw) return null;
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    // Auto-clear so the next read doesn't keep tripping the same check.
    clearToken();
    return null;
  }
  return { accessToken: token, expiresAt };
}

export function clearToken(): void {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  } catch {
    // ignore
  }
}
