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
