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

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const PATH_EXEMPTIONS = new Set([
  "/api/healthz",
  "/api/version",
  "/api/version.json",
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

  // Dev / test mode where no allowlist is configured: behave like the
  // permissive cors() default in app.ts and pass through. This keeps
  // local development and the smoke-test suite working without
  // forcing a CORS_ORIGIN value.
  const allowed = parseAllowedOrigins();
  if (!allowed || allowed.length === 0) {
    next();
    return;
  }

  const origin = (req.headers["origin"] as string | undefined)?.trim();
  if (origin && allowed.includes(origin)) {
    next();
    return;
  }

  // Some browsers / proxies strip the Origin header on certain navigations
  // but preserve Referer. Accept Referer as a fallback if its origin
  // matches the allowlist.
  const refererOrigin = originFromReferer(req.headers["referer"] as string | undefined);
  if (refererOrigin && allowed.includes(refererOrigin)) {
    next();
    return;
  }

  res.status(403).json({
    error: "Direct API access is not allowed. Requests must originate from the official Qorix Markets web app.",
    code: "ORIGIN_REQUIRED",
  });
}
