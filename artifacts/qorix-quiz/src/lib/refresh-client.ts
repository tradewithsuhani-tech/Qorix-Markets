// B36 — transparent access-token refresh.
//
// Anyone fetching from the Qorixplay API should call `getValidAccessToken()`
// instead of reading the token directly. It returns a non-expired access
// token, refreshing in the background if the current one is within
// `REFRESH_AHEAD_MS` of expiry — so the user never sees a 401 just because
// they kept a tab open for 70 minutes.
//
// Concurrency contract: ALL concurrent callers during one refresh share the
// SAME in-flight promise. Without this, opening 5 quiz cards at once
// produces 5 simultaneous /refresh round-trips, each one rotating the
// refresh_token and burning the previous — only the last winner ends up
// with a valid pair, the other 4 get `invalid_grant` and the user is
// kicked out for no reason.

import { API_URL, CLIENT_ID } from "./oauth-config";
import {
  clearAllAuth,
  readRefreshToken,
  readToken,
  storeRefreshToken,
  storeToken,
} from "./auth-storage";

// Pre-emptive refresh window. If the access token expires within this
// many ms, treat it as already-expired and rotate. 5 minutes is large
// enough to absorb a slow Fly cold-start round-trip without making
// every request feel laggy on a fresh login (which still has ~55min
// before this kicks in).
const REFRESH_AHEAD_MS = 5 * 60 * 1000;

type RefreshResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  scope?: string;
};

type RefreshErrorBody = {
  error?: string;
  message?: string;
};

// Single in-flight promise — set when a refresh starts, cleared when it
// settles. Any caller during that window awaits the same promise.
let inFlight: Promise<string | null> | null = null;

/**
 * Resolve to a valid access token (string) or `null` if there is no
 * way to obtain one without re-authenticating the user. Callers that
 * receive `null` should redirect to the landing page so the user can
 * click "Sign in" again.
 *
 * NEVER throws on network failures — those resolve to `null` so the
 * UI can render a "couldn't reach server" state instead of an unhandled
 * promise rejection.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const current = readToken();
  if (current && current.expiresAt > Date.now() + REFRESH_AHEAD_MS) {
    // Plenty of time left — fast path, no network.
    return current.accessToken;
  }

  // Need a refresh. Return the in-flight promise if one is already
  // running, otherwise start it.
  if (inFlight) return inFlight;
  inFlight = doRefresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doRefresh(): Promise<string | null> {
  const refresh = readRefreshToken();
  if (!refresh) {
    // No refresh token at all — caller must redirect to /sign-in.
    // We deliberately do NOT clear the (likely-expired) access token
    // here; the existing `readToken()` self-clear path handles it.
    return null;
  }

  let resp: Response;
  try {
    resp = await fetch(`${API_URL}/api/oauth/quiz/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refresh.refreshToken,
        client_id: CLIENT_ID,
      }),
    });
  } catch {
    // Network failure — keep both tokens so a retry on the next call
    // (or after the user fixes their connection) can still succeed.
    // The access token may still be technically valid for a few more
    // minutes (we refresh ahead of expiry), so returning that is
    // better than null.
    const stillValid = readToken();
    return stillValid ? stillValid.accessToken : null;
  }

  const body: RefreshResponse | RefreshErrorBody = await resp
    .json()
    .catch(() => ({ error: "invalid_response" }));

  if (!resp.ok || !("access_token" in body)) {
    const errBody = body as RefreshErrorBody;
    // invalid_grant means the server rejected the refresh token
    // (expired, revoked, reused, or replaced). Wipe both tokens so
    // the UI redirects to sign-in instead of looping forever.
    if (errBody.error === "invalid_grant") {
      clearAllAuth();
      return null;
    }
    // Other failure (5xx, network glitch, malformed response) — keep
    // tokens, return whatever access token we have left.
    const stillValid = readToken();
    return stillValid ? stillValid.accessToken : null;
  }

  // Success — persist the new pair atomically. Order matters: store
  // refresh first so a crash between the two writes still leaves us
  // with a usable rotation chain (worst case the user re-logs in).
  storeRefreshToken(body.refresh_token, body.refresh_expires_in);
  storeToken(body.access_token, body.expires_in);
  return body.access_token;
}
