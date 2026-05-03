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
import { issueCsrfToken } from "./lib/csrf-token";
import { peekLocalHeartbeat } from "./lib/worker-heartbeat-service";
// OpenAPI spec bundled as a string at build time via esbuild's
// '.yaml': 'text' loader (see build.mjs). Served by /api/openapi.yaml +
// /api/docs (Scalar UI) below. Module declaration in src/yaml.d.ts.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — resolved at build time by esbuild's text loader
import openapiYamlContent from "../../../lib/api-spec/openapi.yaml";

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
        // BP: do NOT throw — that bubbles to 500. Returning false here
        // skips the ACAO header (browser blocks the response on its end);
        // the subsequent originGuard middleware then issues a clean 403.
        return cb(null, false);
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

// ─── Worker self-health probe (Task #135) ─────────────────────────────────
// Mounted alongside /api/healthz so Fly's per-process [[checks]] block can
// hit it directly on the worker VM's internal port (8080). The endpoint
// returns 200 only while the in-process heartbeat loop has written a beat
// in the last WORKER_BEAT_MAX_AGE_MS. If the loop wedges (cron tick stuck
// inside Node, event-loop blocked, etc.) the probe flips to 503 and Fly
// restarts the machine — which is exactly the auto-recovery behaviour the
// 2026-05-01 incident lacked.
//
// Behaviour by process group:
//   - worker  → returns 200 once first heartbeat is written, then tracks
//               freshness; flips to 503 if the loop stalls.
//   - app     → no heartbeat loop runs here (we don't write fake beats
//               from web), so peekLocalHeartbeat() === null → returns 200
//               with status:"not_applicable". Fly would never probe this
//               on the app group anyway, but a stray manual curl from
//               another process group should not 503.
const WORKER_BEAT_MAX_AGE_MS = 3 * 60_000;
const WORKER_BEAT_BOOT_GRACE_MS = 2 * 60_000;
const appBootedAt = Date.now();
app.get("/api/worker-healthz", (_req, res) => {
  const lastBeat = peekLocalHeartbeat();
  if (lastBeat === null) {
    // No beat yet. On the worker this happens during the boot window
    // before the first beat write completes — Fly's grace_period
    // (configured in fly.toml) covers this. Beyond the grace window,
    // returning 503 lets Fly recycle a worker that imported but never
    // managed to write its first beat (e.g. DB unreachable on boot).
    if (Date.now() - appBootedAt < WORKER_BEAT_BOOT_GRACE_MS) {
      res.json({ status: "not_applicable", lastBeatAt: null });
      return;
    }
    res.status(503).json({
      status: "no_heartbeat",
      lastBeatAt: null,
      bootedAt: new Date(appBootedAt).toISOString(),
    });
    return;
  }
  const ageMs = Date.now() - lastBeat;
  if (ageMs > WORKER_BEAT_MAX_AGE_MS) {
    res.status(503).json({
      status: "stale",
      lastBeatAt: new Date(lastBeat).toISOString(),
      ageMs,
      maxAgeMs: WORKER_BEAT_MAX_AGE_MS,
    });
    return;
  }
  res.json({
    status: "ok",
    lastBeatAt: new Date(lastBeat).toISOString(),
    ageMs,
  });
});

// ─── B30 L6: CSRF token issuance endpoint ──────────────────────────────────
// GET /api/csrf — returns a short-lived HMAC-signed token that the web app
// must include as X-CSRF-Token on every state-changing request once the
// originGuard CSRF gate is enabled (CSRF_HMAC_SECRET set).
//
// Public, no auth required: registration is anonymous, so an unauthenticated
// browser must be able to obtain a token before the very first POST.
//
// Cheap: pure crypto, no DB hit. Listed in originGuard PATH_EXEMPTIONS so a
// client that has no token can still call this endpoint to bootstrap.
//
// Response shape: { enabled: boolean, token: string|null, expiresAt: string|null }
//   - enabled=false  -> CSRF feature is currently OFF on the server
//                       (CSRF_HMAC_SECRET unset). Client may treat as
//                       "no token needed".
//   - enabled=true   -> token + ISO 8601 expiresAt populated. Client should
//                       cache in memory and attach as X-CSRF-Token header.
//
// Caching: explicit no-store + Vary on User-Agent. Tokens are bound to UA;
// a CDN that cached one user's token and served it to a different UA would
// force every recipient into CSRF_UA_MISMATCH 403s.
//
// Rate limiting: this endpoint is registered AFTER `app.use("/api",
// globalApiLimiter)` below so that it inherits the same per-IP rate limit
// as every other /api endpoint. Without this ordering, /api/csrf would be
// effectively unthrottled at the app layer — cheap pure-crypto, but still
// a reachable CPU surface for spray traffic if edge controls are weak.
// (B30.1 fix — caught by architect review.)
//
// Search marker: APP_TS_CSRF_ENDPOINT_REGISTERED_BELOW_GLOBAL_LIMITER

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
  if (
    req.path === "/api/healthz" ||
    req.path === "/healthz" ||
    req.path === "/api/worker-healthz" ||
    req.path === "/worker-healthz"
  ) return next();
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

// ─── B30 L6: CSRF token issuance endpoint ──────────────────────────────────
// Registered HERE — after globalApiLimiter — so spray traffic on /api/csrf
// is throttled by the same per-IP bucket as every other /api endpoint.
// (Architect-flagged in B30 review: previously registered above the
// limiter and was effectively unthrottled.)
//
// Public, no auth required: registration is anonymous, so an unauthenticated
// browser must be able to obtain a token before its very first POST.
//
// Cheap: pure crypto, no DB hit. Listed in originGuard PATH_EXEMPTIONS so a
// client that has no token can still call this endpoint to bootstrap.
//
// Caching headers: explicit no-store + Vary: User-Agent. Tokens are bound
// to UA; a CDN that cached one user's token and served it to a different
// UA would force every recipient into CSRF_UA_MISMATCH 403s.
app.get("/api/csrf", (req, res) => {
  const ua = req.headers["user-agent"] as string | undefined;
  const issued = issueCsrfToken(ua);
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Vary", "User-Agent");
  if (!issued) {
    res.json({ enabled: false, token: null, expiresAt: null });
    return;
  }
  res.json({ enabled: true, token: issued.token, expiresAt: issued.expiresAt });
});

// ─── Public API documentation (Batch BH) ──────────────────────────────────
// Two routes that together expose the full OpenAPI 3 specification of this
// server in both raw + browsable form. Mounted here (after CSRF, before the
// authenticated /api/* router tree) so they inherit the global rate limit
// but require neither auth nor a CSRF token — public docs are intentional,
// just like Stripe / Twilio / GitHub. Mobile clients (and the third-party
// mobile dev currently integrating) need a single canonical reference URL
// they can hit from a browser, curl, or codegen tool without credentials.
//
// GET /api/openapi.yaml  → raw spec (text/yaml). Bundled at build time via
//                          esbuild's ".yaml": "text" loader, so the file
//                          ships INSIDE dist/index.mjs as a string — zero
//                          runtime fs reads, zero risk of "file not found"
//                          when the container WORKDIR differs from dev.
// GET /api/docs          → Scalar API Reference UI (single-page HTML that
//                          loads /api/openapi.yaml). Pure CDN — no npm
//                          install, no extra bundle weight. Includes
//                          search, deep links, request/response samples,
//                          and copy-paste curl/Kotlin/Swift snippets,
//                          which is exactly what the mobile dev needs.
app.get("/api/openapi.yaml", (_req, res) => {
  res.setHeader("Content-Type", "application/yaml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(openapiYamlContent as unknown as string);
});
app.get("/api/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Qorix Markets API — Mobile Developer Reference</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%A1%3C/text%3E%3C/svg%3E" />
  <style>body{margin:0;background:#0a0a0a;}</style>
</head>
<body>
  <script id="api-reference" data-url="/api/openapi.yaml" data-configuration='{"theme":"purple","darkMode":true,"layout":"modern","showSidebar":true,"hideClientButton":false,"defaultHttpClient":{"targetKey":"shell","clientKey":"curl"}}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

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
