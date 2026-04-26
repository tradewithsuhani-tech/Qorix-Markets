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

  // The reconnect loop waits RECONNECT_DELAY_MS (1 s) then dials a fresh
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
