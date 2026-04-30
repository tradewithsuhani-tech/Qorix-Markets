// Cloudflare origin pinning — only allow requests that came through our
// Cloudflare proxy.
//
// Why this exists (B29 fintech hardening, L5):
//   B28 added in-process defenses (helmet, originGuard, method allowlist,
//   admin IP allowlist). Those run *inside* the Fly server — meaning
//   every attacker request still consumes a Fly connection slot, an
//   express handler invocation, a rate-limit bucket lookup, and a small
//   amount of CPU. Under a real DDoS or sustained credential-stuffing
//   campaign, that "small" cost compounds fast.
//
//   The standard fintech mitigation is to put a managed edge proxy
//   (Cloudflare) IN FRONT of the origin. The proxy absorbs L3/L4
//   floods, runs WAF + bot-fight rules, and only forwards "clean"
//   traffic to Fly. But this only works if attackers can't simply
//   bypass the proxy by hitting Fly's public IP directly. Fly does
//   issue a public TCP listener — without origin pinning, a
//   determined attacker who learns the Fly IP can completely sidestep
//   Cloudflare.
//
//   This middleware closes the bypass. When CLOUDFLARE_ORIGIN_SECRET
//   is set, every /api/* request must carry an X-Origin-Auth header
//   matching the secret. Cloudflare adds the header via a Transform
//   Rule on every request that flows through the proxy; direct hits
//   to fly.dev cannot add it (they'd have to know the secret, which
//   only Cloudflare and Fly know).
//
//   Compared to mTLS / Authenticated Origin Pulls, the shared-secret
//   approach is simpler to deploy (no cert install on Fly side), at
//   the cost of being weakened if the secret leaks. Given the secret
//   never leaves the Cloudflare → Fly path and is rotatable in
//   seconds via two flyctl commands, the trade is worth it.
//
// Behaviour:
//   - CLOUDFLARE_ORIGIN_SECRET unset  -> pass through (current
//                                        behaviour; safe default
//                                        before user has set up
//                                        Cloudflare in front of the
//                                        API).
//   - CLOUDFLARE_ORIGIN_SECRET set    -> require X-Origin-Auth
//                                        header to match exactly.
//                                        Mismatch / missing -> 403
//                                        ORIGIN_PIN_REQUIRED.
//
// Path exemptions (CRITICAL — do NOT remove without coordinating
// with Fly LB config):
//   - /api/healthz    Fly's load balancer probes the origin
//                     DIRECTLY (it does not route through Cloudflare).
//                     If this path required X-Origin-Auth, every
//                     health probe would fail and Fly would mark the
//                     instance unhealthy and pull it from rotation.
//   - /api/version    Same reasoning — internal monitoring scripts
//                     hit the origin directly.
//
// Rotation playbook:
//   1. Generate new secret:  openssl rand -hex 32
//   2. Cloudflare: Rules → Transform Rules → "Add X-Origin-Auth header"
//      → Edit → Set static value to the new secret. Save.
//   3. Fly: flyctl secrets set CLOUDFLARE_ORIGIN_SECRET=<new> -a qorix-api
//   4. Wait for rolling deploy to complete.
//   5. Verify: curl https://qorix-api.fly.dev/api/healthz still 200,
//      curl https://qorixmarkets.com/api/healthz still 200.

import type { Request, Response, NextFunction } from "express";

// IMPORTANT: this middleware is mounted via `app.use("/api", cloudflarePin)`,
// so inside the handler `req.path` is the MOUNT-RELATIVE subpath (e.g.
// "/healthz"), not the absolute URL ("/api/healthz"). We list both the
// mount-relative form (what req.path actually contains at runtime) AND the
// absolute form (in case this middleware is ever remounted at the app
// root) so the exemption matches in either configuration. Without this
// fix, enabling CLOUDFLARE_ORIGIN_SECRET would 403 every Fly LB health
// probe (which hits /healthz directly, not via Cloudflare) and pull the
// instance out of rotation. (B30.1 — caught by architect review.)
const PATH_EXEMPTIONS = new Set<string>([
  "/healthz",
  "/version",
  "/version.json",
  "/api/healthz",
  "/api/version",
  "/api/version.json",
]);

export function cloudflarePin(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["CLOUDFLARE_ORIGIN_SECRET"]?.trim();

  // No secret configured -> pin is opt-in, behave as no-op. This is the
  // default state both locally and in prod until the operator has set
  // up Cloudflare in front of qorix-api.fly.dev.
  if (!secret) {
    next();
    return;
  }

  // Path exemptions: Fly's load balancer hits these endpoints DIRECTLY
  // and cannot add X-Origin-Auth. Letting them through unconditionally
  // is what keeps Fly health checks green even with the pin enabled.
  if (PATH_EXEMPTIONS.has(req.path)) {
    next();
    return;
  }

  const header = (req.headers["x-origin-auth"] as string | undefined)?.trim();
  if (!header || header !== secret) {
    res.status(403).json({
      error: "Direct API access is not allowed. Requests must transit the Qorix Markets edge proxy.",
      code: "ORIGIN_PIN_REQUIRED",
    });
    return;
  }

  next();
}
