// Client-side CSRF token cache + auto-fetch helper.
//
// Shared across authFetch and merchantAuthFetch (and any other future
// state-changing fetch wrapper). The token is bound to the browser's
// User-Agent server-side, so a single in-memory cache per tab is fine
// — there is no per-user-account binding.
//
// Behaviour:
//   - First state-changing call: cache is empty -> fetch GET /api/csrf
//     -> cache the token + expiry -> caller attaches X-CSRF-Token.
//   - Subsequent calls: serve from cache as long as expiresAt is in
//     the future (with a 60s safety margin so we don't race a
//     just-expired token across the network).
//   - Server returns enabled:false (CSRF feature disabled) -> we cache
//     a sentinel "no token needed" entry and skip attaching the header
//     until the cache evicts (also TTL-cached, but for 5 minutes so we
//     re-check whether the operator has flipped the feature on).
//   - On any 403 with code in {CSRF_REQUIRED, CSRF_INVALID, CSRF_EXPIRED,
//     CSRF_BAD_SIG, CSRF_UA_MISMATCH, CSRF_MALFORMED} the caller should
//     call invalidateCsrfToken() and retry once. The fetch wrappers
//     (auth-fetch.ts, merchant-auth-fetch.ts) implement that retry.

const CSRF_HEADER = "X-CSRF-Token";

// Server-issued tokens have a 1h TTL; refresh 60s before expiry to
// avoid a race where the cached token expires mid-flight.
const REFRESH_MARGIN_MS = 60_000;

// When the server reports enabled:false, cache that fact for 5 minutes
// before re-checking. Keeps cost low if CSRF is permanently off, but
// re-syncs within 5min if the operator flips it on mid-session.
const DISABLED_RECHECK_MS = 5 * 60_000;

const BASE_URL = (typeof import.meta !== "undefined" && (import.meta as any).env?.BASE_URL) || "/";

type CacheEntry =
  | { kind: "token"; token: string; expiresAtMs: number }
  | { kind: "disabled"; recheckAtMs: number };

let cache: CacheEntry | null = null;
let inFlight: Promise<CacheEntry> | null = null;

function isFresh(entry: CacheEntry, now: number): boolean {
  if (entry.kind === "token") {
    return entry.expiresAtMs - REFRESH_MARGIN_MS > now;
  }
  return entry.recheckAtMs > now;
}

async function fetchAndCache(): Promise<CacheEntry> {
  // Use absolute path through BASE_URL so the request goes through the
  // web app's reverse proxy to the API. Same pattern every other web
  // app fetch uses.
  const url = `${BASE_URL}api/csrf`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    // Server hiccup -> brief recheck so we don't keep slamming a
    // failing endpoint, but recover quickly once it's back.
    const entry: CacheEntry = { kind: "disabled", recheckAtMs: Date.now() + 30_000 };
    cache = entry;
    return entry;
  }
  const body = (await res.json()) as { enabled?: boolean; token?: string | null; expiresAt?: string | null };
  if (!body.enabled || !body.token || !body.expiresAt) {
    const entry: CacheEntry = { kind: "disabled", recheckAtMs: Date.now() + DISABLED_RECHECK_MS };
    cache = entry;
    return entry;
  }
  const entry: CacheEntry = {
    kind: "token",
    token: body.token,
    expiresAtMs: new Date(body.expiresAt).getTime(),
  };
  cache = entry;
  return entry;
}

async function getEntry(): Promise<CacheEntry> {
  const now = Date.now();
  if (cache && isFresh(cache, now)) return cache;
  // Coalesce concurrent callers onto a single in-flight request so a
  // page that fires 5 POSTs at once doesn't issue 5 GET /api/csrf calls.
  if (!inFlight) {
    inFlight = fetchAndCache().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Returns headers to merge into a state-changing fetch. Returns an empty
 * object when CSRF is disabled server-side, or a single-key object
 * `{ "X-CSRF-Token": "<token>" }` when enabled.
 */
export async function getCsrfHeaders(): Promise<Record<string, string>> {
  const entry = await getEntry();
  if (entry.kind === "token") {
    return { [CSRF_HEADER]: entry.token };
  }
  return {};
}

/**
 * Force the next call to refetch a fresh token. Call this on any 403
 * response carrying a CSRF_* error code.
 */
export function invalidateCsrfToken(): void {
  cache = null;
}

const CSRF_ERROR_CODES = new Set([
  "CSRF_REQUIRED",
  "CSRF_INVALID",
  "CSRF_EXPIRED",
  "CSRF_BAD_SIG",
  "CSRF_UA_MISMATCH",
  "CSRF_MALFORMED",
]);

/**
 * Inspect a fetch response to decide if it's worth one CSRF retry. The
 * caller (auth-fetch / merchant-auth-fetch) is responsible for actually
 * performing the retry (one attempt only, to avoid loops).
 */
export function isCsrfError(status: number, body: unknown): boolean {
  if (status !== 403) return false;
  if (!body || typeof body !== "object") return false;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" && CSRF_ERROR_CODES.has(code);
}
