import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Sibling of the other maintenance ETA suites:
//   - maintenance.test.ts                 covers the env-only ETA path
//                                         (process.env.MAINTENANCE_ETA set,
//                                         no DB row).
//   - maintenance-eta-admin.test.ts       covers the admin-set DB-only ETA
//                                         path (system_settings row set,
//                                         env unset) and even calls out
//                                         in its prologue that env wins
//                                         over the DB row — but it
//                                         deliberately keeps the env var
//                                         UNSET to isolate the DB branch.
//
// The MERGED case is the gap: when an operator has set MAINTENANCE_ETA via
// Fly secret AND an admin has also persisted an ETA via POST /admin/settings,
// `getMaintenanceState()` resolves `endsAt = envEndsAt ?? dbEndsAt`. The
// `??` order is the cutover-runbook escape hatch — the operator value MUST
// win so an admin who left a stale ETA in the row can't silently clobber
// the operator-set countdown. If a future refactor flipped the operands
// (e.g. `dbEndsAt ?? envEndsAt`) the runbook would silently lose that
// override and nothing else in the suite would catch it: the env-only
// suite would still pass (no DB row to lose to), and the DB-only suite
// keeps the env unset on purpose.
//
// This file proves the precedence end-to-end:
//   1. env value wins on `getMaintenanceState().endsAt`
//   2. env value wins on the public `/api/system/status` reader
//   3. the DB row is NOT mutated by the env winning the read — so removing
//      the env var falls back to the same DB value cleanly (no silent
//      data loss in the admin row).

// CRITICAL: env vars must be in their starting state BEFORE the app /
// middleware modules import. The middleware reads process.env per-call so
// we re-set MAINTENANCE_ETA per-test, but we want a clean baseline for any
// boot-time reads triggered by the import graph. Mirroring the prelude in
// maintenance-eta-admin.test.ts keeps the two suites' setup symmetric.
delete process.env["MAINTENANCE_MODE"];
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

const { default: app } = await import("../../app");
const { db, pool, systemSettingsTable } = await import("@workspace/db");
const {
  invalidateMaintenanceCache,
  getMaintenanceState,
} = await import("../../middlewares/maintenance");
const { eq, sql } = await import("drizzle-orm");
const { teardownHttpServer, teardownRedis } = await import("./cleanup");

let server: Server;
let baseUrl = "";

// IMPORTANT: only ever delete / upsert the ONE row this suite is asserting
// on (`maintenance_ends_at`). node:test runs each *.test.ts file in its own
// worker process IN PARALLEL, and the sibling maintenance suites
// (maintenance-hard-block, maintenance-both, maintenance-db, ...) seed
// `maintenance_mode` / `maintenance_hard_block` then make HTTP calls.
// Wiping or upserting those rows from THIS worker between their reseed and
// their fetch would race them straight to a flaky failure. Restricting our
// touch to `maintenance_ends_at` keeps the assertions in this file
// unambiguous (we own that row outright) without trampling on what the
// other suites care about. Same rationale as
// maintenance-eta-admin.test.ts's clearMaintenanceEndsAtRow() helper.
async function clearMaintenanceEndsAtRow(): Promise<void> {
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_ends_at"));
  invalidateMaintenanceCache();
}

async function seedMaintenanceEndsAtRow(value: string): Promise<void> {
  // Upsert (rather than insert) so a sibling suite's reseed in between our
  // before() and the test body can't leave us with a stale value. The
  // generic admin upsert loop uses the same on-conflict shape, so this
  // mirrors what the admin path actually writes.
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_ends_at", value })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: sql`EXCLUDED.value`, updatedAt: new Date() },
    });
  invalidateMaintenanceCache();
}

async function readMaintenanceEndsAtRow(): Promise<string | null> {
  const rows = await db
    .select()
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_ends_at"))
    .limit(1);
  return rows[0]?.value ?? null;
}

before(async () => {
  await clearMaintenanceEndsAtRow();
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  try {
    await teardownHttpServer(server);
  } finally {
    try {
      await clearMaintenanceEndsAtRow();
      delete process.env["MAINTENANCE_ETA"];
    } finally {
      await teardownRedis();
      await pool.end();
    }
  }
});

test("MAINTENANCE_ETA env var wins over admin-set system_settings.maintenance_ends_at row, and the DB row is preserved", async () => {
  // Pick X (DB) and Y (env) such that X !== Y, both as canonical UTC ISO
  // strings — that's the shape getMaintenanceState() normalises both
  // branches into, so any drift in the assertion is a real precedence
  // bug rather than a formatting artefact.
  const dbValue = "2099-07-07T07:07:07.000Z"; // X — what the admin left in the row
  const envValue = "2099-08-08T08:08:08.000Z"; // Y — what the operator set via Fly secret
  assert.notEqual(
    dbValue,
    envValue,
    "X and Y must differ — otherwise this whole suite trivially passes regardless of which side wins",
  );

  await seedMaintenanceEndsAtRow(dbValue);
  process.env["MAINTENANCE_ETA"] = envValue;
  // getEnvMaintenanceEndsAt() reads process.env on every call, but
  // getMaintenanceState() caches its merged result for CACHE_TTL_MS — so
  // the env var change is only picked up after a cache bust. Without
  // this, the very first state read could hit a leftover cached entry
  // from a sibling suite's call and the assertions would race.
  invalidateMaintenanceCache();

  try {
    // (1) In-process state helper: the env value MUST win the merge.
    // This is the assertion that catches a flipped `??` order — the
    // env-only suite has no DB row to lose to, so it can't.
    const state = await getMaintenanceState();
    assert.equal(
      state.endsAt,
      envValue,
      "getMaintenanceState().endsAt must equal the MAINTENANCE_ETA env value when both env and DB row are set — a future refactor that flipped the `??` operands (dbEndsAt ?? envEndsAt) would silently take this escape hatch away from the cutover runbook",
    );

    // (2) Public reader: /api/system/status surfaces the same merged
    // value through `maintenanceEndsAt`. Asserting on the public route
    // (not just the in-process helper) is what catches a regression
    // where the helper is right but the route accidentally re-reads
    // from the DB directly and bypasses the merge. With env winning,
    // the public banner countdown matches the operator's value, not
    // the admin's.
    const statusRes = await fetch(`${baseUrl}/api/system/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as {
      maintenanceEndsAt?: string | null;
    };
    assert.equal(
      statusBody.maintenanceEndsAt,
      envValue,
      "/api/system/status must report `maintenanceEndsAt` equal to the env value when both env and DB are set — the public-facing banner countdown is what users actually see, so it has to follow the same precedence",
    );

    // (3) DB row preservation: env winning the READ must NOT mutate the
    // admin's row. If we ever start clearing it as a side-effect of the
    // env value winning, removing the env var (e.g. when the cutover
    // ends and the operator unsets MAINTENANCE_ETA) would leave the
    // public banner with NO ETA at all — silent data loss in the admin
    // row. Keeping the row intact is what makes the env override safe
    // for the admin to live with.
    assert.equal(
      await readMaintenanceEndsAtRow(),
      dbValue,
      "system_settings.maintenance_ends_at must still hold the admin's value after env-wins reads — env precedence is read-only, it must never mutate the DB row out from under the admin",
    );

    // (4) Concrete proof of (3): unset the env var and the SAME DB row
    // must surface as `maintenanceEndsAt` on the public route. This
    // closes the loop: the env override is genuinely transparent — the
    // moment the operator clears MAINTENANCE_ETA the admin's value is
    // back, no resave required. Anything else (e.g. the row got
    // cleared in step 3, or the merge accidentally cached the env
    // value beyond the cache bust) would surface as a null here.
    delete process.env["MAINTENANCE_ETA"];
    invalidateMaintenanceCache();

    const fallbackRes = await fetch(`${baseUrl}/api/system/status`);
    assert.equal(fallbackRes.status, 200);
    const fallbackBody = (await fallbackRes.json()) as {
      maintenanceEndsAt?: string | null;
    };
    assert.equal(
      fallbackBody.maintenanceEndsAt,
      dbValue,
      "with MAINTENANCE_ETA env var cleared, /api/system/status must fall back to the admin's DB row value cleanly — proves the env override never mutated the DB row and that the operator unsetting the secret restores the admin's countdown automatically",
    );

    // Belt-and-braces: the in-process helper agrees on the fallback.
    // If steps (1)–(2) somehow stale-cached the env value, this would
    // catch it because the cache was busted right above this read.
    const fallbackState = await getMaintenanceState();
    assert.equal(
      fallbackState.endsAt,
      dbValue,
      "in-process getMaintenanceState() must also fall back to the DB row once MAINTENANCE_ETA is cleared",
    );
  } finally {
    delete process.env["MAINTENANCE_ETA"];
    invalidateMaintenanceCache();
  }
});
