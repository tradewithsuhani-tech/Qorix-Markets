// Admin IP allowlist (opt-in via ADMIN_IP_ALLOWLIST env var).
//
// Why this exists (B28 fintech hardening):
//   /api/admin/* routes are already gated by:
//     1. authMiddleware     — valid JWT required
//     2. adminMiddleware    — `users.is_admin` flag must be true
//     3. requireAdminPermission — RBAC check against admin_permissions
//   That's three deep gates — but if an admin's password and 2FA TOTP
//   are ever leaked (phishing, malware, social engineering), all three
//   fall in one go. Adding an IP allowlist as a FOURTH layer means an
//   attacker also needs to be on the operator's network or VPN to ever
//   reach the auth check.
//
//   This is the standard "operator console" defense in fintech:
//     stripe-dashboard / fly.io's flyctl / aws console — all support
//     restricting admin access to a list of trusted IPs / CIDRs.
//
// Behaviour:
//   - If ADMIN_IP_ALLOWLIST env is unset or empty: NO-OP. The middleware
//     calls next() immediately. This preserves current production
//     behavior — operators can opt in later without a code change by
//     just setting the env var via `flyctl secrets set` and redeploying.
//   - If set to a comma-separated list of IPv4 / IPv6 addresses:
//       * req.ip (resolved via app.set("trust proxy", 1) in app.ts so
//         it's the real client IP, not the Fly edge IP) is checked
//         against the list.
//       * Match → pass through to authMiddleware.
//       * No match → 403 ADMIN_IP_BLOCKED, request never reaches
//         authMiddleware. Logged as warn for ops alerting.
//
// Limitations / future work:
//   - CIDR ranges are NOT yet supported (just exact IP matches). For now
//     operators must add each office IP individually. Adding CIDR
//     parsing is straightforward but introduces a dep (`ip-cidr` or
//     `ipaddr.js`); deferred until needed.
//   - IPv6 must be passed in the same form Express resolves it (e.g.
//     "::1" not "0:0:0:0:0:0:0:1"). Test with the actual Fly egress IP
//     before locking down.

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

function parseAdminAllowlist(): ReadonlySet<string> {
  const raw = process.env["ADMIN_IP_ALLOWLIST"]?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean),
  );
}

// Computed once at module load — the env value cannot change without a
// process restart on Fly anyway (secrets are baked into the runtime
// environment), so re-reading on every request would just waste CPU.
const ALLOWLIST = parseAdminAllowlist();

export const adminIpAllowlistEnabled = ALLOWLIST.size > 0;

export function adminIpAllowlist(req: Request, res: Response, next: NextFunction): void {
  if (ALLOWLIST.size === 0) {
    // Opt-in not configured — no-op, preserve current behavior.
    next();
    return;
  }

  const clientIp = req.ip;
  if (clientIp && ALLOWLIST.has(clientIp)) {
    next();
    return;
  }

  // Surface the rejection at warn level so ops can spot real attacks vs
  // legitimate operators on a new IP. We DO NOT log the full IP at info
  // level by default to avoid spamming logs with every benign mismatch.
  logger.warn(
    {
      method: req.method,
      url: req.url,
      ip: clientIp,
    },
    "admin IP allowlist rejected request",
  );

  res.status(403).json({
    error: "Administrative endpoints are restricted to operator IP addresses.",
    code: "ADMIN_IP_BLOCKED",
  });
}
