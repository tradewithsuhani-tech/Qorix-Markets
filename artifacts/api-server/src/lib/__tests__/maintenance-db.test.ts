import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Mirror of maintenance.test.ts but for the OTHER half of the maintenance
// contract: the admin-UI toggle that writes `system_settings.maintenance_mode
// = "true"` instead of the Fly secret MAINTENANCE_MODE env var. Both signals
// are merged inside getMaintenanceState() and the rest of the codebase only
// ever checks the merged result, so a regression in the DB-side branch (wrong
// table name, wrong key, the catch-block silently swallowing the row, the
// fall-through accidentally clearing dbActive when the env var is unset, etc.)
// would slip past the env-var test. We need to prove the DB branch is wired
// end-to-end by booting the same app, seeding the row, and re-running the same
// four behaviour checks.

// Critical: MAINTENANCE_MODE must be UNSET before importing the app so this
// suite is genuinely exercising the DB path. If a previous run leaked the env
// var into the process, the env branch would short-circuit dbActive entirely
// and the test would still pass for the wrong reason.
delete process.env["MAINTENANCE_MODE"];
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

const { default: app } = await import("../../app");
const { db, pool, systemSettingsTable } = await import("@workspace/db");
const {
  getMaintenanceState,
  invalidateMaintenanceCache,
  shouldRunBackgroundJobs,
} = await import("../../middlewares/maintenance");
const { inArray } = await import("drizzle-orm");
const { teardownHttpServer, teardownRedis } = await import("./cleanup");

let server: Server;
let baseUrl = "";

const MAINTENANCE_KEYS = [
  "maintenance_mode",
  "maintenance_hard_block",
  "maintenance_message",
  "maintenance_ends_at",
] as const;

before(async () => {
  // Belt-and-braces: clear any stale rows another suite may have left behind
  // before seeding our own. We only ever want `maintenance_mode=true` and
  // nothing else for this fixture so the assertions are unambiguous about
  // which branch of the merge is firing.
  await db
    .delete(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [...MAINTENANCE_KEYS]));
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_mode", value: "true" });

  // Drop the in-memory cache so the very first request sees the row we just
  // wrote (otherwise any state primed during module import — e.g. from a
  // boot-time getMaintenanceState() call — would mask the new value for up
  // to CACHE_TTL_MS).
  invalidateMaintenanceCache();
  // Warm the cache with a single fresh read so the very first /api/healthz
  // probe below sees the seeded DB row. /api/healthz is mounted BEFORE
  // maintenanceMiddleware (zero-DB probe to keep Fly LB happy under pool
  // pressure) and reads the X-Maintenance-Mode header from a synchronous
  // cache peek — no DB round-trip on the probe path. In production the
  // cache warms naturally on the first real /api request through
  // maintenanceMiddleware or via a LISTEN/NOTIFY broadcast from another
  // instance; the test mirrors that warming explicitly.
  await getMaintenanceState();

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await teardownHttpServer(server);
  // Clean up the row we wrote so it doesn't leak into other tests in the
  // suite that depend on a clean baseline.
  await db
    .delete(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [...MAINTENANCE_KEYS]));
  invalidateMaintenanceCache();
  await teardownRedis();
  await pool.end();
});

test("DB toggle: getMaintenanceState reports source=db (env var unset)", async () => {
  // Sanity check that we are genuinely exercising the DB branch. If env var
  // leaked back in, source would be "env" or "both" and every assertion
  // below would still pass — but for the wrong reason.
  assert.equal(
    process.env["MAINTENANCE_MODE"],
    undefined,
    "MAINTENANCE_MODE must stay unset for the DB-only branch under test",
  );
  const state = await getMaintenanceState();
  assert.equal(state.active, true, "DB row maintenance_mode=true must flip state.active");
  assert.equal(
    state.source,
    "db",
    "with env var unset, the merge must report source=db so we know the DB branch is wired",
  );
  assert.equal(
    state.hardBlock,
    false,
    "we only seeded maintenance_mode, not maintenance_hard_block — soft-maintenance only",
  );
});

test("DB toggle: GET /api/healthz returns 200 with X-Maintenance-Mode header", async () => {
  const res = await fetch(`${baseUrl}/api/healthz`);
  assert.equal(res.status, 200, "healthz must keep working during DB-toggled maintenance");
  assert.equal(
    res.headers.get("x-maintenance-mode"),
    "true",
    "every response under /api should carry X-Maintenance-Mode: true so the web banner can flip on without waiting for a write to fail",
  );
  const body = (await res.json()) as { status?: string };
  assert.equal(body.status, "ok");
});

test("DB toggle: GET /api/system/status reports maintenance + writesDisabled", async () => {
  const res = await fetch(`${baseUrl}/api/system/status`);
  assert.equal(res.status, 200, "system/status must stay readable during DB-toggled maintenance");
  assert.equal(res.headers.get("x-maintenance-mode"), "true");
  const body = (await res.json()) as {
    maintenance?: boolean;
    writesDisabled?: boolean;
  };
  assert.equal(
    body.maintenance,
    true,
    "DB-toggled maintenance must surface as maintenance:true on /system/status",
  );
  assert.equal(
    body.writesDisabled,
    true,
    "writesDisabled drives the inline banner — must be true when the admin DB toggle is on without hard-block",
  );
});

test("DB toggle: POST /api/auth/login returns structured 503 + Retry-After", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "x@example.com", password: "irrelevant" }),
  });
  assert.equal(res.status, 503, "writes must be rejected with 503 during DB-toggled maintenance");
  assert.equal(
    res.headers.get("retry-after"),
    "60",
    "Retry-After: 60 is what proxies and uptime checkers expect during a planned outage",
  );
  assert.equal(res.headers.get("x-maintenance-mode"), "true");
  const body = (await res.json()) as {
    error?: string;
    code?: string;
    maintenance?: boolean;
  };
  // Same wire contract as the env-var path — the frontend pattern-matches on
  // `code` regardless of which signal triggered maintenance.
  assert.equal(body.error, "maintenance");
  assert.equal(body.code, "maintenance_mode");
  assert.equal(body.maintenance, true);
});

test("DB toggle: shouldRunBackgroundJobs() returns false", async () => {
  // Boot-time gate: if the admin flips maintenance ON via the UI, every cron
  // / poller / watcher / worker must stay off (or be torn down by a restart)
  // exactly the same way as the env-var freeze. Even an explicit
  // RUN_BACKGROUND_JOBS=true must not punch a hole through the gate.
  const state = await getMaintenanceState();
  assert.equal(state.active, true);
  assert.equal(state.source, "db");
  assert.equal(
    shouldRunBackgroundJobs(state),
    false,
    "DB-toggled maintenance must veto background jobs the same way the env var does",
  );

  const prev = process.env["RUN_BACKGROUND_JOBS"];
  process.env["RUN_BACKGROUND_JOBS"] = "true";
  try {
    assert.equal(
      shouldRunBackgroundJobs(state),
      false,
      "DB-toggled maintenance must beat an explicit RUN_BACKGROUND_JOBS=true override",
    );
  } finally {
    if (prev === undefined) delete process.env["RUN_BACKGROUND_JOBS"];
    else process.env["RUN_BACKGROUND_JOBS"] = prev;
  }
});
