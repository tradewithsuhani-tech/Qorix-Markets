import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Regression test for the production guard in lib/db/src/index.ts that prevents
// PGSSL_ALLOW_INVALID_CERT=true from being silently flipped on in production.
//
// Why this matters: PGSSL_ALLOW_INVALID_CERT=true downgrades the Postgres TLS
// connection to encrypted-but-unverified — the same MITM hole that
// db-tls-cert.test.ts covers via code, just routed through env vars. To make
// accidental misconfiguration in production hard, the module additionally
// requires PGSSL_BREAK_GLASS_ACK=true to be set whenever NODE_ENV=production;
// otherwise the process refuses to start. If a future change weakens that
// guard (e.g. drops the NODE_ENV check, or stops requiring the ack), an
// operator could silently disable cert verification in production by setting
// one env var. This test pins down that contract end-to-end.
//
// Each scenario MUST run in its own fresh child process: @workspace/db reads
// the relevant env vars at module-import time and exports a singleton Pool,
// so we cannot toggle the configuration between tests in a single process.
// The companion `db-tls-breakglass-harness.ts` script imports the module once
// and reports the outcome via exit code + stdout/stderr.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessPath = path.join(__dirname, "db-tls-breakglass-harness.ts");

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

// Spawn the harness in a fresh node process with a per-scenario env. Keys
// whose value is `undefined` are explicitly DELETED from the child env, so a
// scenario can prove "PGSSL_BREAK_GLASS_ACK is unset" even when the parent
// shell happens to have it exported (e.g. if the developer is currently
// debugging a real incident).
function runHarness(env: Record<string, string | undefined>): RunResult {
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) childEnv[k] = v;
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) {
      delete childEnv[k];
    } else {
      childEnv[k] = v;
    }
  }
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", harnessPath],
    { env: childEnv, encoding: "utf8" },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

// A bogus DATABASE_URL is fine: pg's Pool/Client constructors are pure and
// don't connect at instantiation, so the module loads to completion (or
// throws on the guard) without ever touching the network. This also keeps
// the test hermetic — no real Postgres needed.
const FAKE_DB_URL = "postgres://t:t@127.0.0.1:1/t";

test("production + PGSSL_ALLOW_INVALID_CERT=true WITHOUT PGSSL_BREAK_GLASS_ACK refuses to start", () => {
  const r = runHarness({
    NODE_ENV: "production",
    PGSSL_ALLOW_INVALID_CERT: "true",
    PGSSL_BREAK_GLASS_ACK: undefined,
    DATABASE_URL: FAKE_DB_URL,
  });
  assert.notEqual(
    r.status,
    0,
    `import must FAIL when the break-glass bypass is set in production without an explicit ack — ` +
      `the guard in lib/db/src/index.ts has likely been weakened. ` +
      `stdout=${r.stdout} stderr=${r.stderr}`,
  );
  // Combined stream so the assertion isn't sensitive to whether the message
  // surfaces via the thrown Error (stderr) or via console output (stdout).
  assert.match(
    r.stderr + r.stdout,
    /PGSSL_BREAK_GLASS_ACK/,
    `the refusal message MUST mention PGSSL_BREAK_GLASS_ACK so an on-call operator ` +
      `knows exactly which env var to set to acknowledge the risk and unblock startup. ` +
      `got stderr=${r.stderr} stdout=${r.stdout}`,
  );
});

test("production + PGSSL_ALLOW_INVALID_CERT=true + PGSSL_BREAK_GLASS_ACK=true succeeds (positive control)", () => {
  // Positive control: prove the guard isn't just "always throw in production
  // when ALLOW_INVALID_CERT is set". An on-call operator with a genuine
  // emergency MUST be able to unblock startup by acknowledging the risk.
  const r = runHarness({
    NODE_ENV: "production",
    PGSSL_ALLOW_INVALID_CERT: "true",
    PGSSL_BREAK_GLASS_ACK: "true",
    DATABASE_URL: FAKE_DB_URL,
  });
  assert.equal(
    r.status,
    0,
    `import MUST succeed when the operator has acknowledged the risk via ` +
      `PGSSL_BREAK_GLASS_ACK=true — otherwise the break-glass is unusable. ` +
      `stdout=${r.stdout} stderr=${r.stderr}`,
  );
  assert.match(
    r.stdout,
    /IMPORT_OK/,
    `harness should have printed IMPORT_OK on success. stdout=${r.stdout} stderr=${r.stderr}`,
  );
});

test("non-production + PGSSL_ALLOW_INVALID_CERT=true succeeds and emits a console.warn", () => {
  // Outside production the ack is NOT required (so dev/test workflows aren't
  // a hassle), but the module still has to log a loud warning so the bypass
  // is visible in tails and nobody forgets it's on.
  const r = runHarness({
    NODE_ENV: "development",
    PGSSL_ALLOW_INVALID_CERT: "true",
    PGSSL_BREAK_GLASS_ACK: undefined,
    DATABASE_URL: FAKE_DB_URL,
  });
  assert.equal(
    r.status,
    0,
    `import MUST succeed outside production even without the ack. ` +
      `stdout=${r.stdout} stderr=${r.stderr}`,
  );
  assert.match(
    r.stdout,
    /IMPORT_OK/,
    `harness should have printed IMPORT_OK on success. stdout=${r.stdout} stderr=${r.stderr}`,
  );
  // console.warn writes to stderr in node. The exact phrasing of the warning
  // is allowed to drift, but the env-var name has to appear so a grep over
  // logs surfaces it.
  assert.match(
    r.stderr,
    /PGSSL_ALLOW_INVALID_CERT=true/,
    `the loud warning about the bypass being active MUST be emitted whenever ` +
      `PGSSL_ALLOW_INVALID_CERT=true, otherwise an unattended dev environment ` +
      `can drift into a degraded TLS posture invisibly. stderr=${r.stderr}`,
  );
});
