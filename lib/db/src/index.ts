import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Managed Postgres (Neon, Supabase, RDS, Render) requires TLS but the
// node-postgres driver tries to verify the cert chain by default, which fails
// for some providers because the system CA bundle inside an alpine container
// doesn't include the issuer. Detect SSL intent from the URL and disable cert
// verification — the connection itself is still encrypted.
//
// In Replit dev the DATABASE_URL is plain `postgres://...` with no sslmode and
// we leave SSL off so the in-container pg keeps working.
const dbUrl = process.env.DATABASE_URL;
const wantsSsl =
  /[?&]sslmode=(require|verify-ca|verify-full)/i.test(dbUrl) ||
  /^postgres(ql)?:\/\/[^/]*neon\.tech/i.test(dbUrl) ||
  /^postgres(ql)?:\/\/[^/]*supabase\.co/i.test(dbUrl) ||
  process.env.PGSSL === "require";

export const pool = new Pool({
  connectionString: dbUrl,
  ssl: wantsSsl ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
