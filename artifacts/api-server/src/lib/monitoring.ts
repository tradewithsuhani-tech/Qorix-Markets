/**
 * lib/monitoring.ts — Production observability layer
 *
 * Covers:
 *  - Request latency histogram (in-memory ring buffer, no external deps)
 *  - Slow-response detection (>2 s logged as WARN, >5 s as ERROR)
 *  - Critical alert pipeline (Telegram, mirrors existing telegram.ts pattern)
 *  - SSE connection lifecycle events
 *  - Sentry-compatible error capture (gracefully no-ops if @sentry/node absent)
 */

import { logger } from "./logger";

// ─────────────────────────────────────────────────────────────────────────────
// Latency Histogram
// Ring-buffer of the last N response times per route prefix.
// Stored in process memory — accurate per-instance, not globally aggregated
// (use Redis if you need cluster-wide percentiles).
// ─────────────────────────────────────────────────────────────────────────────

const RING_SIZE = 500; // samples per bucket

type Bucket = {
  samples: number[];
  head: number;
  count: number;
};

const latencyBuckets = new Map<string, Bucket>();

function getBucket(route: string): Bucket {
  let b = latencyBuckets.get(route);
  if (!b) {
    b = { samples: new Array(RING_SIZE).fill(0) as number[], head: 0, count: 0 };
    latencyBuckets.set(route, b);
  }
  return b;
}

export function recordLatency(route: string, ms: number): void {
  const b = getBucket(route);
  b.samples[b.head] = ms;
  b.head = (b.head + 1) % RING_SIZE;
  b.count++;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx]!;
}

export function getLatencyStats(route: string) {
  const b = latencyBuckets.get(route);
  if (!b || b.count === 0) return null;
  const n = Math.min(b.count, RING_SIZE);
  const slice = b.samples.slice(0, n).filter((v) => v > 0);
  if (slice.length === 0) return null;
  const sorted = [...slice].sort((a, c) => a - c);
  return {
    samples: b.count,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

export function getAllLatencyStats(): Record<string, ReturnType<typeof getLatencyStats>> {
  const out: Record<string, ReturnType<typeof getLatencyStats>> = {};
  for (const [route] of latencyBuckets) {
    out[route] = getLatencyStats(route);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route prefix normalisation
// /api/wallet/deposit → /wallet/:id patterns don't fragment by user ID
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseRoute(url: string, method: string): string {
  // strip query string
  const path = url.split("?")[0] ?? url;
  // replace numeric segments: /orders/123 → /orders/:id
  const norm = path.replace(/\/\d+/g, "/:id");
  return `${method} ${norm}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slow request thresholds
// ─────────────────────────────────────────────────────────────────────────────

export const SLOW_WARN_MS = 2_000;
export const SLOW_ERROR_MS = 5_000;

export function logSlowResponse(
  method: string,
  url: string,
  durationMs: number,
  statusCode: number,
  userId?: number,
): void {
  const ctx = { method, url: url.split("?")[0], durationMs, statusCode, userId };
  if (durationMs >= SLOW_ERROR_MS) {
    logger.error(ctx, "[monitoring] CRITICAL slow response — exceeds 5s threshold");
    sendCriticalAlert(
      `🐢 *CRITICAL slow response* (${durationMs}ms)\n` +
        `Route: \`${method} ${ctx.url}\`\n` +
        `Status: ${statusCode}${userId ? `\nUser: ${userId}` : ""}`,
    ).catch(() => {});
  } else {
    logger.warn(ctx, "[monitoring] slow response — exceeds 2s threshold");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Critical Alert Pipeline — Telegram
// Mirrors the pattern already used in lib/telegram.ts / cron.ts
// Fails silently on missing env so dev environments are unaffected.
// ─────────────────────────────────────────────────────────────────────────────

const ALERT_CHAT_ID = process.env.MONITORING_TELEGRAM_CHAT_ID;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let alertCooldowns = new Map<string, number>(); // key → last sent ms

export async function sendCriticalAlert(
  message: string,
  dedupeKey?: string,
): Promise<void> {
  if (!BOT_TOKEN || !ALERT_CHAT_ID) return;

  // Deduplicate: same key suppressed for 5 min to avoid alert storms
  if (dedupeKey) {
    const last = alertCooldowns.get(dedupeKey);
    if (last && Date.now() - last < 5 * 60_000) return;
    alertCooldowns.set(dedupeKey, Date.now());
    // Prune old keys to prevent map growth
    if (alertCooldowns.size > 200) {
      const cutoff = Date.now() - 10 * 60_000;
      for (const [k, v] of alertCooldowns) {
        if (v < cutoff) alertCooldowns.delete(k);
      }
    }
  }

  try {
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ALERT_CHAT_ID,
          text: message,
          parse_mode: "Markdown",
          disable_notification: false,
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );
  } catch (err) {
    // Non-fatal — monitoring must never break the main request path
    logger.warn({ err }, "[monitoring] failed to send critical alert");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SSE Lifecycle Events
// ─────────────────────────────────────────────────────────────────────────────

const sseLog = logger.child({ module: "sse" });

export function logSseConnect(orderId: number, userId: number, totalClients: number): void {
  sseLog.info({ orderId, userId, totalClients }, "[sse] client connected");
}

export function logSseDisconnect(
  orderId: number,
  userId: number,
  durationMs: number,
  totalClients: number,
): void {
  sseLog.info(
    { orderId, userId, durationMs, totalClients },
    "[sse] client disconnected",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error capture (Sentry-compatible, graceful no-op if not installed)
// ─────────────────────────────────────────────────────────────────────────────

let _sentry: { captureException: (e: unknown, ctx?: object) => void } | null = null;

async function getSentry() {
  if (_sentry !== null) return _sentry;
  try {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) { _sentry = { captureException: () => {} }; return _sentry; }
    const Sentry = await import("@sentry/node" as string);
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
      sendDefaultPii: false,
    });
    _sentry = { captureException: (e, ctx) => Sentry.captureException(e, ctx as any) };
    logger.info("[monitoring] Sentry initialised");
  } catch {
    // @sentry/node not installed — no-op silently
    _sentry = { captureException: () => {} };
  }
  return _sentry;
}

// Fire-and-forget init at module load so it's ready by the time the first
// error occurs, not lazily on the first error.
getSentry().catch(() => {});

export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  const sentry = await getSentry();
  try {
    sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // never throw from monitoring
  }
  // Also log structured — Sentry is supplementary to pino, not a replacement
  logger.error({ err, ...context }, "[monitoring] exception captured");
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup summary
// ─────────────────────────────────────────────────────────────────────────────

export function logMonitoringStatus(): void {
  const hasSentry = !!process.env.SENTRY_DSN;
  const hasTelegramAlert = !!(BOT_TOKEN && ALERT_CHAT_ID);
  logger.info(
    { sentry: hasSentry, telegramAlerts: hasTelegramAlert, slowWarnMs: SLOW_WARN_MS, slowErrorMs: SLOW_ERROR_MS },
    "[monitoring] observability layer ready",
  );
}
