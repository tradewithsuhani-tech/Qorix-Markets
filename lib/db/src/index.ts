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

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: wantsSsl ? { rejectUnauthorized: !allowInvalidCert } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
