import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Sibling of maintenance.test.ts (env-var path) and maintenance-db.test.ts
// (admin DB toggle, soft mode). This suite covers the THIRD branch of the
// maintenance contract that nothing else tests: the legacy "fully block all
// traffic" mode — `maintenance_mode = "true"` AND `maintenance_hard_block =
// "true"` together.
//
// Hard-block changes behaviour in two places relative to soft maintenance:
//   1. /system/status flips `writesDisabled` to FALSE while keeping
//      `maintenance` TRUE so the web app swaps the friendly inline banner for
//      the full-screen overlay (see public.ts: `writesDisabled = active &&
//      !hardBlock`).
//   2. authMiddleware additionally rejects authenticated NON-ADMIN reads with
//      the same structured 503 the maintenance middleware returns for writes,
//      while authenticated admins still get through (so they can flip the
//      toggle off from the admin UI).
//
// None of that is covered today. If a routine refactor of authMiddleware
// silently drops the hardBlock branch (e.g. inverts the `!user.isAdmin`
// guard, returns 200 instead of 503, or skips the maintenance lookup
// entirely), nobody notices until an ops incident actually flips the
// switch — exactly the worst time to find out.

// MAINTENANCE_MODE env var must be UNSET before importing the app so we are
// genuinely exercising the DB-only path. If a previous run leaked the env
// var into the process, source would be "env" or "both" and we wouldn't
// know the DB toggle is what's gating us.
delete process.env["MAINTENANCE_MODE"];
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

const { default: app } = await import("../../app");
const { db, pool, systemSettingsTable, usersTable } = await import("@workspace/db");
const {
  getMaintenanceState,
  invalidateMaintenanceCache,
} = await import("../../middlewares/maintenance");
const { signToken } = await import("../../middlewares/auth");
const { eq, inArray, sql } = await import("drizzle-orm");
const { teardownHttpServer, teardownRedis } = await import("./cleanup");

// Re-seed the maintenance rows + drop the in-memory cache. node:test runs
// each *.test.ts file in its own worker process IN PARALLEL by default, and
// the sibling suites (maintenance.test.ts, maintenance-db.test.ts,
// maintenance-invalidate.test.ts) all delete the same `maintenance_*` keys
// from `system_settings` in their own before()/after() hooks. Without an
// upsert + cache-bust right before each HTTP call here, a sibling suite's
// teardown can race in between our before()'s INSERT and the request, leaving
// the gate seeing an empty row set and our admin/settings handler reporting
// `maintenanceMode: false` even though we just seeded it.
async function reseedHardBlock(): Promise<void> {
  await db
    .insert(systemSettingsTable)
    .values([
      { key: "maintenance_mode", value: "true" },
      { key: "maintenance_hard_block", value: "true" },
    ])
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: sql`EXCLUDED.value`, updatedAt: new Date() },
    });
  invalidateMaintenanceCache();
}

let server: Server;
let baseUrl = "";

const MAINTENANCE_KEYS = [
  "maintenance_mode",
  "maintenance_hard_block",
  "maintenance_message",
  "maintenance_ends_at",
] as const;

// Unique-suffix fixture identities so reruns / concurrent suites don't
// collide on the users.email / users.referral_code unique constraints.
const SUFFIX = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const NON_ADMIN_EMAIL = `hard-block-user-${SUFFIX}@test.local`;
const ADMIN_EMAIL = `hard-block-admin-${SUFFIX}@test.local`;

let nonAdminId = 0;
let adminId = 0;
let nonAdminToken = "";
let adminToken = "";

before(async () => {
  // We want `maintenance_mode=true` AND `maintenance_hard_block=true`. Use
  // an upsert (rather than delete-then-insert) because a sibling suite
  // running in parallel may have a row with the same key — racing with
  // delete would surface as a unique-violation on insert. Each test below
  // additionally calls `reseedHardBlock()` so a sibling suite's after()
  // teardown firing mid-test can't strand us with empty rows.
  await reseedHardBlock();

  // adminMiddleware enforces an optional `admin_ip_whitelist`. If a previous
  // suite left a non-empty value behind, our admin request would 403 on the
  // IP check rather than reaching the route handler — masking whether
  // maintenance actually let the admin through. Clear it for the duration
  // of this suite.
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "admin_ip_whitelist"));

  // Create the two test identities. We bypass the /auth/register route
  // because (a) it's a POST and would itself be blocked by maintenance, and
  // (b) we need precise control over isAdmin/isFrozen/isDisabled so the
  // assertions are about hard-block behaviour, not account state.
  await db
    .delete(usersTable)
    .where(inArray(usersTable.email, [NON_ADMIN_EMAIL, ADMIN_EMAIL]));
  const inserted = await db
    .insert(usersTable)
    .values([
      {
        email: NON_ADMIN_EMAIL,
        passwordHash: "x",
        fullName: "Hard Block User",
        isAdmin: false,
        referralCode: `HBU${SUFFIX}`.slice(0, 20),
      },
      {
        email: ADMIN_EMAIL,
        passwordHash: "x",
        fullName: "Hard Block Admin",
        isAdmin: true,
        referralCode: `HBA${SUFFIX}`.slice(0, 20),
      },
    ])
    .returning({ id: usersTable.id, email: usersTable.email, isAdmin: usersTable.isAdmin });
  for (const row of inserted) {
    if (row.email === NON_ADMIN_EMAIL) nonAdminId = row.id;
    if (row.email === ADMIN_EMAIL) adminId = row.id;
  }
  // signToken uses the same JWT_SECRET that authMiddleware verifies against,
  // so a token minted here will round-trip through the real middleware.
  nonAdminToken = signToken(nonAdminId, false);
  adminToken = signToken(adminId, true);

  // Drop the in-memory cache so the very first request sees the rows we just
  // wrote (otherwise any state primed during module import — e.g. a boot-time
  // getMaintenanceState() call — would mask the new value for up to
  // CACHE_TTL_MS).
  invalidateMaintenanceCache();

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  await teardownHttpServer(server);
  // Clean up the rows we wrote so other suites get a clean baseline.
  await db
    .delete(systemSettingsTable)
    .where(inArray(systemSettingsTable.key, [...MAINTENANCE_KEYS]));
  await db
    .delete(usersTable)
    .where(inArray(usersTable.email, [NON_ADMIN_EMAIL, ADMIN_EMAIL]));
  invalidateMaintenanceCache();
  await teardownRedis();
  await pool.end();
});

test("hard-block: getMaintenanceState reports active+hardBlock with source=db", async () => {
  await reseedHardBlock();
  // Sanity check: prove we are exercising the DB-only hard-block branch.
  // If MAINTENANCE_MODE leaked back in, source would be "env"/"both" and we
  // wouldn't know the DB toggle is what's gating us. If hard_block didn't
  // round-trip through the merge correctly, hardBlock would be false and
  // every subsequent assertion would silently exercise the soft path.
  assert.equal(
    process.env["MAINTENANCE_MODE"],
    undefined,
    "MAINTENANCE_MODE must stay unset for the DB-only branch under test",
  );
  const state = await getMaintenanceState();
  assert.equal(state.active, true, "DB row maintenance_mode=true must flip state.active");
  assert.equal(state.hardBlock, true, "DB row maintenance_hard_block=true must flip state.hardBlock");
  assert.equal(
    state.source,
    "db",
    "with env var unset, the merge must report source=db so we know the DB branch is wired",
  );
});

test("hard-block: GET /api/system/status returns maintenance:true, writesDisabled:false", async () => {
  await reseedHardBlock();
  // The web app uses `writesDisabled` to choose between the inline banner
  // (soft maintenance, writesDisabled:true) and the full-screen overlay
  // (hard-block, writesDisabled:false). Flipping this contract would either
  // hide the overlay during a real lockout or accidentally show it during
  // routine soft maintenance — both are user-visible regressions.
  const res = await fetch(`${baseUrl}/api/system/status`);
  assert.equal(res.status, 200, "system/status must stay readable even under hard-block (it is unauthenticated)");
  assert.equal(res.headers.get("x-maintenance-mode"), "true");
  const body = (await res.json()) as {
    maintenance?: boolean;
    writesDisabled?: boolean;
  };
  assert.equal(
    body.maintenance,
    true,
    "hard-block must still surface as maintenance:true so the banner/overlay layer fires at all",
  );
  assert.equal(
    body.writesDisabled,
    false,
    "hard-block must report writesDisabled:false so the web app swaps to the full-screen overlay (not the inline banner)",
  );
});

test("hard-block: authenticated non-admin GET to /api/wallet returns structured 503 + Retry-After", async () => {
  await reseedHardBlock();
  // Reads are normally allowed during soft maintenance — what makes this
  // mode "hard" is that authMiddleware additionally rejects authenticated
  // non-admin requests, regardless of HTTP method. The wire shape mirrors
  // the soft-mode write rejection so the frontend's existing pattern-match
  // on `code: "maintenance_mode"` keeps working.
  const res = await fetch(`${baseUrl}/api/wallet`, {
    headers: { Authorization: `Bearer ${nonAdminToken}` },
  });
  assert.equal(
    res.status,
    503,
    "hard-block must reject authenticated non-admin reads with 503 (otherwise the legacy 'fully block all traffic' mode is broken)",
  );
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
  // Same wire contract as the env-var / DB-toggle write rejection — the
  // frontend pattern-matches on `code` regardless of which branch fired.
  assert.equal(body.error, "maintenance");
  assert.equal(body.code, "maintenance_mode");
  assert.equal(body.maintenance, true);
});

test("hard-block: authenticated admin GET to /api/admin/settings still passes through", async () => {
  await reseedHardBlock();
  // Defensive: also clear admin_ip_whitelist in case a sibling suite seeded
  // it after our before() ran. With a non-empty whitelist, adminMiddleware
  // would 403 our admin request before maintenance has anything to say.
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "admin_ip_whitelist"));
  // Critical escape hatch: an admin who flipped maintenance_mode +
  // maintenance_hard_block ON via /admin/settings must still be able to hit
  // /admin/* to flip it back OFF. Otherwise hard-block becomes a one-way
  // door from the admin UI and the only recovery is editing rows in the
  // DB by hand. authMiddleware's `!user.isAdmin` guard is exactly what
  // keeps this door open — assert the door stays open.
  const res = await fetch(`${baseUrl}/api/admin/settings`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.notEqual(
    res.status,
    503,
    "admin GET to /api/admin/* must NOT be 503 under hard-block — admins must be able to clear the toggle",
  );
  assert.equal(
    res.status,
    200,
    "admin GET to /api/admin/settings should succeed end-to-end (auth → admin gate → handler)",
  );
  const body = (await res.json()) as {
    maintenanceMode?: boolean;
    maintenanceHardBlock?: boolean;
  };
  // The handler reads back the same rows we seeded, so this also doubles as
  // a round-trip check that the toggle the admin would clear is the one we
  // believe is gating traffic.
  assert.equal(body.maintenanceMode, true);
  assert.equal(body.maintenanceHardBlock, true);
});
