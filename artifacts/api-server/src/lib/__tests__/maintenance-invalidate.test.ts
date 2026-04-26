import { test, after, before } from "node:test";
import assert from "node:assert/strict";

// Cross-instance maintenance cache invalidation: this test proves that a
// `NOTIFY maintenance_invalidate` issued from one Postgres connection drops
// the in-memory cache of any process that has called
// startMaintenanceInvalidationListener(). Without this fan-out, flipping the
// admin maintenance toggle on one Fly machine would only invalidate that
// machine's cache and every other replica would keep serving the stale state
// for up to CACHE_TTL_MS (5 s).

const { db, pool, systemSettingsTable } = await import("@workspace/db");
const {
  getMaintenanceState,
  startMaintenanceInvalidationListener,
  notifyMaintenanceInvalidation,
  invalidateMaintenanceCache,
  __getListenerProcessIdForTest,
  __setListenClientFactoryForTest,
} = await import("../../middlewares/maintenance");
const { eq, inArray } = await import("drizzle-orm");

let stopListener: (() => Promise<void>) | null = null;

// Wait for an assertion to become true within `timeoutMs`, polling every
// `intervalMs`. Returns the final value (or throws on timeout). We use this
// because LISTEN/NOTIFY delivery is asynchronous — we can't just `await`
// the NOTIFY query and assume the peer's notification handler has fired.
async function waitFor<T>(
  fn: () => T | Promise<T>,
  predicate: (value: T) => boolean,
  { timeoutMs = 2_000, intervalMs = 25 } = {},
): Promise<T> {
  const start = Date.now();
  let value: T;
  // First check synchronously so a passing assertion exits immediately.
  do {
    value = await fn();
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, intervalMs));
  } while (Date.now() - start < timeoutMs);
  return value;
}

before(async () => {
  // Ensure no stale env-var maintenance state from another suite leaks in.
  delete process.env["MAINTENANCE_MODE"];
  delete process.env["MAINTENANCE_ETA"];
  delete process.env["MAINTENANCE_MESSAGE"];
  // Make sure the DB rows we depend on are off / known so the cached
  // baseline state under test is `active: false`.
  await db
    .delete(systemSettingsTable)
    .where(
      inArray(systemSettingsTable.key, [
        "maintenance_mode",
        "maintenance_hard_block",
        "maintenance_message",
        "maintenance_ends_at",
      ]),
    );
  stopListener = await startMaintenanceInvalidationListener();
});

after(async () => {
  if (stopListener) await stopListener();
  // Clean up any rows we wrote so other suites get a clean slate.
  await db
    .delete(systemSettingsTable)
    .where(
      inArray(systemSettingsTable.key, [
        "maintenance_mode",
        "maintenance_hard_block",
        "maintenance_message",
        "maintenance_ends_at",
      ]),
    );
  await pool.end();
});

test("LISTEN drops the local cache when a peer issues NOTIFY", async () => {
  // Prime the cache with the off-state baseline.
  const before = await getMaintenanceState();
  assert.equal(
    before.active,
    false,
    "baseline must be off so we can prove the cache is repopulated after invalidation",
  );

  // Simulate a peer instance flipping the toggle: write the row directly
  // (bypassing notifyMaintenanceInvalidation, which would also clear OUR
  // cache locally — defeating the cross-instance assertion) then fire a
  // raw NOTIFY on the shared pool.
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_mode", value: "true" })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: "true", updatedAt: new Date() },
    });
  await pool.query("NOTIFY maintenance_invalidate");

  // The listener fires asynchronously. Poll getMaintenanceState() until
  // it reflects the new DB value — proving the cache was invalidated by
  // the LISTEN handler (not by a local function call).
  const after = await waitFor(
    () => getMaintenanceState(),
    (s) => s.active === true,
    { timeoutMs: 2_000 },
  );
  assert.equal(
    after.active,
    true,
    "LISTEN must have invalidated the cache so the next read picks up the new DB row within ~1s",
  );
  assert.equal(after.source, "db", "DB-only toggle should report source=db");
});

test("notifyMaintenanceInvalidation invalidates locally AND broadcasts to peers", async () => {
  // Make sure the row reflects the OFF state in DB but the cache (which
  // we're about to populate) is the ON state — that way an invalidation
  // is observable by `active` flipping back to false on the next read.
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_mode"));

  // Populate the cache with the now-stale ON value first by reading once
  // BEFORE writing the OFF state.
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_mode", value: "true" })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: "true", updatedAt: new Date() },
    });
  // First read primes cache with active=true.
  const primed = await getMaintenanceState();
  assert.equal(primed.active, true);

  // Now write OFF without invalidating — the cache still says ON.
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_mode"));
  const stillCached = await getMaintenanceState();
  assert.equal(
    stillCached.active,
    true,
    "without invalidation, the in-memory TTL cache should still report the old value",
  );

  // notifyMaintenanceInvalidation should both drop the local cache AND
  // emit NOTIFY (which a peer LISTEN handler — including ours — picks up).
  await notifyMaintenanceInvalidation();

  const fresh = await waitFor(
    () => getMaintenanceState(),
    (s) => s.active === false,
    { timeoutMs: 2_000 },
  );
  assert.equal(
    fresh.active,
    false,
    "notifyMaintenanceInvalidation must drop the local cache so the next read sees the latest DB row",
  );
});

// Regression: the LISTEN connection auto-reconnects after errors / unexpected
// disconnects (Fly Postgres restart, network blip, the DB cycling a backend).
// Without this test, a regression in scheduleReconnect()/connectListener()
// could leave the reconnect loop *thinking* it succeeded while never actually
// re-issuing `LISTEN maintenance_invalidate` — and the bug would be silent
// until users started reporting stale banners on the affected instance.
//
// Strategy:
//   1. Read the LISTEN backend's PID directly off the live pg.Client via
//      __getListenerProcessIdForTest(). We can't use pg_stat_activity here
//      because the test Postgres has track_activities off (query column is
//      always empty), and we want a stable signal that doesn't depend on
//      cluster GUCs.
//   2. Force-kill that backend with pg_terminate_backend() from a pool
//      connection — same effect as Fly Postgres rotating a backend out.
//   3. Wait for the listener to expose a NEW PID (proves the reconnect
//      loop actually established a fresh connection, not just that the
//      old one is still hanging around).
//   4. Issue a fresh NOTIFY from the pool and assert the cache flips —
//      proving the reconnected client also re-issued LISTEN, not just
//      reconnected silently.

test("listener re-LISTENs after the backend is terminated (pg_terminate_backend)", async () => {
  // Resolve the current listener's backend PID. The before() hook already
  // started the listener; processID is set synchronously by pg.Client at
  // connect() time, so it should be available immediately. Poll briefly
  // anyway in case the previous test's NOTIFY/cache work delayed assignment.
  const originalPid = await waitFor(
    () => __getListenerProcessIdForTest(),
    (pid) => pid !== null && pid > 0,
    { timeoutMs: 2_000 },
  );
  assert.ok(
    originalPid !== null && originalPid > 0,
    "expected an active LISTEN client with a backend PID before the disconnect — listener was never established",
  );

  // Reset any cache state from prior tests so the post-reconnect assertion
  // can't be satisfied by a stale entry that just happens to be active=true.
  invalidateMaintenanceCache();
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_mode"));
  const baseline = await getMaintenanceState();
  assert.equal(
    baseline.active,
    false,
    "baseline must be off so the post-reconnect NOTIFY observably flips it on",
  );

  // Simulate a Fly Postgres backend rotation / network blip by terminating
  // the LISTEN backend from another connection.
  await pool.query("SELECT pg_terminate_backend($1::int)", [originalPid]);

  // The reconnect loop waits RECONNECT_DELAY_FLOOR_MS (1 s) then dials a fresh
  // client. Wait for a different PID to appear on the listener — that's
  // the direct proof the reconnect actually established a brand-new
  // backend (not just that the old socket is still hanging around).
  const newPid = await waitFor(
    () => __getListenerProcessIdForTest(),
    (pid) => pid !== null && pid > 0 && pid !== originalPid,
    { timeoutMs: 5_000, intervalMs: 50 },
  );
  assert.ok(
    newPid !== null && newPid !== originalPid,
    `listener must reconnect with a fresh backend PID after pg_terminate_backend; original=${originalPid}, observed=${String(newPid)}. ` +
      "If this fails, scheduleReconnect()/connectListener() never re-established the LISTEN connection and cross-instance maintenance fan-out is silently broken on this instance.",
  );

  // End-to-end proof: write the row + NOTIFY from the pool, and confirm
  // the reconnected listener still drops our local cache. Without the
  // re-LISTEN, this NOTIFY would never be delivered to the new client and
  // the cache would keep returning the off-state for up to CACHE_TTL_MS.
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_mode", value: "true" })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: "true", updatedAt: new Date() },
    });
  await pool.query("NOTIFY maintenance_invalidate");

  const after = await waitFor(
    () => getMaintenanceState(),
    (s) => s.active === true,
    { timeoutMs: 2_000 },
  );
  assert.equal(
    after.active,
    true,
    "after the LISTEN backend was terminated and the listener reconnected, a peer NOTIFY must still invalidate the cache — otherwise admins would see stale maintenance state on this instance until the 5 s TTL fallback kicks in",
  );
  assert.equal(after.source, "db", "DB-only toggle should still report source=db after reconnect");
});

// Regression: when Postgres is hard-down (think a multi-minute Fly Postgres
// outage rather than a one-off backend rotation), the LISTEN reconnect loop
// must NOT retry every 1 s indefinitely. The old flat-1s schedule meant
// every API instance produced one connect attempt + one error log + one
// socket churn per second for the whole outage window — which both spammed
// the error logs and added load to whatever DB-front proxy is between us and
// Postgres while it's already struggling.
//
// The fix is bounded exponential backoff (1s, 2s, 4s, 8s, 16s, 30s, 30s, …).
// This test asserts the *minimum* contract: after the first failure, the
// gap between consecutive failed connect attempts must grow above 1s — i.e.
// the schedule is no longer flat. We verify that by injecting a factory
// that throws synchronously (simulating "DB hard-down") and recording the
// timestamps of the resulting connect attempts.
test("scheduleReconnect uses exponential backoff so consecutive failed connects don't all happen within 1s", async () => {
  // Stop the live listener owned by the before() hook so we control the
  // lifecycle for this test. We're about to inject a failing factory and
  // we don't want the existing healthy connection's reconnect path to
  // fight us.
  if (stopListener) {
    await stopListener();
    stopListener = null;
  }

  const attemptTimestamps: number[] = [];
  __setListenClientFactoryForTest(() => {
    attemptTimestamps.push(Date.now());
    // Synchronous throw — connectListener()'s try/catch turns this into a
    // scheduleReconnect() call without ever having a real client to clean
    // up. Same observable effect as a TCP-level connect refusal.
    throw new Error("simulated DB hard-down (test injection)");
  });

  try {
    // First attempt fires synchronously inside startMaintenanceInvalidationListener
    // (it awaits connectListener() once). Subsequent attempts are scheduled
    // by scheduleReconnect() with the backed-off delays.
    stopListener = await startMaintenanceInvalidationListener();

    // Wait until at least three failed attempts have landed: that gives us
    // two inter-attempt gaps to compare. The expected gaps are ~1s and ~2s,
    // so a 10s timeout is comfortable headroom even on a slow CI runner.
    await waitFor(
      () => attemptTimestamps.length,
      (n) => n >= 3,
      { timeoutMs: 10_000, intervalMs: 25 },
    );
    assert.ok(
      attemptTimestamps.length >= 3,
      `expected at least 3 connect attempts within the timeout, got ${attemptTimestamps.length}. ` +
        "If this fails, the reconnect loop is not running at all — check that connectListener()'s catch block still calls scheduleReconnect().",
    );

    const gap1 = attemptTimestamps[1]! - attemptTimestamps[0]!;
    const gap2 = attemptTimestamps[2]! - attemptTimestamps[1]!;

    // Gap1 is the floor (~1s — the first retry after the initial failure).
    // Gap2 is the second retry, which after the doubling should be ~2s.
    // Assert it cleared 1.5s — that's the explicit "two consecutive failed
    // connects don't both happen within ~1s" guarantee from the runbook.
    // Using 1500ms (not 2000ms) gives us tolerance for setTimeout drift on
    // a loaded CI host without weakening the regression: the OLD flat-1s
    // schedule would put gap2 at ~1000ms, well below this threshold.
    assert.ok(
      gap2 >= 1_500,
      `expected exponential backoff to push the second inter-attempt gap above 1.5s, ` +
        `but got gap1=${gap1}ms, gap2=${gap2}ms. The old flat-1s schedule would also produce gap2≈1000ms, ` +
        "so this regression means scheduleReconnect() is hammering Postgres at the floor delay forever during a hard-down outage.",
    );
    // Belt-and-braces: gap2 should also be strictly larger than gap1 by a
    // meaningful margin — proves the schedule is *growing*, not just
    // happening to be slow on this run.
    assert.ok(
      gap2 > gap1 + 500,
      `expected gap2 to exceed gap1 by at least 500ms (proving the backoff is doubling, not flat); got gap1=${gap1}ms, gap2=${gap2}ms`,
    );
  } finally {
    // Tear down the failing-listener lifecycle BEFORE clearing the
    // injected factory. If we cleared the factory first, the next
    // scheduled reconnect would dial the real Postgres, attach an
    // error/end handler, and leave a real LISTEN client behind that the
    // after() hook isn't tracking.
    if (stopListener) {
      await stopListener();
      stopListener = null;
    }
    __setListenClientFactoryForTest(null);
  }
});
