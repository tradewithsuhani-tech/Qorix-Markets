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
// intent from the URL and honour the requested verification level:
//
//   sslmode=require                → encrypted but cert chain NOT verified
//                                    (default for Neon; some providers ship
//                                    certs not in the alpine system CA bundle
//                                    so blanket verification would break the
//                                    connection)
//   sslmode=verify-ca / verify-full → encrypted AND cert chain verified — the
//                                    operator opted in via the DSN, so we
//                                    must not silently downgrade them
//
// In Replit dev the DATABASE_URL is plain `postgres://...` with no sslmode and
// we leave SSL off so the in-container pg keeps working.
const dbUrl = process.env.DATABASE_URL;
const sslmodeMatch = /[?&]sslmode=(require|verify-ca|verify-full)/i.exec(dbUrl);
const sslmode = sslmodeMatch?.[1]?.toLowerCase();
const wantsSsl =
  Boolean(sslmode) ||
  /^postgres(ql)?:\/\/[^/]*neon\.tech/i.test(dbUrl) ||
  /^postgres(ql)?:\/\/[^/]*supabase\.co/i.test(dbUrl) ||
  process.env.PGSSL === "require";
const wantsVerify = sslmode === "verify-ca" || sslmode === "verify-full";

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: wantsSsl ? { rejectUnauthorized: wantsVerify } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
