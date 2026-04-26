/**
 * Tests for `scripts/src/verify-db-cutover.ts`.
 *
 * The verify-db-cutover script is run exactly once per cutover under
 * maintenance-window pressure (step 6 of MUMBAI_DB_CUTOVER_RUNBOOK.md),
 * and the operator trusts its exit code to decide whether to proceed.
 * That trust is fragile: a "tidy-up" PR that quietly turns a real FAIL
 * into an exit-0 PASS would not be noticed until the next live cutover.
 * These tests pin the exit-code contract:
 *
 *   exit 0  — source/target identical and wallet decrypt succeeds
 *             (or --skip-decrypt is passed).
 *   exit 1  — any critical-table count mismatch, OR the wallet-decrypt
 *             sample is encrypted under a different secret than the env.
 *   exit 2  — bad/missing arguments.
 *
 * To get realistic behaviour we boot one ephemeral PostgreSQL instance
 * (PG is always present on Replit Nix images and in CI) and create two
 * databases on it — `source` and `target`. The verify script connects
 * to each as if they were two separate hosts; that's enough to exercise
 * the row-count diff, sequence check, and wallet-decrypt path without
 * having to run two postgres processes.
 *
 * The wallet-encrypt helper below MUST stay byte-compatible with both
 * `artifacts/api-server/src/lib/wallet-crypto.ts` (the production
 * encrypter that wrote the ciphertexts in real DBs) AND
 * `decryptPrivateKey()` in `scripts/src/verify-db-cutover.ts`. If you
 * rotate the algorithm in either place, rotate it here too — otherwise
 * the FAIL test below will start "passing" for the wrong reason
 * (decrypt fails because of an algo skew, not because of the wrong
 * secret) and the PASS test will start failing for the same reason.
 */

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import pg from "pg";

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPTS_ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.resolve(__dirname, "..", "verify-db-cutover.ts");
const TSX_BIN = path.resolve(SCRIPTS_ROOT, "node_modules", ".bin", "tsx");

const CRITICAL_TABLES = [
  "users",
  "wallets",
  "ledger_entries",
  "deposit_addresses",
  "transactions",
  "investments",
] as const;

// Mirrors `decryptPrivateKey()` in verify-db-cutover.ts and
// `encryptPrivateKey()` in artifacts/api-server/src/lib/wallet-crypto.ts.
// Kept inline (rather than imported) so the test can use an arbitrary
// secret per call — the production helper captures the secret at module
// load and would force us to fork the process per encrypt.
function encryptWithSecret(plain: string, secret: string): string {
  const key = crypto.scryptSync(secret, "qorix-wallet-v1", 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

interface PgInstance {
  port: number;
  dataDir: string;
  socketDir: string;
  logFile: string;
}

let pgInstance: PgInstance | null = null;

function startPg(): PgInstance {
  const dataDir = mkdtempSync(path.join(tmpdir(), "verify-cutover-pgdata-"));
  const socketDir = mkdtempSync(path.join(tmpdir(), "verify-cutover-pgsock-"));
  const logFile = path.join(dataDir, "postgres.log");

  // initdb with trust auth so the test doesn't have to manage passwords;
  // the cluster only listens on 127.0.0.1 + a unix socket in /tmp, and
  // the postgres process is killed at the end of the test run.
  const initRes = spawnSync(
    "initdb",
    [
      "-D",
      dataDir,
      "-U",
      "postgres",
      "-A",
      "trust",
      "-E",
      "UTF8",
      "--no-locale",
    ],
    { encoding: "utf8" },
  );
  if (initRes.status !== 0) {
    throw new Error(
      `initdb failed (exit ${initRes.status}):\n` +
        `stdout:\n${initRes.stdout}\nstderr:\n${initRes.stderr}`,
    );
  }

  // We need a TCP port (the verify script connects via postgres:// URL),
  // but pick a free one to avoid colliding with other test runs.
  // socketDir is required because some PG builds refuse to start without
  // a writable unix socket dir.
  const port = pickFreePortSync();

  const startRes = spawnSync(
    "pg_ctl",
    [
      "-D",
      dataDir,
      "-l",
      logFile,
      "-o",
      `-p ${port} -h 127.0.0.1 -k ${socketDir} -c fsync=off -c synchronous_commit=off -c full_page_writes=off`,
      "-w",
      "-t",
      "30",
      "start",
    ],
    { encoding: "utf8" },
  );
  if (startRes.status !== 0) {
    const log = existsSync(logFile) ? readFileSync(logFile, "utf8") : "";
    throw new Error(
      `pg_ctl start failed (exit ${startRes.status}):\n` +
        `stdout:\n${startRes.stdout}\nstderr:\n${startRes.stderr}\nlog:\n${log}`,
    );
  }

  return { port, dataDir, socketDir, logFile };
}

// Synchronous "give me a free TCP port" helper. We need this *before*
// we boot the postgres process, so an async net.createServer dance
// doesn't fit cleanly into the synchronous initdb/pg_ctl pipeline.
// Spawning a tiny node child to do the listen-on-0 probe is the
// dependency-free way to bridge that.
function pickFreePortSync(): number {
  const res = spawnSync(
    process.execPath,
    [
      "-e",
      "const net = require('node:net');" +
        "const srv = net.createServer();" +
        "srv.listen(0, '127.0.0.1', () => {" +
        "  const p = srv.address().port;" +
        "  srv.close(() => process.stdout.write(String(p)));" +
        "});",
    ],
    { encoding: "utf8" },
  );
  if (res.status !== 0) {
    throw new Error(`free-port probe failed: ${res.stderr}`);
  }
  const port = Number(res.stdout.trim());
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `free-port probe returned bogus value: ${JSON.stringify(res.stdout)}`,
    );
  }
  return port;
}

function stopPg(inst: PgInstance): void {
  spawnSync("pg_ctl", ["-D", inst.dataDir, "-m", "immediate", "stop"], {
    encoding: "utf8",
  });
  rmSync(inst.dataDir, { recursive: true, force: true });
  rmSync(inst.socketDir, { recursive: true, force: true });
}

function urlFor(inst: PgInstance, db: string): string {
  return `postgres://postgres@127.0.0.1:${inst.port}/${db}`;
}

async function withClient<T>(
  url: string,
  fn: (c: pg.Client) => Promise<T>,
): Promise<T> {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end().catch(() => undefined);
  }
}

async function createDatabase(inst: PgInstance, name: string): Promise<void> {
  await withClient(urlFor(inst, "postgres"), async (c) => {
    await c.query(`drop database if exists "${name}"`);
    await c.query(`create database "${name}"`);
  });
}

async function applySchema(url: string): Promise<void> {
  await withClient(url, async (c) => {
    // Minimal schema covering exactly the critical tables the verify
    // script enumerates plus enough columns for the wallet-decrypt path.
    await c.query(`
      create table users              (id serial primary key, name text);
      create table wallets            (id serial primary key, user_id int);
      create table ledger_entries     (id serial primary key, wallet_id int);
      create table deposit_addresses  (
        id serial primary key,
        address text,
        private_key_enc text not null default ''
      );
      create table transactions       (id serial primary key);
      create table investments        (id serial primary key);
      -- A non-critical table so the approximate-counts branch has data
      -- to walk over.
      create table audit_log          (id serial primary key, msg text);
    `);
  });
}

interface SeedOptions {
  // How many of each critical row to insert (other than deposit_addresses).
  rows: number;
  // The encrypted blob to store in deposit_addresses.private_key_enc.
  // Pass null/undefined to leave the table empty.
  encryptedKey: string | null;
}

async function seed(url: string, opts: SeedOptions): Promise<void> {
  await withClient(url, async (c) => {
    for (let i = 0; i < opts.rows; i++) {
      await c.query("insert into users (name) values ($1)", [`u${i}`]);
      await c.query("insert into wallets (user_id) values ($1)", [i + 1]);
      await c.query(
        "insert into ledger_entries (wallet_id) values ($1)",
        [i + 1],
      );
      await c.query("insert into transactions default values");
      await c.query("insert into investments default values");
    }
    if (opts.encryptedKey !== null && opts.encryptedKey !== undefined) {
      await c.query(
        "insert into deposit_addresses (address, private_key_enc) values ($1, $2)",
        ["TXxxFakeAddress", opts.encryptedKey],
      );
    }
    // After all the INSERTs above the serial sequences naturally sit at
    // last_value=max(id) with is_called=true, which the script accepts.
    // Force-bump them anyway so we exercise the same setval the runbook
    // step 5 does, and so the sequence-safety check is positively
    // tested rather than just incidentally satisfied.
    for (const t of CRITICAL_TABLES) {
      await c.query(
        `select setval(pg_get_serial_sequence($1, 'id'), greatest((select coalesce(max(id), 1) from ${t}), 1), true)`,
        [t],
      );
    }
  });
}

async function resetBoth(): Promise<void> {
  if (!pgInstance) throw new Error("pg not started");
  for (const db of ["source", "target"] as const) {
    await withClient(urlFor(pgInstance, db), async (c) => {
      await c.query("drop schema public cascade");
      await c.query("create schema public");
      await c.query("grant all on schema public to public");
    });
  }
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

function runScript(args: string[], extraEnv: Record<string, string>): RunResult {
  const res = spawnSync(TSX_BIN, [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      NO_COLOR: "1",
      ...extraEnv,
    },
  });
  if (res.error) throw res.error;
  return {
    status: res.status ?? -1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

before(async () => {
  pgInstance = startPg();
  await createDatabase(pgInstance, "source");
  await createDatabase(pgInstance, "target");
});

after(async () => {
  if (pgInstance) {
    stopPg(pgInstance);
    pgInstance = null;
  }
});

beforeEach(async () => {
  await resetBoth();
  await applySchema(urlFor(pgInstance!, "source"));
  await applySchema(urlFor(pgInstance!, "target"));
});

const TEST_SECRET = "verify-cutover-test-secret-A";
const OTHER_SECRET = "verify-cutover-test-secret-B-different";

test("exits 0 when source and target are identical", async () => {
  const enc = encryptWithSecret("0xprivatekeyplaintextlongenough0123", TEST_SECRET);
  await seed(urlFor(pgInstance!, "source"), { rows: 3, encryptedKey: enc });
  await seed(urlFor(pgInstance!, "target"), { rows: 3, encryptedKey: enc });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
    ],
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    0,
    `expected exit 0, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  assert.match(res.stdout, /verify-db-cutover: PASS/);
  assert.match(res.stdout, /all critical-table counts match/);
});

test("exits 1 when a critical-table count differs by even one row", async () => {
  const enc = encryptWithSecret("0xprivatekeyplaintextlongenough0123", TEST_SECRET);
  await seed(urlFor(pgInstance!, "source"), { rows: 3, encryptedKey: enc });
  await seed(urlFor(pgInstance!, "target"), { rows: 3, encryptedKey: enc });
  // Sneak one extra user into target only — exactly the kind of drift
  // the operator must catch.
  await withClient(urlFor(pgInstance!, "target"), async (c) => {
    await c.query("insert into users (name) values ('drift')");
  });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
    ],
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    1,
    `expected exit 1, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  assert.match(res.stdout, /FAIL\s+users/);
  assert.match(res.stdout, /verify-db-cutover: FAIL/);
});

test("exits 1 when the wallet-decrypt sample was encrypted with a different secret", async () => {
  const wrongEnc = encryptWithSecret(
    "0xprivatekeyplaintextlongenough0123",
    OTHER_SECRET,
  );
  await seed(urlFor(pgInstance!, "source"), { rows: 2, encryptedKey: wrongEnc });
  await seed(urlFor(pgInstance!, "target"), { rows: 2, encryptedKey: wrongEnc });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
    ],
    // Run the script with TEST_SECRET, but the sample row was encrypted
    // with OTHER_SECRET — decrypt must fail and we must see exit 1.
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    1,
    `expected exit 1, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  assert.match(res.stdout, /cannot decrypt deposit_addresses\.private_key_enc/);
  assert.match(res.stdout, /verify-db-cutover: FAIL/);
});

test("exits 0 with a SKIPPED line when --skip-decrypt is passed", async () => {
  // Same setup as the previous test (wallet ciphertext is unreadable
  // with the env's secret), but --skip-decrypt should bypass that check
  // entirely. This is the smoke-test escape hatch — it MUST short-circuit
  // the decrypt path without WALLET_ENC_SECRET being set at all.
  const wrongEnc = encryptWithSecret(
    "0xprivatekeyplaintextlongenough0123",
    OTHER_SECRET,
  );
  await seed(urlFor(pgInstance!, "source"), { rows: 2, encryptedKey: wrongEnc });
  await seed(urlFor(pgInstance!, "target"), { rows: 2, encryptedKey: wrongEnc });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
      "--skip-decrypt",
    ],
    // Deliberately blank — proves the skip path doesn't even consult
    // the secret. spawnSync inherits process.env by default, so we have
    // to actively unset WALLET_ENC_SECRET / JWT_SECRET if they happen
    // to be set in the parent shell.
    { WALLET_ENC_SECRET: "", JWT_SECRET: "" },
  );

  assert.equal(
    res.status,
    0,
    `expected exit 0, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  assert.match(res.stdout, /SKIPPED via --skip-decrypt/);
  assert.match(res.stdout, /verify-db-cutover: PASS/);
});

test("exits 1 when a serial sequence on the target was reset to 1 with is_called=false (missed setval batch)", async () => {
  // Reproduces the exact failure mode runbook step 5 is supposed to
  // prevent: rows have been copied across so counts match, but the
  // setval batch that bumps each sequence past max(id) on the target
  // was missed (or only partially applied — e.g. the operator's psql
  // session died mid-batch and they re-ran the COPY but not the setval).
  //
  // Concretely: target has 3 users with ids 1..3, but users_id_seq has
  // been knocked back to last_value=1, is_called=false — so the next
  // nextval() returns 1, which collides with the existing PK 1 the
  // moment the API does its first signup INSERT in step 8.
  //
  // The verify script's sequence-safety branch is the ONLY thing that
  // catches this before the duplicate-key 500s start; if a future
  // refactor flips the comparison or stops honouring is_called=false,
  // this test will go red.
  const enc = encryptWithSecret("0xprivatekeyplaintextlongenough0123", TEST_SECRET);
  await seed(urlFor(pgInstance!, "source"), { rows: 3, encryptedKey: enc });
  await seed(urlFor(pgInstance!, "target"), { rows: 3, encryptedKey: enc });

  // Simulate the half-finished setval batch on target only. We rewind
  // users_id_seq specifically so we can assert on its name in the
  // output — every other critical sequence stays correctly bumped.
  await withClient(urlFor(pgInstance!, "target"), async (c) => {
    await c.query("select setval('users_id_seq', 1, false)");
  });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
    ],
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    1,
    `expected exit 1, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  // The script formats the failing line as "FAIL  users_id_seq …", so
  // pin both the tag and the specific sequence name.
  assert.match(res.stdout, /FAIL\s+users_id_seq/);
  // The "next nextval would collide" hint is the operator-facing
  // explanation of *why* this is unsafe — pin it so a refactor can't
  // quietly drop the diagnostic and leave the operator staring at a
  // bare FAIL line at 3am.
  assert.match(
    res.stdout,
    /next nextval would collide with existing max\(id\)/,
  );
  // is_called=false should be surfaced too — that's the nuance that
  // makes last_value=1 dangerous (next nextval returns 1, not 2).
  assert.match(res.stdout, /is_called=false/);
  // Top-line remediation: the script must point at the correct
  // runbook step, otherwise a panicked operator may hand-fix the
  // wrong table.
  assert.match(res.stdout, /Re-run the setval batch in runbook step 5/);
  assert.match(res.stdout, /verify-db-cutover: FAIL/);
  // Critical-table counts must NOT be flagged — this regression is
  // specifically the case where row counts agree but sequences lie.
  assert.match(res.stdout, /all critical-table counts match/);
});

test("exits 0 when a sequence has is_called=false but last_value is genuinely above max(id) (still safe)", async () => {
  // Positive control for the nuance the previous test exercises in the
  // failing direction. setval(seq, N, false) means "next nextval
  // returns N" (NOT N+1). If N > max(id) the sequence is still safe —
  // the very next INSERT lands on a fresh PK. The script must NOT
  // false-positive here, otherwise every operator who calls setval
  // with is_called=false (a perfectly legal Postgres idiom — it's
  // what `pg_dump --data-only` emits) will get a spurious cutover
  // abort.
  const enc = encryptWithSecret("0xprivatekeyplaintextlongenough0123", TEST_SECRET);
  await seed(urlFor(pgInstance!, "source"), { rows: 3, encryptedKey: enc });
  await seed(urlFor(pgInstance!, "target"), { rows: 3, encryptedKey: enc });

  // max(users.id) = 3 after the seed. Park last_value at 4 with
  // is_called=false → next nextval = 4, which is > 3, so safe.
  await withClient(urlFor(pgInstance!, "target"), async (c) => {
    await c.query("select setval('users_id_seq', 4, false)");
  });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
    ],
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    0,
    `expected exit 0, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  // The line for users_id_seq should still note is_called=false (so
  // an operator reading the log sees what state the sequence is in)
  // but must be tagged OK, not FAIL.
  assert.match(res.stdout, /OK\s+users_id_seq[^\n]*is_called=false/);
  assert.doesNotMatch(res.stdout, /FAIL\s+users_id_seq/);
  assert.doesNotMatch(
    res.stdout,
    /next nextval would collide with existing max\(id\)/,
  );
  assert.match(res.stdout, /verify-db-cutover: PASS/);
});

test("exits 1 with the empty-sequences diagnostic when the target schema was never pushed", async () => {
  // Reproduces the failure mode where the operator points the cutover
  // verify at a target Postgres on which FLY_GO_LIVE_CHECKLIST step
  // 2/3a (the schema push) was skipped — no nextval defaults exist
  // on any column in public, so the runbook step-5 setval batch can't
  // even be checked. The empty-ownerships branch around lines 541-549
  // of verify-db-cutover.ts is the ONLY line of defence here: if a
  // future refactor drops the explicit `if (ownerships.length === 0)`
  // FAIL, the for-loop below it simply iterates over zero sequences,
  // emits no per-sequence FAILs, and the script exits 0 — which would
  // green-light a cutover into a fresh Postgres that has no sequences
  // at all and 500 on the very first INSERT in step 8.
  //
  // To isolate that branch as the sole reason for the FAIL we need
  // exactCounts() to succeed (otherwise the script bails earlier with
  // exit 2 from `relation "users" does not exist`), so target keeps
  // the bare critical tables but with `int` id columns instead of
  // `serial` — same row-count surface, no sequences. Source stays at
  // 0 rows in every critical table so the row-count diff matches
  // 0=0 and the empty-sequences branch is the sole reason for the
  // FAIL. If the count check ever started failing for an unrelated
  // reason this test would go red for the wrong reason, hence the
  // explicit "all critical-table counts match" assertion below.
  await withClient(urlFor(pgInstance!, "target"), async (c) => {
    await c.query("drop schema public cascade");
    await c.query("create schema public");
    await c.query("grant all on schema public to public");
    await c.query(`
      create table users              (id int primary key, name text);
      create table wallets            (id int primary key, user_id int);
      create table ledger_entries     (id int primary key, wallet_id int);
      create table deposit_addresses  (
        id int primary key,
        address text,
        private_key_enc text not null default ''
      );
      create table transactions       (id int primary key);
      create table investments        (id int primary key);
    `);
  });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
    ],
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    1,
    `expected exit 1, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  // Pin the exact operator-facing diagnostic so a refactor can't
  // soften it into a yellow WARN or quietly drop it. The em-dash and
  // the trailing "?" are both part of the live string in the script.
  assert.match(
    res.stdout,
    /no serial sequences found on the target — schema not pushed yet\?/,
  );
  // The remediation MUST point at the precise checklist step that was
  // skipped — without this, a panicked operator in the maintenance
  // window won't know which setup step to re-run.
  assert.match(res.stdout, /FLY_GO_LIVE_CHECKLIST step 2\/3a/);
  assert.match(res.stdout, /verify-db-cutover: FAIL/);
  // Critical-table counts MUST NOT be flagged — the regression we're
  // guarding is specifically "tables look fine, sequences don't
  // exist". If counts ever started mismatching here, the FAIL would
  // be for the wrong reason and the empty-sequences branch could be
  // silently removed without this test noticing.
  assert.match(res.stdout, /all critical-table counts match/);
});

test("exits 1 with the schema-not-pushed diagnostic when the target has no critical tables at all", async () => {
  // Sibling of the empty-sequences test above, but one rung earlier
  // in the verify pipeline: this is the case where FLY_GO_LIVE_CHECKLIST
  // step 2/3a was skipped *entirely* on the target, so public.users
  // doesn't even exist. Without the schema preflight in
  // verify-db-cutover.ts, the very first exactCounts() query crashes
  // with `relation "users" does not exist`, falls out of the top-level
  // main().catch as a generic "unexpected error" stack trace, and
  // exits 2 — leaving a 3am operator staring at a Node trace instead
  // of the same friendly hint the empty-sequences branch already
  // emits for the partial case. This test pins the friendly diagnostic
  // and the exit-1 contract so a future refactor can't regress it
  // back into the noisy crash.
  await withClient(urlFor(pgInstance!, "target"), async (c) => {
    await c.query("drop schema public cascade");
    await c.query("create schema public");
    await c.query("grant all on schema public to public");
  });

  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
    ],
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    1,
    `expected exit 1, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  // Pin the operator-facing diagnostic so a refactor can't soften it
  // into a generic message or quietly drop it.
  assert.match(
    res.stdout,
    /no critical tables found on the target — schema not pushed yet\?/,
  );
  // Remediation MUST point at the precise checklist step that was
  // skipped — otherwise a panicked operator won't know which setup
  // step to re-run.
  assert.match(res.stdout, /FLY_GO_LIVE_CHECKLIST step 2\/3a/);
  assert.match(res.stdout, /verify-db-cutover: FAIL/);
  // The whole point of this fix is that the script must NOT fall out
  // of the top-level catch as an "unexpected error" stack trace, and
  // must NOT leak the raw `relation "users" does not exist` Postgres
  // error. If either of those reappears, this test goes red — meaning
  // the schema preflight has been bypassed and the script is back to
  // crashing instead of diagnosing.
  assert.doesNotMatch(res.stderr, /unexpected error/);
  assert.doesNotMatch(
    res.stdout + res.stderr,
    /relation "users" does not exist/,
  );
});

test("exits 2 when required arguments are missing", async () => {
  const res = runScript(["--source", urlFor(pgInstance!, "source")], {
    WALLET_ENC_SECRET: TEST_SECRET,
  });

  assert.equal(
    res.status,
    2,
    `expected exit 2, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  assert.match(res.stderr, /--source and --target are both required/);
});

test("exits 2 when an unknown argument is passed", async () => {
  const res = runScript(
    [
      "--source",
      urlFor(pgInstance!, "source"),
      "--target",
      urlFor(pgInstance!, "target"),
      "--definitely-not-a-real-flag",
    ],
    { WALLET_ENC_SECRET: TEST_SECRET },
  );

  assert.equal(
    res.status,
    2,
    `expected exit 2, got ${res.status}\nstdout:\n${res.stdout}\nstderr:\n${res.stderr}`,
  );
  assert.match(res.stderr, /Usage: verify-db-cutover/);
});
