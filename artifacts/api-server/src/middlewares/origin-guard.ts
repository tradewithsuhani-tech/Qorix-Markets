// Origin/Referer guard for state-changing requests.
//
// Why this exists (B28 fintech hardening):
//   The `cors` middleware in app.ts only enforces the Origin header for
//   requests that *carry* one. A `curl -X POST /api/auth/register` with
//   no Origin header at all is allowed through (`if (!origin) return
//   cb(null, true)` — the "allow same-origin / curl / health probe"
//   carve-out is correct for legitimate health probes but accidentally
//   leaves the entire write surface exposed to scripted scrapers and
//   credential-stuffing bots that simply omit the header).
//
//   This middleware closes the gap by hard-requiring a recognised
//   Origin (or Referer) on every state-changing method (POST / PUT /
//   PATCH / DELETE). Browsers ALWAYS send Origin on cross-origin XHR
//   and fetch — so the legitimate qorixmarkets.com web app is
//   unaffected. Only non-browser direct-API attackers see the 403.
//
// Behaviour:
//   - HEAD/GET/OPTIONS  -> always pass through (idempotent reads,
//                          CORS preflight). Origin enforcement on
//                          GET would break health probes, robot
//                          fetches of public endpoints, and image
//                          loads.
//   - POST/PUT/PATCH/DELETE:
//       * If CORS_ORIGIN env is unset (dev/test) -> pass through
//         (matches the cors() permissive default in app.ts).
//       * If Origin header matches CORS_ORIGIN allowlist -> pass.
//       * Else if Referer's origin matches CORS_ORIGIN -> pass
//         (covers redirected POST flows where Origin may be null
//         but Referer is set).
//       * Else -> 403 ORIGIN_REQUIRED.
//   - Path exemptions: /api/healthz, /api/version are allowed
//     through on every method so load balancer probes and the
//     deployed-version watcher continue to work even on POST.
//
// Important: this middleware runs AFTER express's `trust proxy` is
// applied (set in app.ts) so req.ip is the real client IP, but
// origin/referer guarding is independent of req.ip.

import type { Request, Response, NextFunction } from "express";
import { verifyCsrfToken } from "../lib/csrf-token";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// IMPORTANT: this middleware is mounted via `app.use("/api", originGuard)`,
// so inside the handler `req.path` is MOUNT-RELATIVE (e.g. "/healthz"),
// not absolute ("/api/healthz"). We list both forms so the exemption
// matches whether the middleware is mounted at /api or at the root.
// (B30.1 — caught by architect review.)
const PATH_EXEMPTIONS = new Set([
  // Mount-relative (matches req.path under app.use("/api", ...)):
  "/healthz",
  "/version",
  "/version.json",
  "/csrf",
  // Qorixplay SSO token endpoint (B34) — server-to-server call from
  // qorixplay backend. No browser involved → no Origin header. Auth is
  // enforced inside the handler via constant-time client_secret check.
  "/oauth/quiz/token",
  // Absolute (matches req.path if remounted at root):
  "/api/healthz",
  "/api/version",
  "/api/version.json",
  "/api/csrf",
  "/api/oauth/quiz/token",
]);

function parseAllowedOrigins(): readonly string[] | null {
  const raw = process.env["CORS_ORIGIN"]?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function originFromReferer(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    const u = new URL(referer);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function originGuard(req: Request, res: Response, next: NextFunction): void {
  // Idempotent reads + preflight: pass through unconditionally.
  if (!STATE_CHANGING_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  // Path exemptions: health probes and version pings.
  if (PATH_EXEMPTIONS.has(req.path)) {
    next();
    return;
  }

  // ─── ORIGIN / REFERER CHECK ──────────────────────────────────────────────
  // Dev / test mode where no allowlist is configured: behave like the
  // permissive cors() default in app.ts and SKIP the origin check. We
  // intentionally do NOT early-return from the middleware here — we still
  // want the CSRF check below to run when CSRF_HMAC_SECRET is set, even
  // in dev/test. (B30.1 fix — was previously returning early, which
  // silently disabled CSRF whenever CORS_ORIGIN was unset.)
  const allowed = parseAllowedOrigins();
  if (allowed && allowed.length > 0) {
    const origin = (req.headers["origin"] as string | undefined)?.trim();
    // Some browsers / proxies strip Origin on certain navigations but
    // preserve Referer. Accept Referer as a fallback when its origin
    // matches the allowlist.
    const refererOrigin = originFromReferer(req.headers["referer"] as string | undefined);
    const originOk = (origin && allowed.includes(origin)) || (refererOrigin && allowed.includes(refererOrigin));
    if (!originOk) {
      res.status(403).json({
        error: "Direct API access is not allowed. Requests must originate from the official Qorix Markets web app.",
        code: "ORIGIN_REQUIRED",
      });
      return;
    }
  }

  // ─── B30 L6: HMAC CSRF nonce check ───────────────────────────────────────
  // Origin header is set automatically by the browser on cross-origin XHR
  // and fetch, but a non-browser attacker can trivially set it with
  // `-H 'Origin: https://qorixmarkets.com'`. The CSRF nonce raises the
  // bar: the attacker also has to GET /api/csrf, parse the response, and
  // carry the token on the subsequent POST. Most scripted scrapers don't
  // bother.
  //
  // Gate is OPT-IN via CSRF_HMAC_SECRET. When unset (current prod state)
  // verifyCsrfToken returns { ok: true, reason: "CSRF_DISABLED" } so this
  // block is a no-op. Operator opts in via flyctl secrets after the web
  // client has been deployed to attach the X-CSRF-Token header.
  const csrfToken = (req.headers["x-csrf-token"] as string | undefined)?.trim();
  const userAgent = req.headers["user-agent"] as string | undefined;
  const csrfResult = verifyCsrfToken(csrfToken, userAgent);
  if (!csrfResult.ok) {
    res.status(403).json({
      error: "Anti-replay token missing or invalid. Refresh the page and try again.",
      code: csrfResult.reason,
    });
    return;
  }

  next();
}
