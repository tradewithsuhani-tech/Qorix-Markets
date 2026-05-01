// Centralised URLs for the Qorix Markets ↔ Qorix Play OAuth handshake.
//
// These are deliberately *not* baked into individual call sites — when we
// stand up a staging environment (or migrate qorixplay.com to a different
// origin) the only file that has to change is this one.
//
// Resolution order:
//   1. Vite-time `VITE_MARKETS_URL` / `VITE_API_URL` if provided
//      (lets CI override per-environment without touching code).
//   2. `import.meta.env.DEV` → localhost defaults so a freshly cloned
//      monorepo "just works".
//   3. Production fallbacks → live domains.
//
// All URLs are returned WITHOUT a trailing slash so callers can append
// paths like `${MARKETS_URL}/oauth/quiz/authorize` without producing
// "//oauth/quiz/authorize" double-slashes that some hosts treat as a
// different path and 404 on.

function trimTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

const env = import.meta.env;

export const MARKETS_URL: string = trimTrailingSlash(
  (env.VITE_MARKETS_URL as string | undefined) ??
    (env.DEV ? "http://localhost:5000" : "https://qorixmarkets.com"),
);

export const API_URL: string = trimTrailingSlash(
  (env.VITE_API_URL as string | undefined) ??
    (env.DEV ? "http://localhost:8080" : "https://qorix-api.fly.dev"),
);

// The OAuth client_id this SPA identifies itself as to the Markets
// authorization endpoint. Currently a single hard-coded "qorixplay" — if
// we ever ship a second skin (e.g. an embedded white-label) it would get
// its own ID here and a matching allow-list entry on the API side.
export const CLIENT_ID = "qorixplay";

// The redirect_uri this SPA registers itself at. Must EXACTLY match one
// of the strings in QUIZ_OAUTH_ALLOWED_REDIRECT_URIS on the API server,
// or the authorize call will 400 with `invalid_redirect_uri`.
//
// We compute this from window.location so the URL works whether the SPA
// is served from qorix-quiz.fly.dev, qorixplay.com, or a future custom
// domain — without each environment needing its own VITE_ override.
export function getRedirectUri(): string {
  if (typeof window === "undefined") {
    // Should never happen in a browser-only flow, but TS-correct.
    return "https://qorix-quiz.fly.dev/auth/callback";
  }
  return `${window.location.origin}/auth/callback`;
}
