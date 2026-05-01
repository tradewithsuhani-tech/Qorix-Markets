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

// B36: refresh-token persistence. Stored as plaintext alongside the
// access token because /oauth/quiz/refresh needs the original string
// to hash and look up server-side. Same XSS exposure as the access
// token — accepted for the same trade-off (single-origin SPA, strict
// CSP, no innerHTML).
const REFRESH_TOKEN_KEY = "qorixplay_refresh_token";
const REFRESH_TOKEN_EXPIRES_AT_KEY = "qorixplay_refresh_token_expires_at";

export type StoredToken = {
  accessToken: string;
  expiresAt: number; // unix ms
};

export type StoredRefreshToken = {
  refreshToken: string;
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

// ─── Refresh token (B36) ──────────────────────────────────────────────────

/**
 * Persist a refresh token returned by /token-public or /refresh.
 * Same `expiresIn`-as-seconds contract as `storeToken` so callers
 * don't have to remember which is wall-clock-ms and which is delta.
 */
export function storeRefreshToken(
  refreshToken: string,
  expiresInSec: number,
): void {
  if (
    typeof refreshToken !== "string" ||
    refreshToken.length === 0 ||
    !Number.isFinite(expiresInSec) ||
    expiresInSec <= 0
  ) {
    throw new Error("storeRefreshToken: invalid token or expiry");
  }
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(
      REFRESH_TOKEN_EXPIRES_AT_KEY,
      String(Date.now() + expiresInSec * 1000),
    );
  } catch {
    // Quota / private mode → user gets the 1h access window only and
    // has to re-login after that. Same degradation as the access path.
  }
}

/**
 * Read the current refresh token if present and unexpired. Returns
 * null otherwise so callers don't have to track expiry.
 */
export function readRefreshToken(): StoredRefreshToken | null {
  let token: string | null;
  let expiresAtRaw: string | null;
  try {
    token = localStorage.getItem(REFRESH_TOKEN_KEY);
    expiresAtRaw = localStorage.getItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
  } catch {
    return null;
  }
  if (!token || !expiresAtRaw) return null;
  const expiresAt = Number.parseInt(expiresAtRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    clearRefreshToken();
    return null;
  }
  return { refreshToken: token, expiresAt };
}

export function clearRefreshToken(): void {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_EXPIRES_AT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Full sign-out: clear BOTH tokens. Use this on explicit user logout
 * or on an irrecoverable refresh failure (server says invalid_grant).
 * Distinct from `clearToken()` — that only clears the short-lived
 * access half, which the refresh helper does mid-rotation.
 */
export function clearAllAuth(): void {
  clearToken();
  clearRefreshToken();
}
