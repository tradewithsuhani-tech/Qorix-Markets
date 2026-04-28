import { test, after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

// Sibling of maintenance.test.ts (env-var path), maintenance-db.test.ts
// (admin DB toggle, soft mode), and maintenance-hard-block.test.ts (legacy
// full-block mode). Those suites cover the gating BEHAVIOUR — that traffic
// is actually frozen, that writes 503, that admins still get through. None
// of them prove that the new `maintenanceEffective` block on
// GET /admin/settings reports the correct `source` for each combination of
// env-var + DB toggle.
//
// That admin-facing field is what resolves the original "I flipped the
// toggle off but the banner is still up, why?" confusion: when the env var
// is also on, source="both" tells the admin UI to warn that flipping the DB
// toggle off alone won't fully clear maintenance. A regression that swaps
// the merge order or short-circuits one of the branches would silently
// re-introduce that exact confusion — and nothing else in the test suite
// would catch it because every other check looks at gating effects, not at
// the admin-settings response shape.

// Critical: env vars must be unset before importing the app/middleware so
// each test below can opt INTO MAINTENANCE_MODE explicitly without leaking
// state from a prior run/suite. The middleware reads process.env per call,
// but a stray value here would still land in the very first
// getMaintenanceState() result.
delete process.env["MAINTENANCE_MODE"];
delete process.env["MAINTENANCE_ETA"];
delete process.env["MAINTENANCE_MESSAGE"];

const { default: app } = await import("../../app");
const { db, pool, systemSettingsTable, usersTable } = await import("@workspace/db");
const { invalidateMaintenanceCache } = await import(
  "../../middlewares/maintenance"
);
const { signToken } = await import("../../middlewares/auth");
const { teardownHttpServer, teardownRedis } = await import("./cleanup");
const { eq, inArray, sql } = await import("drizzle-orm");

let server: Server;
let baseUrl = "";

// Unique-suffix fixture identity so reruns / concurrent suites don't collide
// on the users.email / users.referral_code unique constraints.
const SUFFIX = `${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const ADMIN_EMAIL = `maint-effective-admin-${SUFFIX}@test.local`;
let adminId = 0;
let adminToken = "";

// node:test runs each *.test.ts file in its own worker process IN PARALLEL,
// and the sibling maintenance suites (maintenance-db.test.ts /
// maintenance-hard-block.test.ts) also seed `maintenance_mode` and
// `maintenance_hard_block` rows. They guard against the race by reseeding
// immediately before each HTTP call; we mirror the same pattern here so a
// sibling suite's teardown firing between our seed and our fetch can't
// silently mutate the case we're asserting on. The `Stop the maintenance
// test suites from racing each other on shared rows` follow-up tracks the
// proper fix (a shared advisory lock or per-suite key namespace).
async function clearMaintenanceRows(): Promise<void> {
  await db
    .delete(systemSettingsTable)
    .where(
      inArray(systemSettingsTable.key, [
        "maintenance_mode",
        "maintenance_hard_block",
      ]),
    );
  invalidateMaintenanceCache();
}

async function upsertMaintenanceRow(key: string, value: string): Promise<void> {
  // Upsert (not delete-then-insert) because a sibling suite may already hold
  // a row on this key — racing against an in-flight DELETE would surface as
  // a unique-violation on insert. EXCLUDED.value ensures we win the merge
  // for our process even if the row was already present.
  await db
    .insert(systemSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: systemSettingsTable.key,
      set: { value: sql`EXCLUDED.value`, updatedAt: new Date() },
    });
}

async function clearWhitelist(): Promise<void> {
  // adminMiddleware refuses requests when an `admin_ip_whitelist` is set
  // and the caller's IP isn't on it. The test client connects from
  // 127.0.0.1, so any non-empty whitelist a sibling suite leaks would 403
  // our admin GET before maintenance has anything to say — masking the
  // source assertion as an unrelated auth failure.
  await db
    .delete(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "admin_ip_whitelist"));
}

function authedGetSettings(): Promise<Response> {
  return fetch(`${baseUrl}/api/admin/settings`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
  });
}

type EffectiveBlock = {
  active: boolean;
  source: "env" | "db" | "both" | null;
  hardBlock: boolean;
  endsAt: string | null;
  message: string;
};

async function readEffective(): Promise<EffectiveBlock> {
  const res = await authedGetSettings();
  assert.equal(
    res.status,
    200,
    "GET /api/admin/settings must succeed for the seeded admin — a non-200 here means auth/admin gating got in the way before we could check the maintenanceEffective shape",
  );
  const body = (await res.json()) as { maintenanceEffective?: EffectiveBlock };
  assert.ok(
    body.maintenanceEffective,
    "response must include the `maintenanceEffective` block — without it the admin UI has nothing to show 'which switch is freezing the site'",
  );
  return body.maintenanceEffective;
}

before(async () => {
  // Bypass /auth/register because (a) it's a POST and could be blocked by
  // an unrelated maintenance toggle racing in from a sibling suite, and
  // (b) we need precise control over isAdmin so authMiddleware /
  // adminMiddleware behave deterministically. signToken uses the same
  // JWT_SECRET that authMiddleware verifies, so the token round-trips
  // through the real middleware.
  await db.delete(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: ADMIN_EMAIL,
      passwordHash: "x",
      fullName: "Maintenance Effective Admin",
      isAdmin: true,
      adminRole: "admin",
      sponsorId: 0,
      referralCode: `MEA${SUFFIX}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  adminId = admin!.id;
  adminToken = signToken(adminId, true);

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  try {
    // See ./cleanup.ts for why both server.close() AND closeAllConnections()
    // are needed to release the event loop after fetch()-driven tests.
    await teardownHttpServer(server);
  } finally {
    try {
      // Best-effort cleanup. Each delete is scoped to identifiers we
      // created in `before`, so it's safe even on partial failures.
      if (adminId) {
        await db.delete(usersTable).where(eq(usersTable.id, adminId));
      }
      await clearMaintenanceRows();
      delete process.env["MAINTENANCE_MODE"];
    } finally {
      // Phase 6 added a Redis-backed auth-user cache to authMiddleware AND
      // a Redis-backed rate limiter to globalApiLimiter — both share the
      // ioredis singleton from lib/redis.ts. Without explicit teardown the
      // singleton's reconnect timer keeps node's event loop alive past the
      // suite finishing. See ./cleanup.ts for the full reasoning.
      await teardownRedis();
      await pool.end();
    }
  }
});

beforeEach(async () => {
  // Start every test from a known empty baseline: env unset, no
  // maintenance_* rows, no admin IP whitelist. Sibling suites can race in
  // between this and the per-test seed, which is why each test reseeds
  // *immediately* before its fetch (smallest possible window).
  delete process.env["MAINTENANCE_MODE"];
  await clearMaintenanceRows();
  await clearWhitelist();
});

test("source=env when only MAINTENANCE_MODE env var is set", async () => {
  // Env-only branch: ops set MAINTENANCE_MODE on Fly (the cutover-runbook
  // path) but the admin never touched the DB toggle. The admin UI relies
  // on source="env" to label the freeze as "set by ops, can't be cleared
  // from this UI" instead of pointing at the harmless DB toggle.
  process.env["MAINTENANCE_MODE"] = "true";
  invalidateMaintenanceCache();
  try {
    const eff = await readEffective();
    assert.equal(
      eff.active,
      true,
      "MAINTENANCE_MODE=true must surface as active=true on the merged effective state",
    );
    assert.equal(
      eff.source,
      "env",
      "with no DB row set, source must be 'env' — otherwise the admin UI can't tell the operator that ops, not the DB toggle, set the freeze",
    );
    assert.equal(
      eff.hardBlock,
      false,
      "no DB hard_block row was seeded — env path doesn't carry a hard-block signal of its own",
    );
  } finally {
    delete process.env["MAINTENANCE_MODE"];
    invalidateMaintenanceCache();
  }
});

test("source=db when only the DB toggle is set", async () => {
  // DB-only branch: an admin clicked the maintenance toggle in the UI for a
  // planned window. With no env var set, source must be "db" so the UI
  // can offer the "click here to clear" affordance pointed at the right
  // switch.
  assert.equal(
    process.env["MAINTENANCE_MODE"],
    undefined,
    "sanity: env var must stay unset so 'db' is the only possible source",
  );
  await upsertMaintenanceRow("maintenance_mode", "true");
  invalidateMaintenanceCache();
  const eff = await readEffective();
  assert.equal(
    eff.active,
    true,
    "DB row maintenance_mode=true must surface as active=true on the merged effective state",
  );
  assert.equal(
    eff.source,
    "db",
    "with env unset, source must be 'db' — otherwise the admin UI mislabels which switch is freezing the site and the toggle becomes 'why won't this work?'",
  );
  assert.equal(
    eff.hardBlock,
    false,
    "no DB hard_block row was seeded — soft maintenance only",
  );
});

test("source=both when both env var and DB toggle are set", async () => {
  // The whole reason this field exists: both signals on at once is the
  // exact "I flipped the toggle off but the banner is still up" trap from
  // the original bug report. source="both" is what the admin UI uses to
  // warn the operator that clearing the DB toggle alone WON'T lift the
  // freeze — they also need someone to unset the Fly secret.
  process.env["MAINTENANCE_MODE"] = "true";
  await upsertMaintenanceRow("maintenance_mode", "true");
  invalidateMaintenanceCache();
  try {
    const eff = await readEffective();
    assert.equal(eff.active, true, "either signal alone flips active=true; both together obviously do too");
    assert.equal(
      eff.source,
      "both",
      "source must be 'both' so the admin UI surfaces the dual-source warning — anything else (env, db, or null) silently re-introduces the original 'why is the banner still up?' confusion",
    );
  } finally {
    delete process.env["MAINTENANCE_MODE"];
    invalidateMaintenanceCache();
  }
});

test("source=null and active=false when neither switch is set", async () => {
  // Negative case: not active means source must be null. A non-null source
  // while inactive would lie to the admin UI about a switch that isn't
  // engaged (e.g. lighting up "ops set this" when nothing is set).
  // beforeEach already cleared rows + env; just invalidate the cache so
  // we read the current state, not anything primed by a sibling suite.
  invalidateMaintenanceCache();
  const eff = await readEffective();
  assert.equal(
    eff.active,
    false,
    "with neither switch set the merged state must report active=false",
  );
  assert.equal(
    eff.source,
    null,
    "source must be null when not active — non-null while inactive would point the admin UI at a phantom switch",
  );
});

test("hardBlock=true when DB hard_block is set AND maintenance is active", async () => {
  // Seed both rows so the legacy "fully block all traffic" mode is on.
  // The admin UI uses maintenanceEffective.hardBlock to choose between
  // the inline-banner copy (soft maintenance) and the lockout-warning
  // copy (hard-block). Misreporting this would either hide the lockout
  // warning during a real full-block window or scare admins with a fake
  // lockout warning during routine soft maintenance.
  await upsertMaintenanceRow("maintenance_mode", "true");
  await upsertMaintenanceRow("maintenance_hard_block", "true");
  invalidateMaintenanceCache();
  const eff = await readEffective();
  assert.equal(eff.active, true, "maintenance_mode=true must flip active");
  assert.equal(
    eff.source,
    "db",
    "sanity: env stayed unset, so hardBlock case is exercised through the DB branch",
  );
  assert.equal(
    eff.hardBlock,
    true,
    "with maintenance active and DB hard_block=true, hardBlock must be true so the admin UI picks the lockout-warning copy",
  );
});

test("hardBlock stays false when DB hard_block is set but maintenance is OFF", async () => {
  // hard_block is meaningless without maintenance_mode — the merge masks
  // it to false unless `active` is also true. Exposing a dormant
  // hard_block row as hardBlock=true would scare admins into thinking
  // the lockout is engaged when nothing is actually frozen.
  await upsertMaintenanceRow("maintenance_hard_block", "true");
  // Explicitly do NOT seed maintenance_mode; do NOT set MAINTENANCE_MODE.
  invalidateMaintenanceCache();
  const eff = await readEffective();
  assert.equal(
    eff.active,
    false,
    "no maintenance_mode row + no env var => not active, regardless of hard_block being seeded",
  );
  assert.equal(
    eff.source,
    null,
    "source must be null while inactive even if other maintenance_* rows exist",
  );
  assert.equal(
    eff.hardBlock,
    false,
    "hard_block must be reported as false while inactive — otherwise a stale row in system_settings lights up the admin lockout warning for a switch that isn't engaged",
  );
});
