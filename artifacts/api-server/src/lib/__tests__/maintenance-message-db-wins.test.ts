import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Sibling of the other maintenance suites and the deliberate inverse of
// maintenance-eta-env-wins.test.ts:
//
//   - maintenance-eta-env-wins.test.ts pins down that the OPERATOR (env) wins
//     over the admin (DB row) on `maintenance_ends_at` — that asymmetry is
//     the cutover-runbook escape hatch for the ETA.
//   - This file pins down the OPPOSITE precedence on `maintenance_message`:
//     the ADMIN (DB row) wins over the operator (env). The intent is in the
//     middleware comment — env doesn't carry a tailored-copy channel of its
//     own, so the admin's tailored "we're upgrading the Mumbai DB" copy must
//     out-rank a generic MAINTENANCE_MESSAGE Fly-secret fallback.
//
// The merged-state line is `message = dbMessage ?? envMessage ?? DEFAULT_MESSAGE`
// in middlewares/maintenance.ts. Same regression class as Task #77 just
// shipped for the ETA, but in the OPPOSITE direction: if a future refactor
// flipped the operands to `envMessage ?? dbMessage`, the admin's tailored
// copy would be silently overridden by whatever generic string the operator
// left in MAINTENANCE_MESSAGE — and nothing else in the suite would catch
// it. The env-only message path (no DB row to lose to) and the DB-only
// message path (env unset) would both still pass because their branches
// are unchanged.
//
// This file proves the precedence end-to-end:
//   1. DB value wins on `getMaintenanceState().message`
//   2. DB value wins on the public `/api/system/status` reader
//   3. With BOTH unset, `message` falls back to the `DEFAULT_MESSAGE`
//      constant — that's the third leg of the `??` chain and would
//      otherwise have no test coverage at all.

// CRITICAL: env vars must be in their starting state BEFORE the app /
// middleware modules import. The middleware reads process.env per-call so
// we re-set MAINTENANCE_MESSAGE per-test, but we want a clean baseline for
// any boot-time reads triggered by the import graph. Mirroring the prelude
// in maintenance-eta-env-wins.test.ts keeps the two suites' setup symmetric.
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
// on (`maintenance_message`). node:test runs each *.test.ts file in its
// own worker process IN PARALLEL, and the sibling maintenance suites
// (maintenance-hard-block, maintenance-both, maintenance-db,
// maintenance-eta-env-wins, maintenance-eta-admin, ...) seed
// `maintenance_mode` / `maintenance_hard_block` / `maintenance_ends_at`
// then make HTTP calls. Wiping or upserting those rows from THIS worker
// between their reseed and their fetch would race them straight to a
// flaky failure. Restricting our touch to `maintenance_message` keeps the
// assertions in this file unambiguous (we own that row outright) without
// trampling on what the other suites care about. Same rationale as
// maintenance-eta-env-wins.test.ts's clearMaintenanceEndsAtRow() helper.
async function clearMaintenanceMessageRow(): Promise<void> {
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "maintenance_message"));
  invalidateMaintenanceCache();
}

async function seedMaintenanceMessageRow(value: string): Promise<void> {
  // Upsert (rather than insert) so a sibling suite's reseed in between our
  // before() and the test body can't leave us with a stale value. The
  // generic admin upsert loop uses the same on-conflict shape, so this
  // mirrors what the admin path actually writes.
  await db
    .insert(systemSettingsTable)
    .values({ key: "maintenance_message", value })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: sql`EXCLUDED.value`, updatedAt: new Date() },
    });
  invalidateMaintenanceCache();
}

before(async () => {
  await clearMaintenanceMessageRow();
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
      await clearMaintenanceMessageRow();
      delete process.env["MAINTENANCE_MESSAGE"];
    } finally {
      await teardownRedis();
      await pool.end();
    }
  }
});

test("system_settings.maintenance_message row wins over MAINTENANCE_MESSAGE env var, and both-unset falls back to DEFAULT_MESSAGE", async () => {
  // Pick X (DB) and Y (env) such that X !== Y, both as plainly distinct
  // strings the admin / operator would realistically write — that way any
  // drift in the assertion is a real precedence bug rather than a
  // formatting artefact (e.g. accidental trim / case-fold).
  const dbValue = "Admin copy: upgrading the Mumbai DB, back in 30 min";
  const envValue = "Operator copy: scheduled maintenance in progress";
  assert.notEqual(
    dbValue,
    envValue,
    "X and Y must differ — otherwise this whole suite trivially passes regardless of which side wins",
  );

  await seedMaintenanceMessageRow(dbValue);
  process.env["MAINTENANCE_MESSAGE"] = envValue;
  // The middleware reads process.env on every call, but
  // getMaintenanceState() caches its merged result for CACHE_TTL_MS — so
  // the env var change is only picked up after a cache bust. Without
  // this, the very first state read could hit a leftover cached entry
  // from a sibling suite's call and the assertions would race.
  invalidateMaintenanceCache();

  try {
    // (1) In-process state helper: the DB value MUST win the merge.
    // This is the assertion that catches a flipped `??` order
    // (`envMessage ?? dbMessage`) — the env-only message path has no DB
    // row to lose to, so it can't.
    const state = await getMaintenanceState();
    assert.equal(
      state.message,
      dbValue,
      "getMaintenanceState().message must equal the admin's system_settings.maintenance_message row when both env and DB row are set — a future refactor that flipped the `??` operands (envMessage ?? dbMessage) would silently override the admin's tailored copy with the operator's generic Fly-secret fallback",
    );

    // (2) Public reader: /api/system/status surfaces the same merged
    // value through `maintenanceMessage`. Asserting on the public route
    // (not just the in-process helper) is what catches a regression
    // where the helper is right but the route accidentally re-reads
    // from process.env directly and bypasses the merge. With DB winning,
    // the public banner copy matches the admin's tailored string, not
    // the operator's generic fallback.
    const statusRes = await fetch(`${baseUrl}/api/system/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = (await statusRes.json()) as {
      maintenanceMessage?: string;
    };
    assert.equal(
      statusBody.maintenanceMessage,
      dbValue,
      "/api/system/status must report `maintenanceMessage` equal to the admin's DB row value when both env and DB are set — the public-facing banner copy is what users actually read, so it has to follow the same precedence",
    );

    // (3) Both unset → DEFAULT_MESSAGE fallback. This is the third leg
    // of the `??` chain (`dbMessage ?? envMessage ?? DEFAULT_MESSAGE`)
    // and would otherwise have no coverage anywhere in the suite — a
    // future refactor that lost the default (e.g. `?? null`) would let
    // the public banner surface an empty string with nothing else to
    // catch it. Asserting via the public route closes the loop end-to-
    // end. The exact DEFAULT_MESSAGE constant is a stability contract
    // for the banner copy, so we pin its value here rather than just
    // asserting "non-empty"; if product changes the default copy on
    // purpose, this line is the one place the change has to land.
    await clearMaintenanceMessageRow();
    delete process.env["MAINTENANCE_MESSAGE"];
    invalidateMaintenanceCache();

    const fallbackRes = await fetch(`${baseUrl}/api/system/status`);
    assert.equal(fallbackRes.status, 200);
    const fallbackBody = (await fallbackRes.json()) as {
      maintenanceMessage?: string;
    };
    assert.equal(
      fallbackBody.maintenanceMessage,
      "Brief maintenance in progress — balances will be back shortly.",
      "with both system_settings.maintenance_message and MAINTENANCE_MESSAGE unset, /api/system/status must fall back to the DEFAULT_MESSAGE constant — proves the third leg of the `??` chain is wired through to the public reader and not silently dropped to null/empty",
    );

    // Belt-and-braces: the in-process helper agrees on the fallback.
    // If steps (1)–(2) somehow stale-cached a non-default value, this
    // would catch it because the cache was busted right above this read.
    const fallbackState = await getMaintenanceState();
    assert.equal(
      fallbackState.message,
      "Brief maintenance in progress — balances will be back shortly.",
      "in-process getMaintenanceState() must also fall back to DEFAULT_MESSAGE once both env and DB are cleared",
    );
  } finally {
    delete process.env["MAINTENANCE_MESSAGE"];
    await clearMaintenanceMessageRow();
    invalidateMaintenanceCache();
  }
});
