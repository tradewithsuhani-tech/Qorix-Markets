import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Managed Postgres (Neon, Supabase, RDS, Render) requires TLS. We detect SSL
// intent from the URL and ALWAYS verify the server certificate against the
// system CA bundle when SSL is on, so a network attacker can't present a
// self-signed cert and silently MITM the connection.
//
//   sslmode=require / verify-ca / verify-full → encrypted AND cert chain
//                                    verified against the system trust store
//                                    (Neon, Supabase, RDS, Render all ship
//                                    publicly-trusted certs that the alpine
//                                    ca-certificates bundle accepts)
//
// In Replit dev the DATABASE_URL is plain `postgres://...` with no sslmode and
// we leave SSL off so the in-container pg keeps working.
//
// Escape hatch: PGSSL_ALLOW_INVALID_CERT=true downgrades to encrypted-but-
// unverified. Only intended for transient incident response (e.g. a provider's
// cert briefly chains to a CA the container doesn't trust) — it should NEVER
// be set in normal production operation. To make accidental misconfiguration
// hard, in NODE_ENV=production the operator must ALSO set
// PGSSL_BREAK_GLASS_ACK=true, otherwise the process refuses to start. A loud
// warning is logged whenever the bypass is active so it's visible in tails.
const dbUrl = process.env.DATABASE_URL;
const sslmodeMatch = /[?&]sslmode=(require|verify-ca|verify-full)/i.exec(dbUrl);
const sslmode = sslmodeMatch?.[1]?.toLowerCase();
const wantsSsl =
  Boolean(sslmode) ||
  /^postgres(ql)?:\/\/[^/]*neon\.tech/i.test(dbUrl) ||
  /^postgres(ql)?:\/\/[^/]*supabase\.co/i.test(dbUrl) ||
  process.env.PGSSL === "require";
const allowInvalidCert = process.env.PGSSL_ALLOW_INVALID_CERT === "true";
if (allowInvalidCert) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.PGSSL_BREAK_GLASS_ACK !== "true"
  ) {
    throw new Error(
      "PGSSL_ALLOW_INVALID_CERT=true is set in production without PGSSL_BREAK_GLASS_ACK=true. " +
        "This disables Postgres TLS certificate verification and exposes the DB connection to MITM. " +
        "If this really is an emergency, set PGSSL_BREAK_GLASS_ACK=true to acknowledge the risk and unblock startup.",
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    "[db] WARNING: PGSSL_ALLOW_INVALID_CERT=true — Postgres TLS certificate verification is DISABLED. " +
      "Connections are encrypted but vulnerable to MITM. Unset this as soon as the underlying issue is resolved.",
  );
}

// ─── Pool sizing & per-query timeouts ──────────────────────────────────────
// Default `pg.Pool` `max` is 10. Under cron + Tron monitor + Telegram poller
// + BullMQ workers all running on the same instance as web traffic, that
// pool exhausted in seconds — new HTTP requests then queued behind
// in-flight queries and produced 80–200s tail latencies (and starved the
// Fly health check, triggering the "no healthy instances" cascade observed
// on 2026-04-28). Bumping to 25 keeps us well under Neon's per-project
// ~100-connection ceiling even with web + worker + ad-hoc migrations all
// holding clients at the same time.
//
// `statement_timeout` (server-side) cancels any single SQL statement that
// runs longer than 10s and releases the connection back to the pool, so
// one runaway query can never permanently consume a slot. This is the
// last-resort safety net under the per-route 30s timeout middleware in
// app.ts — that middleware ends the HTTP response, this kills the actual
// DB work behind it.
//
// `idle_in_transaction_session_timeout` reclaims connections that issued
// `BEGIN` and then went idle (handler crashed/hung mid-transaction without
// COMMIT/ROLLBACK), which would otherwise hold a slot indefinitely.
export const pool = new Pool({
  connectionString: dbUrl,
  ssl: wantsSsl ? { rejectUnauthorized: !allowInvalidCert } : undefined,
  max: 25,
  statement_timeout: 10_000,
  idle_in_transaction_session_timeout: 15_000,
});

// ─── Slow-query logger ──────────────────────────────────────────────────────
// Times every query that goes through the pool (and through transaction
// clients via the `connect` event below) and logs ones that exceed
// SLOW_QUERY_MS. Drizzle's built-in Logger interface only exposes
// `logQuery(sql, params)` BEFORE the query runs, so it can't measure
// duration — wrapping the underlying pg driver is the only way to capture
// real elapsed time including network round-trip to Neon.
//
// Mode (DRIZZLE_QUERY_LOG):
//   none → log nothing (silent baseline)
//   slow → log only when duration ≥ SLOW_QUERY_MS (default 1000ms). This
//          is the default in production: no chatter under normal load,
//          loud signal when something regresses.
//   full → log every query. Useful in dev when reproducing a bug; very
//          noisy in prod, never use it there.
//
// Implementation notes:
//   - Lives in lib/db (no api-server logger import) so the worker process
//     and any future consumer of `pool` get the same instrumentation for
//     free — without dragging pino into this package.
//   - Submittables (pg Cursor / COPY streams) are skipped. Their lifecycle
//     isn't a single Promise so we can't measure it cleanly, and Drizzle
//     doesn't use them on any current path.
//   - SQL is truncated to 200 chars and whitespace-collapsed. Params count
//     is logged but params themselves are NOT — they may contain PII (UTRs,
//     phone numbers, etc).
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? "1000");
const QUERY_LOG_MODE = (() => {
  const raw = (process.env.DRIZZLE_QUERY_LOG ?? "").toLowerCase();
  if (raw === "full" || raw === "slow" || raw === "none") return raw;
  // Default: slow in prod (signal-only), none in dev (don't pollute logs).
  return process.env.NODE_ENV === "production" ? "slow" : "none";
})();

function logQueryTiming(sqlText: string, paramsCount: number, elapsedMs: number): void {
  if (QUERY_LOG_MODE === "none") return;
  const isSlow = elapsedMs >= SLOW_QUERY_MS;
  if (QUERY_LOG_MODE === "slow" && !isSlow) return;
  const snippet = sqlText.replace(/\s+/g, " ").trim().slice(0, 200);
  const truncated = sqlText.length > 200 ? "…" : "";
  const tag = isSlow ? "[db][SLOW]" : "[db]";
  // eslint-disable-next-line no-console
  console.warn(
    `${tag} ${elapsedMs.toFixed(1)}ms params=${paramsCount} sql="${snippet}${truncated}"`,
  );
}

function wrapQueryFn(target: pg.Pool | pg.PoolClient | pg.Client): void {
  // Capture before we replace, so the wrapper invokes the real impl.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = (target as any).query as (...args: unknown[]) => unknown;
  if (typeof original !== "function") return;
  // Mark wrapped to make double-wrap a no-op (defensive against the connect
  // handler firing twice for the same client in some pg versions).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((original as any).__qorixWrapped) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped: any = function (this: unknown, ...args: unknown[]): unknown {
    const first = args[0] as unknown;
    // Submittable (Cursor / Query object with .submit) — skip timing.
    if (
      first &&
      typeof first === "object" &&
      typeof (first as { submit?: unknown }).submit === "function"
    ) {
      return original.apply(this, args);
    }
    const sqlText =
      typeof first === "string"
        ? first
        : (first as { text?: string } | undefined)?.text ?? "";
    const paramsCount = Array.isArray(args[1])
      ? (args[1] as unknown[]).length
      : Array.isArray((first as { values?: unknown[] } | undefined)?.values)
        ? ((first as { values: unknown[] }).values).length
        : 0;
    const start = process.hrtime.bigint();
    const result = original.apply(this, args);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      (result as Promise<unknown>).then(
        () => {
          const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
          logQueryTiming(sqlText, paramsCount, elapsedMs);
        },
        () => {
          const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
          // Failed queries also get timed — a failing slow query is still
          // a slow query and we want to see it.
          logQueryTiming(sqlText, paramsCount, elapsedMs);
        },
      );
    }
    return result;
  };
  wrapped.__qorixWrapped = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (target as any).query = wrapped;
}

if (QUERY_LOG_MODE !== "none") {
  // Pool-level (most queries) and per-client (transactions hold a checked-out
  // PoolClient and call client.query directly, bypassing pool.query).
  wrapQueryFn(pool);
  pool.on("connect", (client) => {
    wrapQueryFn(client);
  });
  // eslint-disable-next-line no-console
  console.warn(
    `[db] slow-query logger ENABLED (mode=${QUERY_LOG_MODE}, threshold=${SLOW_QUERY_MS}ms)`,
  );
}

export const db = drizzle(pool, { schema });

// Build a dedicated, long-lived Postgres connection suitable for LISTEN.
// LISTEN binds to a single backend connection — pool clients get recycled and
// would silently drop subscriptions on release, so callers that need pub/sub
// (currently the cross-instance maintenance cache invalidation in
// api-server/src/middlewares/maintenance.ts) must own their own client. The
// caller is responsible for calling `client.end()` on shutdown.
export function createListenClient(): pg.Client {
  return new pg.Client({
    connectionString: dbUrl,
    ssl: wantsSsl ? { rejectUnauthorized: !allowInvalidCert } : undefined,
  });
}

export * from "./schema";
