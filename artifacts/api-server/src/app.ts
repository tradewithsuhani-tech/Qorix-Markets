import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { maintenanceMiddleware, peekMaintenanceState } from "./middlewares/maintenance";
import { globalApiLimiter } from "./middlewares/rate-limit";
import { originGuard } from "./middlewares/origin-guard";
import { cloudflarePin } from "./middlewares/cloudflare-pin";
import { adminIpAllowlist, adminIpAllowlistEnabled } from "./middlewares/admin-ip-allowlist";
import { getCaptchaProvider } from "./lib/captcha-service";

const app: Express = express();

// Trust the first proxy hop. Replit (deploys & dev preview) terminates TLS at
// the edge proxy and forwards X-Forwarded-For/Proto/Host headers. Without this,
// express-rate-limit and req.ip read the proxy address instead of the client,
// and rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. Setting `1` is
// safe here because we only ever sit behind exactly one Replit proxy hop.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── B28 L3: HTTP method allowlist ─────────────────────────────────────────
// Reject exotic verbs (TRACE, CONNECT, custom methods) that no legitimate
// client of this API ever sends. TRACE in particular has historical XSS
// implications via Cross-Site Tracing; blocking it removes any chance of
// a future infra change accidentally re-enabling it. Mounted at the very
// top so a TRACE request doesn't even consume rate-limit budget.
const ALLOWED_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);
app.use((req, res, next) => {
  if (!ALLOWED_METHODS.has(req.method.toUpperCase())) {
    res.status(405).json({ error: "Method Not Allowed", code: "METHOD_NOT_ALLOWED" });
    return;
  }
  next();
});

// ─── B28 L1: Helmet security headers ───────────────────────────────────────
// Adds the standard set of defensive HTTP response headers fintech APIs
// are expected to ship:
//   - Strict-Transport-Security: lock browsers to HTTPS for 1y w/
//     subdomains. Fly already redirects HTTP → HTTPS via fly.toml
//     `force_https = true`, so the header is purely belt-and-braces.
//   - X-Content-Type-Options: nosniff — block MIME confusion attacks.
//   - X-Frame-Options: DENY — defeats clickjacking by refusing to be
//     iframed at all. The web app never embeds the API.
//   - Referrer-Policy: strict-origin-when-cross-origin — limits how
//     much of the request URL is leaked to third parties.
//   - X-DNS-Prefetch-Control: off — minor privacy hardening.
//   - Cross-Origin-Resource-Policy: same-site — blocks naive
//     embedding of API responses by other origins.
//
// Skipped on purpose:
//   - Content-Security-Policy: meaningful only for HTML responses;
//     our API only serves JSON. Helmet's default CSP would
//     interfere with the few image responses we do serve (e.g. the
//     slider-puzzle captcha PNG) without protecting anything real.
//   - Cross-Origin-Embedder-Policy: blocks the cross-origin XHR
//     pattern the web app actually uses; would break legitimate
//     traffic.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

// CORS — when the web app and api are served on different origins (Fly prod:
// qorixmarkets.com → api.qorixmarkets.com) the browser needs an explicit
// allow-list and `credentials: true` for cookie-based auth to work. In
// Replit dev the Vite proxy keeps everything same-origin so unsetting
// CORS_ORIGIN keeps the permissive default.
const corsOriginEnv = process.env["CORS_ORIGIN"]?.trim();
if (corsOriginEnv) {
  const allowedOrigins = corsOriginEnv
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl / health probes (no Origin header).
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`Origin ${origin} not allowed by CORS_ORIGIN`));
      },
      credentials: true,
    }),
  );
} else {
  app.use(cors());
}

// ─── B28 L2: Origin / Referer guard for state-changing requests ────────────
// Mounted on /api ONLY (so it never touches /healthz at the root) and
// BEFORE the body parsers so a 12MB no-Origin POST gets rejected with
// 403 ORIGIN_REQUIRED *without* the server first allocating + parsing a
// 12MB JSON body. This is the difference between an attacker costing
// us microseconds vs. tens of milliseconds + 12MB of RAM per blocked
// request, and matters for sustained scraping/abuse traffic.
//
// CORS still runs first because preflight OPTIONS responses must carry
// Access-Control-* headers regardless of the Origin guard outcome.
//
// Idempotent reads (GET/HEAD/OPTIONS) and a small set of path
// exemptions (healthz, version) pass through untouched. State-changing
// methods without a recognised Origin/Referer get 403 ORIGIN_REQUIRED.
// See origin-guard.ts for full rationale.
//
// Net effect: a `curl -X POST https://qorix-api.fly.dev/api/auth/register`
// with no Origin header is rejected at the edge before body parse,
// rate-limit budget consumption, captcha verification, or DB lookup.
app.use("/api", originGuard);

// ─── B29 L5: Cloudflare origin pin (opt-in via CLOUDFLARE_ORIGIN_SECRET) ───
// Mounted on /api ONLY and BEFORE body parsers, same reasoning as
// originGuard above: reject the request before allocating the body.
//
// Behaviour gate:
//   - CLOUDFLARE_ORIGIN_SECRET unset (current prod state) -> no-op
//     pass-through. Safe default until the operator has actually
//     placed Cloudflare in front of qorix-api.fly.dev and added the
//     matching X-Origin-Auth Transform Rule.
//   - CLOUDFLARE_ORIGIN_SECRET set -> every /api request must carry
//     X-Origin-Auth header matching the secret. Cloudflare adds the
//     header via Transform Rule on every proxied request; direct hits
//     to fly.dev (bypassing the proxy) cannot add it -> 403
//     ORIGIN_PIN_REQUIRED.
//
// Path exemptions: /api/healthz, /api/version. Fly's load balancer
// probes these endpoints directly (NOT through Cloudflare) and would
// otherwise be unable to mark the instance healthy. See cloudflare-pin.ts
// for the rotation playbook + full rationale.
app.use("/api", cloudflarePin);

app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health probe — mounted BEFORE every other middleware ──────────────────
// Fly's load balancer pulls an instance out of rotation if /api/healthz
// doesn't return 200 within `[[http_service.checks]].timeout` (5s in
// fly.toml). The maintenance middleware below is *almost* free (in-memory
// TTL cache) but on a cold cache it issues a DB SELECT, and during the
// 2026-04-28 incident that single query queued behind an exhausted pool
// for 80+ seconds — which is what produced the "no known healthy
// instances" cascade. A zero-dependency healthz handler mounted at the
// very top guarantees the probe ALWAYS returns immediately, regardless of
// DB / cache / cron state on this instance.
app.get("/api/healthz", (_req, res) => {
  // Best-effort: if the merged maintenance state is already in the in-memory
  // TTL cache, surface the X-Maintenance-Mode header so any client that
  // happened to poll healthz still sees the same banner-trigger marker that
  // every other /api response carries. We do NOT trigger a DB read here —
  // that's exactly what made healthz time out during the pool-exhaustion
  // incident. On cache miss we just return 200 ok; the next real /api
  // request will warm the cache via maintenanceMiddleware.
  const state = peekMaintenanceState();
  if (state?.active) {
    res.setHeader("X-Maintenance-Mode", "true");
    if (state.endsAt) res.setHeader("X-Maintenance-Ends-At", state.endsAt);
  }
  // captchaProvider exposed for B9.6 Phase 3 observability — lets a watcher
  // detect skew between this server and the served web bundle's baked-in
  // VITE_CAPTCHA_PROVIDER (also surfaced on /version.json).
  res.json({ status: "ok", captchaProvider: getCaptchaProvider() });
});

// ─── Request-level safety-net timeout ──────────────────────────────────────
// Server-side cap so a single stuck handler (DB pool starvation, runaway
// upstream HTTP call, etc.) cannot tie up a Node socket forever. We send
// a structured 503 to the client at 30s; the underlying DB query, if any,
// is killed sooner by `statement_timeout=10s` on the pg pool (lib/db).
// The handler may still finish in the background — `res.headersSent`
// guards against double-send — but the client gets a fast, predictable
// failure instead of a 200s wait.
//
// /healthz is exempted: a timed-out probe would trigger the very
// "no healthy instance" cascade this whole file is designed to prevent.
const REQUEST_TIMEOUT_MS = 30_000;
app.use((req, res, next) => {
  if (req.path === "/api/healthz" || req.path === "/healthz") return next();
  const t = setTimeout(() => {
    if (res.headersSent) return;
    logger.warn(
      { method: req.method, url: req.url, timeoutMs: REQUEST_TIMEOUT_MS },
      "Request exceeded server-side timeout — returning 503",
    );
    res
      .status(503)
      .json({ error: "Request timed out", code: "request_timeout" });
  }, REQUEST_TIMEOUT_MS);
  res.on("close", () => clearTimeout(t));
  res.on("finish", () => clearTimeout(t));
  next();
});

// ─── User-Agent Client Hints opt-in ───────────────────────────────────────
// Modern Chromium browsers (Chrome 89+, Edge 90+) freeze the User-Agent
// string under "UA Reduction" and instead expose granular device info via
// `Sec-CH-UA-*` request headers — but ONLY if the server explicitly opts
// in via `Accept-CH`. Without this header the admin Account Security
// drawer shows "Linux; Android 10; K" with model="K" instead of the real
// "Pixel 7" / "SM-S918B".
//
// What each header does:
// - `Accept-CH`: tells the browser which hints to send on FUTURE requests
//   to this origin. The browser caches this opt-in per-origin and starts
//   including the hints from the next request onward.
// - `Critical-CH`: a subset of `Accept-CH` that the browser will retry
//   the CURRENT request for if it didn't already include them — closes
//   the "first request after opt-in misses the hints" gap.
// - `Permissions-Policy`: explicitly delegates the hints to this origin
//   so cross-origin XHR (qorixmarkets.com → qorix-api.fly.dev) flows
//   them through. By default top-level documents have all hints enabled,
//   but being explicit is safer against future browser policy changes.
//
// Browser support reality:
// - Chrome / Edge / Brave / Samsung Internet on Android: full support →
//   we get the real model.
// - Chrome / Edge / Brave on Mac: hints supported but Apple still doesn't
//   expose a hardware model (privacy stance). OS version becomes precise
//   though ("14.4.1" instead of "10.15.7").
// - Safari (macOS + iOS): does NOT support UA-CH at all. iPhone / iPad /
//   Safari on Mac users will continue to surface only what their UA says.
// - Firefox: does NOT support UA-CH (intentional — privacy concerns).
//
// Mounted before the rate limiter so 429 responses also carry the opt-in
// (otherwise a rate-limited client never gets the chance to learn it).
const ACCEPT_CH_HINTS = [
  "Sec-CH-UA-Model",
  "Sec-CH-UA-Platform",
  "Sec-CH-UA-Platform-Version",
  "Sec-CH-UA-Mobile",
  "Sec-CH-UA-Full-Version-List",
  "Sec-CH-UA-Arch",
].join(", ");
const CRITICAL_CH_HINTS = "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version";
const PERMISSIONS_POLICY_CH = [
  "ch-ua-model=*",
  "ch-ua-platform=*",
  "ch-ua-platform-version=*",
  "ch-ua-mobile=*",
  "ch-ua-full-version-list=*",
  "ch-ua-arch=*",
].join(", ");
app.use((_req, res, next) => {
  res.setHeader("Accept-CH", ACCEPT_CH_HINTS);
  res.setHeader("Critical-CH", CRITICAL_CH_HINTS);
  res.setHeader("Permissions-Policy", PERMISSIONS_POLICY_CH);
  next();
});

// ─── Global per-IP rate limit (backstop) ──────────────────────────────────
// Mounted BEFORE the maintenance gate so a runaway client can't burn DB
// pool slots inside maintenanceMiddleware just to get rejected after the
// fact. Healthz is exempted inside the limiter (skip predicate). Per-route
// limiters in routes/auth.ts and routes/two-factor.ts run AFTER this one
// and apply stricter caps to sensitive endpoints (login, password reset,
// 2FA management).
app.use("/api", globalApiLimiter);

// ─── B28 L4: Admin IP allowlist (opt-in via ADMIN_IP_ALLOWLIST env) ───────
// Mounted BEFORE the per-router authMiddleware in routes/admin*.ts so a
// rejected IP never even consumes a JWT-verify CPU cycle. With the env
// unset (current state) this is a pure no-op pass-through; setting the
// env to a comma-separated IP list via `flyctl secrets set
// ADMIN_IP_ALLOWLIST=...` flips on the gate after the next deploy. See
// admin-ip-allowlist.ts for details.
//
// Logged once at startup so ops can confirm whether the gate is armed
// without grepping env vars on the running machine.
if (adminIpAllowlistEnabled) {
  logger.info(
    "B28: admin IP allowlist ARMED — only listed IPs may reach /api/admin",
  );
} else {
  logger.info(
    "B28: admin IP allowlist UNSET — /api/admin gated only by JWT + RBAC",
  );
}
app.use("/api/admin", adminIpAllowlist);

// Maintenance gate sits in front of every /api route. When MAINTENANCE_MODE=true
// (set as a Fly secret during the cutover window) it lets reads through with a
// header marker and rejects writes with a structured 503 — replacing the blunt
// "scale to zero machines → raw 503 on every request" approach in
// MUMBAI_DB_CUTOVER_RUNBOOK.md step 2.
app.use("/api", maintenanceMiddleware, router);

// ─── Centralised error logger ─────────────────────────────────────────────
// Express's built-in 500 handler swallows the underlying exception (sends a
// generic "Internal Server Error" HTML page and only writes to stderr in
// dev). When something inside an async route rejects we want the FULL stack
// trace surfaced through pino so it shows up in `fly logs` — without that,
// a route handler that throws appears in logs only as pino-http's outer
// "request errored, statusCode: 500" entry, which is useless for debugging.
//
// Mounted AFTER the routes so it only catches errors that propagated up
// from a handler. Must take 4 args for Express to recognise it as an error
// middleware. `_next` is unused but the signature is required.
app.use(
  (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    // Walk the .cause chain so wrapper errors (e.g. Drizzle's
    // "Failed query: ..." which puts the underlying postgres error in
    // err.cause) actually reveal the root reason in fly logs.
    const chain: Array<{ type: string; message: string; stack?: string; code?: string; detail?: string }> = [];
    let cur: unknown = err;
    let depth = 0;
    while (cur && depth < 5) {
      const c = cur instanceof Error ? cur : new Error(String(cur));
      const anyC = c as Error & { code?: unknown; detail?: unknown; cause?: unknown };
      chain.push({
        type: c.constructor.name,
        message: c.message,
        stack: c.stack,
        code: typeof anyC.code === "string" || typeof anyC.code === "number" ? String(anyC.code) : undefined,
        detail: typeof anyC.detail === "string" ? anyC.detail : undefined,
      });
      cur = anyC.cause;
      depth++;
    }
    logger.error(
      {
        err: chain[0],
        causeChain: chain.slice(1),
        route: `${req.method} ${req.path}`,
      },
      "unhandled route error",
    );
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal Server Error" });
  },
);

export default app;
