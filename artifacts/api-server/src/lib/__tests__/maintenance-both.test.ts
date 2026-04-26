import { test, after, before } from "node:test";
import assert from "node:assert/strict";

// Sibling of maintenance.test.ts (env-only) and maintenance-db.test.ts
// (DB-only). This suite covers the OVERLAP case — MAINTENANCE_MODE=true
// AND `system_settings.maintenance_mode = "true"` both ON at the same
// time — that nothing else exercises today.
//
// Why this matters: getMaintenanceState() merges both signals into a
// single `source: "env" | "db" | "both" | null` field that the admin
// settings panel reads to tell the operator which switch (Fly secret,
// admin UI, or both) needs flipping to fully exit maintenance. A
// regression that accidentally collapsed the overlap to "env" or "db"
// would silently mislead the admin into clearing only one of the two
// switches and thinking the freeze is over while the other is still ON.
// The env-only and DB-only suites would both still pass because their
// branches are unchanged — only this suite would catch the collapse.

// Per-process env var: setting it here only affects THIS worker
// (node:test runs each *.test.ts file in its own process), so we can't
// leak the freeze into other suites' workers. Clear adjacent env vars
// up-front so the assertion is unambiguous about which signal each side
// of the merge is reading.
process.env["MAINTENANCE_MODE"] = "true";
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

// Boot the app for parity with the other maintenance suites (it wires
// up the same module graph so any boot-time getMaintenanceState() call
// sees the env var we just set). We never make HTTP requests in this
// suite — the merge is what's under test, not the middleware that reads
// from it — so we don't bind an HTTP listener.
await import("../../app");
const { db, pool, systemSettingsTable } = await import("@workspace/db");
const {
  getMaintenanceState,
  invalidateMaintenanceCache,
} = await import("../../middlewares/maintenance");
const { eq, sql } = await import("drizzle-orm");

// Upsert + cache-bust the DB row right before each read. The sibling
// maintenance suites (maintenance-db, maintenance-hard-block) all
// delete the `maintenance_*` rows in their own teardown, and node:test
// runs them in parallel — without an upsert between their teardown and
// our read, our `dbActive` could collapse to false and the merge would
// report `"env"` instead of `"both"` (the very regression this test
// exists to catch). We don't seed maintenance_hard_block: the merge
// under test is `envActive && dbActive`, and hard-block is a separate
// downstream concern with its own dedicated suite.
async function reseedDbRow(): Promise<void> {
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_mode", value: "true" })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: sql`EXCLUDED.value`, updatedAt: new Date() },
    });
  invalidateMaintenanceCache();
}

before(async () => {
  await reseedDbRow();
});

after(async () => {
  // Only delete the row this suite owns. Sibling suites are racing to
  // assert on adjacent maintenance_* rows; an `inArray(MAINTENANCE_KEYS)`
  // wipe here would trample them mid-test (see the comment in
  // maintenance-eta-admin.test.ts for the full rationale).
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_mode"));
  delete process.env["MAINTENANCE_MODE"];
  invalidateMaintenanceCache();
  await pool.end();
});

test("env var + admin DB toggle together: getMaintenanceState reports source='both' and active=true", async () => {
  // Sanity-check the env half of the overlap before asserting on the
  // merged shape. If MAINTENANCE_MODE somehow got cleared the merge
  // would report `"db"` and the assertion below would still fail, but
  // this gives a clearer error message about which side dropped out.
  assert.equal(
    process.env["MAINTENANCE_MODE"],
    "true",
    "MAINTENANCE_MODE must stay set so the merge has the env half of 'both' to report",
  );

  // Re-seed defensively: a sibling suite's after() teardown can race in
  // between our before() and this read, deleting the DB row we need.
  // The upsert + cache-bust restores both inputs to the merge.
  await reseedDbRow();

  const state = await getMaintenanceState();

  assert.equal(
    state.active,
    true,
    "either signal alone flips active=true; both signals together must too — anything else would be a regression in the OR merge",
  );
  assert.equal(
    state.source,
    "both",
    "with MAINTENANCE_MODE=true AND system_settings.maintenance_mode='true', the merge MUST report source='both' so the admin settings panel knows the operator has TWO switches to clear (collapsing to 'env' or 'db' would silently mislead them into clearing only one)",
  );
});
