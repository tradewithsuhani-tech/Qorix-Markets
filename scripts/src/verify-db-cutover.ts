/**
 * verify-db-cutover
 *
 * Step 6 of MUMBAI_DB_CUTOVER_RUNBOOK.md collapsed into one command.
 *
 * Given two PostgreSQL connection strings, this script:
 *
 *  1. Diffs exact row counts on the critical tables defined in
 *     `lib/db/src/schema/` (`users`, `wallets`, `ledger_entries`,
 *     `deposit_addresses`, `transactions`, `investments`). Any mismatch
 *     here is a stop-the-line and exits 1 — these are the tables where
 *     a missing row means real user money is at risk.
 *
 *  2. Diffs approximate row counts via `pg_stat_user_tables` for every
 *     other table. These are advisory only — pg_stat_user_tables is not
 *     transactionally accurate, so a small drift is normal. We only emit
 *     a WARN (never a failure) on those.
 *
 *  3. Runs the same wallet-decrypt sanity check the API does at boot in
 *     `artifacts/api-server/src/lib/wallet-preflight.ts`: pull one
 *     `deposit_addresses.private_key_enc` from the target DB and try to
 *     decrypt it with the WALLET_ENC_SECRET in this shell. If it can't
 *     decrypt, the secret on the new host doesn't match the source data
 *     and TRC20 sweeps will silently break — exit 1.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run verify-db-cutover \
 *     -- --source "$SOURCE_DATABASE_URL" --target "$TARGET_DATABASE_URL"
 *
 * The decrypt logic below MUST stay byte-compatible with
 * `artifacts/api-server/src/lib/wallet-crypto.ts`. If you rotate the
 * algorithm there, rotate it here too — otherwise this preflight will
 * lie about whether the cutover is safe.
 */

import pg from "pg";
import crypto from "node:crypto";
import { parseArgs } from "node:util";

const { Client } = pg;

const CRITICAL_TABLES = [
  "users",
  "wallets",
  "ledger_entries",
  "deposit_addresses",
  "transactions",
  "investments",
] as const;

// pg_stat_user_tables is approximate (depends on the last autovacuum /
// ANALYZE). Treat tiny drift on non-critical tables as noise; anything
// bigger gets a yellow WARN so an operator can eyeball it.
const APPROX_COUNT_NOISE_TOLERANCE = 2;

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
};

function resolveSsl(url: string): pg.ClientConfig["ssl"] {
  // `sslmode=verify-ca` / `verify-full` explicitly asks for cert chain
  // verification — honour that by leaving `rejectUnauthorized` at the
  // pg default (true) and letting the system CA bundle do its job.
  // Do NOT silently downgrade those modes to `rejectUnauthorized: false`
  // just because we want SSL on; that would defeat the operator's
  // explicit security intent.
  if (/[?&]sslmode=(verify-ca|verify-full)/i.test(url)) {
    return { rejectUnauthorized: true };
  }
  // Plain `sslmode=require` is "encrypt the channel, don't bother with
  // cert chain". This matches the behavior of lib/db/src/index.ts and
  // exists because some hosted Postgres providers ship intermediate CAs
  // the alpine container doesn't trust by default.
  if (
    /[?&]sslmode=require/i.test(url) ||
    /^postgres(ql)?:\/\/[^/]*neon\.tech/i.test(url) ||
    /^postgres(ql)?:\/\/[^/]*supabase\.co/i.test(url)
  ) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

async function connect(url: string, label: string): Promise<pg.Client> {
  const client = new Client({
    connectionString: url,
    ssl: resolveSsl(url),
    // Keep this short — the script runs in a maintenance window and a
    // hung connect should fail loudly, not block forever.
    statement_timeout: 60_000,
    connectionTimeoutMillis: 15_000,
  });
  try {
    await client.connect();
    // Some hosted Postgres providers (raw Neon, plain RDS) ship an empty
    // default search_path, so unqualified "users" / "wallets" in the count
    // queries below resolve to 'relation does not exist'. Replit-managed
    // Neon defaults to 'public, "$user"' so this is a no-op there.
    await client.query("set search_path to public");
  } catch (err) {
    throw new Error(
      `connect to ${label} failed: ${(err as Error).message}`,
    );
  }
  return client;
}

async function exactCounts(
  c: pg.Client,
  tables: readonly string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const t of tables) {
    // Identifier is hard-coded in CRITICAL_TABLES above (no user input),
    // so the unparameterised interpolation here is safe and necessary
    // (table names cannot be bound parameters in psql).
    const res = await c.query<{ n: string }>(
      `select count(*)::bigint as n from ${t}`,
    );
    out.set(t, Number(res.rows[0]!.n));
  }
  return out;
}

async function approxCounts(c: pg.Client): Promise<Map<string, number>> {
  const res = await c.query<{ relname: string; n_live_tup: string }>(
    `select relname, n_live_tup
       from pg_stat_user_tables
      where schemaname = 'public'
      order by relname`,
  );
  const out = new Map<string, number>();
  for (const r of res.rows) out.set(r.relname, Number(r.n_live_tup));
  return out;
}

// ----- decrypt sanity check -----
//
// MUST stay byte-compatible with `decryptPrivateKey` in
// `artifacts/api-server/src/lib/wallet-crypto.ts` (algorithm, KDF salt,
// IV/tag layout). The api-server module also depends on @workspace/db at
// load time, so we can't import it directly from a script that needs to
// connect to two arbitrary DB URLs without polluting either connection.
// If you rotate the algorithm in wallet-crypto.ts, rotate it here too —
// otherwise this preflight will lie about whether the cutover is safe.
const WALLET_ENC_KDF_SALT = "qorix-wallet-v1";
const WALLET_ENC_ALGO = "aes-256-gcm";

function decryptPrivateKey(b64: string): string {
  const secret =
    process.env["WALLET_ENC_SECRET"] ?? process.env["JWT_SECRET"] ?? "";
  if (!secret) {
    throw new Error(
      "WALLET_ENC_SECRET (or JWT_SECRET) is not set in this shell. Export " +
        "the same value the source app uses, otherwise the wallet-decrypt " +
        "check is meaningless. (Use --skip-decrypt only for a smoke run.)",
    );
  }
  const key = crypto.scryptSync(secret, WALLET_ENC_KDF_SALT, 32);
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(WALLET_ENC_ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}

type PreflightResult =
  | { ok: true; reason: string }
  | { ok: false; reason: string };

async function walletPreflight(c: pg.Client): Promise<PreflightResult> {
  const res = await c.query<{ id: number; private_key_enc: string }>(
    `select id, private_key_enc
       from deposit_addresses
      where private_key_enc <> ''
      order by id desc
      limit 1`,
  );
  if (res.rows.length === 0) {
    return {
      ok: true,
      reason:
        "no encrypted deposit_addresses rows on the target — skipped " +
        "(this is normal for a fresh DB; not normal for a real cutover)",
    };
  }
  const sample = res.rows[0]!;
  try {
    const plain = decryptPrivateKey(sample.private_key_enc);
    if (!plain || plain.length < 16) {
      return {
        ok: false,
        reason: `decrypted output too short (sample id=${sample.id})`,
      };
    }
    return {
      ok: true,
      reason: `wallet encryption secret matches existing data (sample id=${sample.id})`,
    };
  } catch (err) {
    return {
      ok: false,
      reason:
        `cannot decrypt deposit_addresses.private_key_enc id=${sample.id}: ` +
        `${(err as Error).message}. The WALLET_ENC_SECRET on this shell ` +
        `does NOT match the secret used when those rows were encrypted.`,
    };
  }
}

// ----- arg parsing & main -----

function redact(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return url.replace(/:[^@/:]+@/, ":****@");
  }
}

function usage(stream: NodeJS.WriteStream = process.stderr): never {
  stream.write(
    `Usage: verify-db-cutover --source <URL> --target <URL> [--skip-decrypt]\n` +
      `\n` +
      `Compares two PostgreSQL databases for the Mumbai cutover\n` +
      `(step 6 of MUMBAI_DB_CUTOVER_RUNBOOK.md).\n` +
      `\n` +
      `Options:\n` +
      `  --source <URL>   postgres:// URL of the source DB (current prod)\n` +
      `  --target <URL>   postgres:// URL of the target DB (new Mumbai DB)\n` +
      `  --skip-decrypt   skip the wallet-decrypt sanity check (does not\n` +
      `                   require WALLET_ENC_SECRET to be set). Only use this\n` +
      `                   for a connectivity smoke test, never a real cutover.\n` +
      `  -h, --help       show this message\n` +
      `\n` +
      `Environment:\n` +
      `  WALLET_ENC_SECRET   required for the wallet-decrypt check\n` +
      `                      (JWT_SECRET is accepted as a fallback, mirroring\n` +
      `                       artifacts/api-server/src/lib/wallet-crypto.ts)\n` +
      `\n` +
      `Exit status:\n` +
      `  0  every critical-table count matches and wallet decrypt succeeded\n` +
      `  1  any critical-table mismatch OR wallet-decrypt failure\n` +
      `  2  bad arguments / connection failure / unexpected error\n`,
  );
  process.exit(2);
}

interface ParsedArgs {
  source: string;
  target: string;
  skipDecrypt: boolean;
}

function parseCliArgs(): ParsedArgs {
  // `pnpm --filter ... run <script> -- --foo bar` injects a literal `--`
  // before our flags. Node's parseArgs treats `--` as the
  // end-of-options separator and shoves everything after it into
  // positionals — so without this strip, the documented runbook
  // invocation fails with "Unexpected argument '--source'". Strip a
  // single leading `--` (and only a leading one) so both forms work:
  //
  //   pnpm run verify-db-cutover -- --source ... --target ...
  //   tsx ./src/verify-db-cutover.ts --source ... --target ...
  const rawArgs = process.argv.slice(2);
  const args = rawArgs[0] === "--" ? rawArgs.slice(1) : rawArgs;

  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        source: { type: "string" },
        target: { type: "string" },
        "skip-decrypt": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      strict: true,
      allowPositionals: false,
    });
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n\n`);
    usage();
  }
  if (parsed.values.help) usage(process.stdout);
  const source = parsed.values.source;
  const target = parsed.values.target;
  if (!source || !target) {
    process.stderr.write(`error: --source and --target are both required\n\n`);
    usage();
  }
  return {
    source,
    target,
    skipDecrypt: Boolean(parsed.values["skip-decrypt"]),
  };
}

async function main(): Promise<void> {
  const args = parseCliArgs();

  console.log(C.bold("== verify-db-cutover =="));
  console.log(`source: ${redact(args.source)}`);
  console.log(`target: ${redact(args.target)}`);
  console.log("");

  let src: pg.Client | null = null;
  let tgt: pg.Client | null = null;
  try {
    [src, tgt] = await Promise.all([
      connect(args.source, "source"),
      connect(args.target, "target"),
    ]);
  } catch (err) {
    process.stderr.write(C.red(`${(err as Error).message}\n`));
    if (src) await src.end().catch(() => undefined);
    if (tgt) await tgt.end().catch(() => undefined);
    process.exit(2);
  }

  let exitCode = 0;
  try {
    // 1. Critical-table exact counts
    console.log(C.bold("Critical tables (exact count):"));
    const [srcExact, tgtExact] = await Promise.all([
      exactCounts(src, CRITICAL_TABLES),
      exactCounts(tgt, CRITICAL_TABLES),
    ]);
    const padT = Math.max(...CRITICAL_TABLES.map((t) => t.length));
    let exactMismatch = 0;
    for (const t of CRITICAL_TABLES) {
      const s = srcExact.get(t)!;
      const g = tgtExact.get(t)!;
      const ok = s === g;
      const tag = ok ? C.green("OK  ") : C.red("FAIL");
      const diff = g - s;
      const diffStr = diff === 0 ? "0" : (diff > 0 ? `+${diff}` : `${diff}`);
      console.log(
        `  ${tag}  ${t.padEnd(padT)}  source=${s}  target=${g}  diff=${diffStr}`,
      );
      if (!ok) exactMismatch++;
    }
    if (exactMismatch > 0) {
      console.log(
        C.red(
          `\n  ${exactMismatch} critical-table mismatch(es). ` +
            `Halt cutover and follow runbook step 9 (back-out).`,
        ),
      );
      exitCode = 1;
    } else {
      console.log(C.green("  all critical-table counts match."));
    }

    // 2. All-tables approximate diff (warnings only)
    console.log(
      C.bold("\nAll public tables (approximate, pg_stat_user_tables):"),
    );
    const [srcApprox, tgtApprox] = await Promise.all([
      approxCounts(src),
      approxCounts(tgt),
    ]);
    const allTables = new Set<string>([
      ...srcApprox.keys(),
      ...tgtApprox.keys(),
    ]);
    const padA = Math.max(...[...allTables].map((t) => t.length), 1);
    let approxWarn = 0;
    for (const t of [...allTables].sort()) {
      const s = srcApprox.get(t) ?? 0;
      const g = tgtApprox.get(t) ?? 0;
      const drift = g - s;
      // Critical tables already got an exact-count check above; their
      // approximate drift is just noise that would distract the operator.
      if ((CRITICAL_TABLES as readonly string[]).includes(t)) continue;
      if (Math.abs(drift) <= APPROX_COUNT_NOISE_TOLERANCE) continue;
      const driftStr = drift > 0 ? `+${drift}` : `${drift}`;
      console.log(
        `  ${C.yellow("WARN")}  ${t.padEnd(padA)}  source≈${s}  target≈${g}  drift=${driftStr}`,
      );
      approxWarn++;
    }
    if (approxWarn === 0) {
      console.log(
        C.green(
          `  no significant approximate drift (tolerance ±${APPROX_COUNT_NOISE_TOLERANCE}).`,
        ),
      );
    } else {
      console.log(
        C.yellow(
          `  ${approxWarn} approximate-count warning(s). ` +
            `pg_stat_user_tables is not transactional; eyeball these but do ` +
            `not block the cutover on them alone.`,
        ),
      );
    }

    // 3. Wallet decrypt sanity check
    console.log(C.bold("\nWallet-decrypt sanity check (target DB):"));
    if (args.skipDecrypt) {
      console.log(
        C.yellow(
          "  SKIPPED via --skip-decrypt. A real cutover MUST run this; " +
            "step 6 of the runbook depends on it.",
        ),
      );
    } else {
      const result = await walletPreflight(tgt);
      if (result.ok) {
        console.log(`  ${C.green("OK  ")} ${result.reason}`);
      } else {
        console.log(`  ${C.red("FAIL")} ${result.reason}`);
        exitCode = 1;
      }
    }
  } finally {
    await src.end().catch(() => undefined);
    await tgt.end().catch(() => undefined);
  }

  if (exitCode === 0) {
    console.log(C.green(C.bold("\nverify-db-cutover: PASS")));
  } else {
    console.log(
      C.red(
        C.bold(
          "\nverify-db-cutover: FAIL — do not proceed past runbook step 6.",
        ),
      ),
    );
  }
  process.exit(exitCode);
}

main().catch((err) => {
  process.stderr.write(
    C.red(`unexpected error: ${(err as Error).stack ?? String(err)}\n`),
  );
  process.exit(2);
});
