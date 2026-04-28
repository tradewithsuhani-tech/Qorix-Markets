import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Maintenance state must be ON before app/middleware are imported the first
// time. The middleware itself reads process.env per-call, but we also seed
// the env var here so any boot-time reads see the freeze.
process.env["MAINTENANCE_MODE"] = "true";
// Custom ETA so we can also assert it propagates through to the
// X-Maintenance-Ends-At header.
process.env["MAINTENANCE_ETA"] = "2099-01-01T00:00:00.000Z";

const { default: app } = await import("../../app");
const { pool } = await import("@workspace/db");
const {
  getMaintenanceState,
  invalidateMaintenanceCache,
  shouldRunBackgroundJobs,
} = await import("../../middlewares/maintenance");
const { registerBackgroundJobs } = await import("../../lib/background-jobs");
import type { BackgroundJobFactories } from "../background-jobs";

let server: Server;
let baseUrl = "";

before(async () => {
  // Cache invalidate so the env var we just set is picked up by the very
  // first request (rather than only after the 5s TTL).
  invalidateMaintenanceCache();
  // Warm the in-memory maintenance cache before the first probe. The
  // /api/healthz handler is now mounted BEFORE maintenanceMiddleware (so a
  // saturated pg pool can never hang the Fly LB probe) and reads the
  // X-Maintenance-Mode header from a synchronous cache peek — no DB
  // round-trip on the probe path. In production the cache warms naturally
  // on the first real /api request that flows through the middleware (or
  // via a LISTEN/NOTIFY broadcast); the test mirrors that warming
  // explicitly so the very first /api/healthz request below sees the
  // seeded MAINTENANCE_MODE state instead of a cold cache.
  await getMaintenanceState();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env["MAINTENANCE_MODE"];
  delete process.env["MAINTENANCE_ETA"];
  invalidateMaintenanceCache();
  await pool.end();
});

test("MAINTENANCE_MODE=true: GET /api/healthz returns 200 with X-Maintenance-Mode header", async () => {
  const res = await fetch(`${baseUrl}/api/healthz`);
  assert.equal(res.status, 200, "healthz must keep working during maintenance");
  assert.equal(
    res.headers.get("x-maintenance-mode"),
    "true",
    "every response under /api should carry X-Maintenance-Mode: true so the web banner can flip on without waiting for a write to fail",
  );
  const body = (await res.json()) as { status?: string };
  assert.equal(body.status, "ok");
});

test("MAINTENANCE_MODE=true: GET /api/system/status reports maintenance + writesDisabled", async () => {
  const res = await fetch(`${baseUrl}/api/system/status`);
  assert.equal(res.status, 200, "system/status must stay readable during maintenance");
  assert.equal(res.headers.get("x-maintenance-mode"), "true");
  const body = (await res.json()) as {
    maintenance?: boolean;
    writesDisabled?: boolean;
  };
  assert.equal(
    body.maintenance,
    true,
    "soft-maintenance must surface as maintenance:true on /system/status",
  );
  assert.equal(
    body.writesDisabled,
    true,
    "writesDisabled drives the inline banner — must be true when MAINTENANCE_MODE is on without hard-block",
  );
});

test("MAINTENANCE_MODE=true: POST /api/auth/login returns structured 503 + Retry-After", async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "x@example.com", password: "irrelevant" }),
  });
  assert.equal(res.status, 503, "writes must be rejected with 503 during maintenance");
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
  // The frontend pattern-matches on `code` (stable contract), so all three
  // fields are part of the wire contract — not just the HTTP status.
  assert.equal(body.error, "maintenance");
  assert.equal(body.code, "maintenance_mode");
  assert.equal(body.maintenance, true);
});

// Build a stub factory set that records how many times each side process
// was started. Returning real-looking handles means registerBackgroundJobs
// is exercised end-to-end (including the cron init fire-and-forget) — a
// regression where someone bypasses shouldRunBackgroundJobs and calls a
// factory unconditionally would bump the counter and fail the test.
function makeStubFactories() {
  const calls: Record<keyof BackgroundJobFactories, number> = {
    startProfitDistributionWorker: 0,
    startDepositWorker: 0,
    startProfitEventWorker: 0,
    startTronMonitor: 0,
    startDepositWatcher: 0,
    startTelegramPoller: 0,
    initCronJobs: 0,
  };
  const closeable = { close: async () => {} };
  const stoppable = { stop: () => {} };
  const factories: BackgroundJobFactories = {
    startProfitDistributionWorker: async () => {
      calls.startProfitDistributionWorker++;
      return closeable;
    },
    startDepositWorker: async () => {
      calls.startDepositWorker++;
      return closeable;
    },
    startProfitEventWorker: async () => {
      calls.startProfitEventWorker++;
      return closeable;
    },
    startTronMonitor: async () => {
      calls.startTronMonitor++;
      return stoppable;
    },
    startDepositWatcher: async () => {
      calls.startDepositWatcher++;
      return stoppable;
    },
    startTelegramPoller: async () => {
      calls.startTelegramPoller++;
      return stoppable;
    },
    initCronJobs: async () => {
      calls.initCronJobs++;
    },
  };
  return { calls, factories };
}

test("MAINTENANCE_MODE=true: registerBackgroundJobs does NOT register cron / pollers / watchers / workers", async () => {
  // This is the boot-time path: index.ts calls registerBackgroundJobs with
  // realBackgroundJobFactories. By injecting stub factories we can prove
  // none of the actual side processes are started when maintenance is on —
  // catching the regression class the unit-level shouldRunBackgroundJobs
  // test cannot (e.g. someone bypassing the gate and calling a factory
  // directly).
  const state = await getMaintenanceState();
  assert.equal(state.active, true, "env var should make state.active true");

  const { calls, factories } = makeStubFactories();
  const jobs = await registerBackgroundJobs(state, factories);

  assert.equal(jobs, null, "registerBackgroundJobs must return null when maintenance is active");
  for (const [name, count] of Object.entries(calls)) {
    assert.equal(count, 0, `${name} must NOT be invoked when MAINTENANCE_MODE=true`);
  }

  // And as a unit-level safety net, the helper itself agrees.
  assert.equal(shouldRunBackgroundJobs(state), false);

  // Even an explicit RUN_BACKGROUND_JOBS=true cannot override maintenance.
  const prev = process.env["RUN_BACKGROUND_JOBS"];
  process.env["RUN_BACKGROUND_JOBS"] = "true";
  try {
    const { calls: calls2, factories: factories2 } = makeStubFactories();
    const jobs2 = await registerBackgroundJobs(state, factories2);
    assert.equal(jobs2, null, "maintenance must beat an explicit RUN_BACKGROUND_JOBS=true");
    for (const [name, count] of Object.entries(calls2)) {
      assert.equal(count, 0, `${name} must NOT be invoked when MAINTENANCE_MODE=true (even with RUN_BACKGROUND_JOBS=true)`);
    }
  } finally {
    if (prev === undefined) delete process.env["RUN_BACKGROUND_JOBS"];
    else process.env["RUN_BACKGROUND_JOBS"] = prev;
  }
});

test("registerBackgroundJobs DOES register everything when maintenance is OFF (positive control)", async () => {
  // Positive control: the same injection harness should start every side
  // process exactly once when the gate is open. Without this, the negative
  // test above could pass simply because the factories were broken / never
  // wired in. Build an off-state by hand (don't unset MAINTENANCE_MODE on
  // the live process — other tests in this file rely on it being on).
  const offState = {
    active: false,
    hardBlock: false,
    message: "",
    endsAt: null,
    source: null,
  } as const;

  // Make sure RUN_BACKGROUND_JOBS isn't set to "false" via the test env
  // (the workflow may set it for HTTP-only Replit dev). Restore on exit.
  const prev = process.env["RUN_BACKGROUND_JOBS"];
  process.env["RUN_BACKGROUND_JOBS"] = "true";
  try {
    const { calls, factories } = makeStubFactories();
    const jobs = await registerBackgroundJobs(offState, factories);
    assert.notEqual(jobs, null, "registerBackgroundJobs must return handles when gate is open");
    assert.equal(calls.startProfitDistributionWorker, 1);
    assert.equal(calls.startDepositWorker, 1);
    assert.equal(calls.startProfitEventWorker, 1);
    assert.equal(calls.startTronMonitor, 1);
    assert.equal(calls.startDepositWatcher, 1);
    assert.equal(calls.startTelegramPoller, 1);
    // Cron init is fire-and-forget inside registerBackgroundJobs; give the
    // microtask queue a tick so the .catch chain has run and the call counter
    // is up-to-date before we assert on it.
    await new Promise((r) => setImmediate(r));
    assert.equal(calls.initCronJobs, 1);
  } finally {
    if (prev === undefined) delete process.env["RUN_BACKGROUND_JOBS"];
    else process.env["RUN_BACKGROUND_JOBS"] = prev;
  }
});
