import { test, after, before } from "node:test";
import assert from "node:assert/strict";

// Regression for the silent try/catch in getMaintenanceState() that wraps the
// `system_settings` lookup. The intent of that catch is "a transient DB blip
// must not flap the gate" — i.e. when the env var has frozen the system for a
// Mumbai-DB cutover, a Postgres burp during the freeze must NOT cause the
// merged state to silently drop back to {active:false} and let writes through.
//
// Two scenarios we want pinned down by tests:
//
//   1. ENV ON + DB throws  → state stays {active:true, source:"env"}.
//      A regression where the catch block also clears `envActive` (or where
//      `dbActive=false` somehow defeats `envActive=true` in the merge) would
//      lift the freeze the moment Postgres hiccupped — the worst possible
//      moment, since the cutover is exactly when the DB is least healthy.
//
//   2. ENV unset + DB row=true + DB throws  → state degrades to {active:false}.
//      This proves the catch block doesn't accidentally "remember" a stale
//      dbActive from a previous successful poll. We seed the row first so the
//      assertion is meaningful: even if a real row exists in Postgres, when
//      the lookup itself fails we MUST treat it as if no admin toggle was set
//      (env-only fallback). Otherwise the freeze state would depend on
//      whatever happened to be in memory at the moment of the failure.

// Ensure the env var starts unset so the first test (which sets it
// explicitly) and the second test (which depends on it being unset) both
// start from a known baseline. Other suites in this file's directory may
// have leaked env state if they ran in the same process — but `node --test`
// runs each test file in its own subprocess, so this is belt-and-braces.
delete process.env["MAINTENANCE_MODE"];
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

const dbModule = await import("@workspace/db");
const { db, pool, systemSettingsTable } = dbModule;
const {
  getMaintenanceState,
  invalidateMaintenanceCache,
} = await import("../../middlewares/maintenance");
const { inArray } = await import("drizzle-orm");

const MAINTENANCE_KEYS = [
  "maintenance_mode",
  "maintenance_hard_block",
  "maintenance_message",
  "maintenance_ends_at",
] as const;

// We monkey-patch `db.select` to simulate the underlying pool throwing on the
// `system_settings` lookup. Saving the original here means the after() hook
// can restore it cleanly even if a test fails partway through — otherwise a
// later test in the same process (none today, but the file may grow) would
// inherit a broken db.
const originalSelect = db.select.bind(db);

function breakDbSelect(): void {
  // Replace `db.select` with a function whose `.from(...).where(...)` chain
  // throws synchronously inside the try/catch in getMaintenanceState. The
  // production code does `await db.select().from(systemSettingsTable).where(...)`,
  // so throwing on the terminal `.where(...)` exercises the catch path
  // exactly the way a real query failure would (the awaitable rejects /
  // the chain raises before producing rows).
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

before(async () => {
  // Clear any rows another suite may have left behind so the second test's
  // assertion ("env unset + DB row exists + DB throws → active:false") isn't
  // mistakenly satisfied by a leftover row that happens to also be true.
  await db
    .delete(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [...MAINTENANCE_KEYS]));
  invalidateMaintenanceCache();
});

after(async () => {
  // Always restore — even if a test crashed mid-flight — so a subsequent
  // test (or a future addition to this file) doesn't inherit the broken
  // db.select shim.
  restoreDbSelect();
  await db
    .delete(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [...MAINTENANCE_KEYS]));
  invalidateMaintenanceCache();
  await pool.end();
});

test("ENV ON + DB throws: getMaintenanceState stays {active:true, source:'env'}", async () => {
  // Pin the env-var freeze (Mumbai-DB cutover scenario) and prove that a
  // burst of DB failures during the freeze does NOT drop the gate.
  process.env["MAINTENANCE_MODE"] = "true";
  // Drop the cache so the first call after we mutate the env / break the DB
  // actually re-runs the merge logic instead of returning a stale entry.
  invalidateMaintenanceCache();
  breakDbSelect();
  try {
    const state = await getMaintenanceState();
    assert.equal(
      state.active,
      true,
      "env-var freeze must survive a DB hiccup — otherwise an in-progress " +
        "Mumbai-DB cutover would silently lift the moment Postgres burped",
    );
    assert.equal(
      state.source,
      "env",
      "with ENV=true and the DB lookup throwing, the only surviving signal " +
        "is the env var, so source must report 'env' (not 'both', not null)",
    );
    assert.equal(
      state.hardBlock,
      false,
      "we never seeded maintenance_hard_block, and a thrown DB query must " +
        "not invent one — the catch block defaults dbHardBlock to false",
    );
    // Sanity: the cache MUST also reflect the env-only state. If a future
    // refactor accidentally bypassed the cache write on the catch path,
    // every subsequent request would re-run the failing query and pile up
    // load on an already-struggling DB.
    const second = await getMaintenanceState();
    assert.equal(second.active, true);
    assert.equal(second.source, "env");
  } finally {
    // Restore between tests so the next test starts from a clean baseline,
    // even though the after() hook also restores defensively.
    restoreDbSelect();
    delete process.env["MAINTENANCE_MODE"];
    invalidateMaintenanceCache();
  }
});

test("ENV unset + DB row=true + DB throws: state degrades to {active:false} (env-only fallback)", async () => {
  // Sanity: if env var leaked back in from a prior test or an outer harness,
  // the merge would short-circuit to envActive=true and this test would
  // pass for the wrong reason — masking the very regression class we care
  // about (catch block accidentally retaining a stale dbActive=true).
  assert.equal(
    process.env["MAINTENANCE_MODE"],
    undefined,
    "MAINTENANCE_MODE must stay unset for the env-only fallback under test",
  );

  // Seed a real row so the test exercises the realistic scenario: an admin
  // had previously toggled maintenance ON via the UI, and now the DB
  // lookup is failing. The catch block must NOT keep treating that row as
  // active — without a successful read, we have no fresh evidence either
  // way and must fall back to env-only.
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_mode", value: "true" })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: "true", updatedAt: new Date() },
    });

  invalidateMaintenanceCache();
  breakDbSelect();
  try {
    const state = await getMaintenanceState();
    assert.equal(
      state.active,
      false,
      "env unset + DB lookup throwing → fallback must be env-only (active:false). " +
        "If this fails, the catch block is somehow retaining a stale dbActive — " +
        "meaning the merged state would lie about whether maintenance is on " +
        "based on whatever was last in memory when the DB started failing.",
    );
    assert.equal(
      state.source,
      null,
      "with no active signal, source must be null (the merge only assigns " +
        "'env' / 'db' / 'both' when active === true)",
    );
    assert.equal(
      state.hardBlock,
      false,
      "hardBlock is dormant whenever active is false, regardless of any " +
        "value the failing query might have hypothetically returned",
    );
  } finally {
    restoreDbSelect();
    invalidateMaintenanceCache();
  }
});
