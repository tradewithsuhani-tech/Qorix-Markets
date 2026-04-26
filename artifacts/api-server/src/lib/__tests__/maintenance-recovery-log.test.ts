import { test, after, before } from "node:test";
import assert from "node:assert/strict";

// Sibling of maintenance-db-fault.test.ts. That suite locked in the BEHAVIOUR
// of the silent try/catch in getMaintenanceState() (env-only fallback, no
// stale dbActive carried across a failed poll). This file locks in the
// *recovery info log* on the other end of the same incident: the one-shot
// `logger.info(...)` line emitted the FIRST time the system_settings poll
// succeeds again after a streak of failures.
//
// That info line is the bookend ops use to mark "the gate has stopped
// degrading to env-only". If a future refactor accidentally dropped the
// `logger.info(...)` call but kept the `dbLookupFailureStreak = 0` reset,
// the gate would silently recover with no signal in the log — admins who
// flipped the toggle during the degradation would have no way to tell when
// (or whether) their toggle started being honoured again. The streak-reset
// behaviour itself is *implicitly* covered by the second-call assertion
// below (a second successful poll must NOT re-emit the line, which only
// holds when the streak counter has been reset).
//
// Parallel-safe fixture rules: this suite does NOT touch any
// system_settings rows. node:test runs each *.test.ts file in its own
// worker process IN PARALLEL, and the sibling maintenance suites
// (maintenance-hard-block, maintenance-both, maintenance-db,
// maintenance-eta-env-wins, maintenance-eta-admin,
// maintenance-message-db-wins, ...) seed those rows then make HTTP / state
// reads. Wiping or upserting any of them from this worker would race them.
// We get away with touching nothing because the assertion here is purely
// about log emissions on the merge path; the row VALUES the successful
// query returns are irrelevant to whether the recovery line fired.
//
// Same restriction as maintenance-eta-env-wins.test.ts and
// maintenance-message-db-wins.test.ts — touch only what this suite owns.

delete process.env["MAINTENANCE_MODE"];
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

const dbModule = await import("@workspace/db");
const { db, pool } = dbModule;
const {
  getMaintenanceState,
  invalidateMaintenanceCache,
} = await import("../../middlewares/maintenance");
const { logger } = await import("../logger");

// Constant duplicated from middlewares/maintenance.ts — that file does not
// export it (it's intentionally module-private so callers can't interpolate
// user input into the LISTEN/NOTIFY identifier), so the test re-asserts the
// literal value. If the channel name ever changes, this assertion is the
// canary that forces the change to land in both places.
const MAINTENANCE_NOTIFY_CHANNEL = "maintenance_invalidate";

// Exact wording of the recovery info line. Pinned literally rather than via
// a substring match because the message string is itself a stability
// contract for log-based dashboards / alert hooks ops have already wired
// up around the original incident — a stealthy edit (e.g. dropping the em-
// dash, or changing "recovered" to "ok") would silently break those hooks
// without anything else in the suite catching it.
const RECOVERY_MESSAGE =
  "Maintenance system_settings lookup recovered — gate no longer degraded to env-only";

// Same db.select fault-injection pattern as maintenance-db-fault.test.ts.
// The production code does
//   `await db.select().from(systemSettingsTable).where(...)`
// so throwing on the terminal `.where(...)` exercises the catch path inside
// getMaintenanceState() exactly the way a real query failure would (the
// awaitable rejects / the chain raises before producing rows). Keeping the
// shim isomorphic with the sibling suite means a refactor that renames the
// drizzle chain has one consistent place to update.
const originalSelect = db.select.bind(db);

function breakDbSelect(): void {
  (db as unknown as { select: () => unknown }).select = () => {
    return {
      from: () => ({
        where: () => {
          throw new Error(
            "simulated Postgres failure during system_settings lookup",
          );
        },
      }),
    };
  };
}

function restoreDbSelect(): void {
  (db as unknown as { select: typeof originalSelect }).select = originalSelect;
}

// Capture logger.info invocations by monkey-patching the imported pino
// instance. We can't tap pino's transport from here without rewiring the
// module's logger surface, so wrapping the public method is the smallest
// seam that still proves the line was emitted with the right structured
// payload. We use Object.defineProperty so the override sticks even if
// pino installs `info` with a non-default property descriptor in some
// future version, and so the after() hook can confidently restore the
// original method without a stray enumerable shadow.
type InfoCall = { obj: unknown; msg: unknown };
const infoCalls: InfoCall[] = [];
const originalInfo = logger.info.bind(logger);

function captureLoggerInfo(): void {
  Object.defineProperty(logger, "info", {
    value: (obj: unknown, msg?: unknown) => {
      infoCalls.push({ obj, msg });
      // Still forward to the real logger so the developer running the
      // suite locally sees the same console output they'd see in prod —
      // the test's job is to OBSERVE the call, not suppress it.
      return originalInfo(obj as never, msg as never);
    },
    writable: true,
    configurable: true,
  });
}

function restoreLoggerInfo(): void {
  Object.defineProperty(logger, "info", {
    value: originalInfo,
    writable: true,
    configurable: true,
  });
}

before(() => {
  // Drop the cache so the first call inside the test re-runs the merge
  // logic (otherwise a stale cached state from another import-time path
  // could short-circuit before the broken db.select is exercised).
  invalidateMaintenanceCache();
  captureLoggerInfo();
});

after(async () => {
  // Always restore — even if a test crashed mid-flight — so a subsequent
  // test (or a future addition to this file) doesn't inherit either the
  // broken db.select shim or the spy-wrapped logger.info.
  restoreLoggerInfo();
  restoreDbSelect();
  invalidateMaintenanceCache();
  await pool.end();
});

test("recovery info line is emitted exactly once when DB lookup succeeds after a failure streak, and not again on the next success", async () => {
  // Build a non-trivial failure streak (> 1) so the recovery log carries a
  // meaningful `recoveredAfterFailures` count and we can assert the value
  // matches the streak length, not just "any positive number". An off-by-
  // one or a hard-coded constant in place of `dbLookupFailureStreak` would
  // pass against streak=1 by accident.
  const targetFailures = 3;

  breakDbSelect();
  for (let i = 0; i < targetFailures; i += 1) {
    // Cache must be busted between each call: getMaintenanceState() writes
    // the merged state to the cache on BOTH the success and the catch
    // paths, so consecutive calls without an invalidation would return the
    // first call's cached state and never re-enter the catch (the streak
    // would stop at 1 instead of growing to `targetFailures`).
    invalidateMaintenanceCache();
    const state = await getMaintenanceState();
    assert.equal(
      state.active,
      false,
      "with MAINTENANCE_MODE unset and the DB lookup throwing, the merged " +
        "gate must collapse to env-only on every failed poll — sanity " +
        "check that we are actually exercising the catch path that bumps " +
        "dbLookupFailureStreak",
    );
  }

  // Reset the captured info calls so we only assert against what the
  // recovery branch emits. The pre-recovery polls don't call logger.info
  // today (they go through errorLogger.warn for the throttled degradation
  // line), but we clear here defensively in case a future refactor adds
  // info-level telemetry to the failure path — without this, an unrelated
  // info line from the failure path could mask a missing recovery line.
  infoCalls.length = 0;

  // Restore the DB and trigger a successful lookup. The recovery branch
  // inside getMaintenanceState() is gated on `dbLookupFailureStreak > 0`,
  // so this single successful poll must emit the one-shot info line.
  restoreDbSelect();
  invalidateMaintenanceCache();
  await getMaintenanceState();

  const recoveryLogs = infoCalls.filter((c) => c.msg === RECOVERY_MESSAGE);
  assert.equal(
    recoveryLogs.length,
    1,
    `recovery info line must be emitted EXACTLY ONCE on the first ` +
      `successful poll after a failure streak — saw ${recoveryLogs.length}. ` +
      `If this is 0, the logger.info(...) call has been dropped (the streak ` +
      `reset still happens, so the silent-recovery regression is invisible ` +
      `to ops); if > 1, something has duplicated the call inside the gate.`,
  );

  const payload = recoveryLogs[0]!.obj as {
    channel?: unknown;
    recoveredAfterFailures?: unknown;
  };
  assert.equal(
    payload.channel,
    MAINTENANCE_NOTIFY_CHANNEL,
    "recovery log must carry the maintenance NOTIFY channel name " +
      "(maintenance_invalidate) so log-based dashboards can group it with " +
      "the other maintenance fan-out lines (active / reconnected / " +
      "NOTIFY-failed) under one channel filter",
  );
  assert.equal(
    payload.recoveredAfterFailures,
    targetFailures,
    `recovery log must report the actual streak length (${targetFailures}) ` +
      `so ops can chart how long the gate was degraded — a hard-coded ` +
      `constant or an off-by-one would silently lie about the incident ` +
      `duration in post-mortems`,
  );

  // A second successful poll MUST NOT re-emit the line. The streak counter
  // was reset to 0 on the first successful poll, so the gating condition
  // (`dbLookupFailureStreak > 0`) should be false here. If this assertion
  // fails, a regression has either (a) stopped resetting the streak on
  // success — which would also cause ever-growing recoveredAfterFailures
  // values across recoveries — or (b) moved the logger.info call outside
  // the gate so it fires on every successful poll, flooding the log with
  // bogus "we're back" lines that ops would rapidly learn to ignore.
  invalidateMaintenanceCache();
  await getMaintenanceState();

  const recoveryLogsAfterSecondSuccess = infoCalls.filter(
    (c) => c.msg === RECOVERY_MESSAGE,
  );
  assert.equal(
    recoveryLogsAfterSecondSuccess.length,
    1,
    `recovery info line must NOT re-emit on the next successful poll — ` +
      `saw ${recoveryLogsAfterSecondSuccess.length} total across two ` +
      `successful polls. The streak counter is reset on the first success, ` +
      `so the gating condition (dbLookupFailureStreak > 0) should be false ` +
      `on the second poll`,
  );
});
