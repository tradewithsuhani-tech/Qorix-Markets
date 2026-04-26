import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";

const { default: app } = await import("../../app");
const { db, pool, usersTable, systemSettingsTable } = await import("@workspace/db");
const { eq, count, isNull, ne, or } = await import("drizzle-orm");

// Mirror the sibling smoke-filter suites: forge a JWT against the same secret
// authMiddleware uses, dropping back to the dev default if SESSION_SECRET is
// unset in the test env.
const JWT_SECRET = process.env["SESSION_SECRET"] || "qorix-markets-secret";

const RUN_TAG = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ADMIN_EMAIL = `admin-${RUN_TAG}@smoke-users-list-test.local`;
const SMOKE_EMAIL = `smoke-${RUN_TAG}@smoke-users-list-test.local`;
const NORMAL_EMAIL = `normal-${RUN_TAG}@smoke-users-list-test.local`;

let server: Server;
let baseUrl = "";
let adminId = 0;
let smokeUserId = 0;
let normalUserId = 0;
let adminToken = "";

let prevWhitelist: string | null | undefined;
let hadWhitelistRow = false;

before(async () => {
  // adminMiddleware refuses requests when an `admin_ip_whitelist` is set and
  // the caller's IP isn't on it. The test client connects from 127.0.0.1, so
  // make sure no whitelist is configured for the duration of this suite.
  const existing = await db
    .select({ value: systemSettingsTable.value })
    .from(systemSettingsTable)
    .where(eq(systemSettingsTable.key, "admin_ip_whitelist"))
    .limit(1);
  if (existing[0]) {
    hadWhitelistRow = true;
    prevWhitelist = existing[0].value;
    await db
      .update(systemSettingsTable)
      .set({ value: "" })
      .where(eq(systemSettingsTable.key, "admin_ip_whitelist"));
  }

  // Dedicated admin backing the JWT we'll mint. authMiddleware re-loads the
  // user from the DB on every request, so the row has to exist.
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: ADMIN_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Users-List Filter Test Admin",
      isAdmin: true,
      adminRole: "admin",
      sponsorId: 0,
      referralCode: `ADM-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  adminId = admin!.id;

  // The smoke-test account: flagged with is_smoke_test=true. It must be
  // hidden from the default /admin/users list AND not counted in the paging
  // `total` or in /admin/system-health's stats.totalUsers headline.
  const [smoke] = await db
    .insert(usersTable)
    .values({
      email: SMOKE_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Users-List Filter Test Smoke",
      isSmokeTest: true,
      sponsorId: 0,
      referralCode: `SMK-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  smokeUserId = smoke!.id;

  // A normal user — paired so each "smoke hidden" assertion comes with a
  // "normal still visible" sanity check. That way an empty/zero response
  // can't be misread as the filter working.
  const [normal] = await db
    .insert(usersTable)
    .values({
      email: NORMAL_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Users-List Filter Test Normal",
      sponsorId: 0,
      referralCode: `NRM-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  normalUserId = normal!.id;

  adminToken = jwt.sign({ userId: adminId, isAdmin: true }, JWT_SECRET);

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  try {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } finally {
    try {
      // Best-effort cleanup of every row we inserted. Each delete is scoped
      // to a unique RUN_TAG-derived ID so it can't touch unrelated rows.
      // The smoke user is intentionally deleted mid-run by the totals test
      // and its id is zeroed; guard with truthy checks so we don't double-delete.
      if (adminId) await db.delete(usersTable).where(eq(usersTable.id, adminId));
      if (smokeUserId) await db.delete(usersTable).where(eq(usersTable.id, smokeUserId));
      if (normalUserId) await db.delete(usersTable).where(eq(usersTable.id, normalUserId));
      if (hadWhitelistRow) {
        await db
          .update(systemSettingsTable)
          .set({ value: prevWhitelist ?? "" })
          .where(eq(systemSettingsTable.key, "admin_ip_whitelist"));
      }
    } finally {
      await pool.end();
    }
  }
});

function authedFetch(path: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

interface UsersPage {
  data: Array<{ id: number; email: string }>;
  total: number;
  page: number;
  totalPages: number;
}

// Walk every page of /admin/users so a busy shared dev DB can't push our
// seeded rows off the first page. Returns the union of (id, email) tuples
// plus the route's reported `total` (which is itself filtered by the same
// smoke predicate as the rows).
async function listAllAdminUsers(includeSmoke: boolean): Promise<{
  ids: Set<number>;
  emails: Set<string>;
}> {
  const ids = new Set<number>();
  const emails = new Set<string>();
  const limit = 500;
  const suffix = includeSmoke ? "&includeSmokeTest=true" : "";
  let page = 1;
  // Hard cap so a misbehaving endpoint can't loop forever.
  for (let safety = 0; safety < 50; safety++) {
    const res = await authedFetch(`/api/admin/users?page=${page}&limit=${limit}${suffix}`);
    assert.equal(
      res.status,
      200,
      `/api/admin/users page=${page} limit=${limit} should return 200, got ${res.status}`,
    );
    const body = (await res.json()) as UsersPage;
    for (const u of body.data) {
      ids.add(u.id);
      emails.add(u.email);
    }
    if (body.data.length === 0 || page >= body.totalPages) break;
    page++;
  }
  return { ids, emails };
}

// Fetch just the paging `total` cheaply (limit=1 keeps the per-row
// Promise.all expansion in /admin/users from doing real work).
async function getUsersTotal(includeSmoke: boolean): Promise<number> {
  const suffix = includeSmoke ? "&includeSmokeTest=true" : "";
  const res = await authedFetch(`/api/admin/users?page=1&limit=1${suffix}`);
  assert.equal(
    res.status,
    200,
    `/api/admin/users (total snapshot) should return 200, got ${res.status}`,
  );
  const body = (await res.json()) as UsersPage;
  return body.total;
}

async function getSystemHealthTotalUsers(): Promise<number> {
  const res = await authedFetch(`/api/admin/system-health`);
  assert.equal(
    res.status,
    200,
    `/api/admin/system-health should return 200, got ${res.status}`,
  );
  const body = (await res.json()) as { stats: { totalUsers: number } };
  return body.stats.totalUsers;
}

interface FilterSnapshot {
  defaultTotal: number;
  includeSmokeTotal: number;
  systemHealthTotal: number;
  dbAllCount: number;
  dbNonSmokeCount: number;
  dbSmokeCount: number;
}

// Take all five counts in parallel so the time window between them is as
// tight as possible. Sibling smoke-filter suites run in their own
// subprocesses (node --test runs files concurrently) and their setup /
// teardown can insert or delete users at any moment. Doing the snapshot
// in Promise.all keeps the racy window down to a few ms.
async function captureFilterSnapshot(): Promise<FilterSnapshot> {
  const [
    defaultTotal,
    includeSmokeTotal,
    systemHealthTotal,
    dbAllRow,
    dbNonSmokeRow,
    dbSmokeRow,
  ] = await Promise.all([
    getUsersTotal(false),
    getUsersTotal(true),
    getSystemHealthTotalUsers(),
    db.select({ count: count() }).from(usersTable),
    // Mirror notSmokeTestUser() exactly: NULL counts as "not smoke".
    db
      .select({ count: count() })
      .from(usersTable)
      .where(or(ne(usersTable.isSmokeTest, true), isNull(usersTable.isSmokeTest))!),
    db
      .select({ count: count() })
      .from(usersTable)
      .where(eq(usersTable.isSmokeTest, true)),
  ]);
  return {
    defaultTotal,
    includeSmokeTotal,
    systemHealthTotal,
    dbAllCount: Number(dbAllRow[0]?.count ?? 0),
    dbNonSmokeCount: Number(dbNonSmokeRow[0]?.count ?? 0),
    dbSmokeCount: Number(dbSmokeRow[0]?.count ?? 0),
  };
}

// Repeat the snapshot until the API totals and direct DB counts agree —
// i.e. nothing changed in the window between API call and DB query. With
// retries we don't depend on absolute "no concurrent test" assumptions.
async function captureConsistentSnapshot(maxAttempts = 8): Promise<FilterSnapshot> {
  let last: FilterSnapshot | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const snap = await captureFilterSnapshot();
    if (
      snap.includeSmokeTotal === snap.dbAllCount &&
      snap.defaultTotal === snap.dbNonSmokeCount &&
      snap.systemHealthTotal === snap.dbNonSmokeCount
    ) {
      return snap;
    }
    last = snap;
  }
  throw new Error(
    `could not capture a consistent users-table snapshot after ${maxAttempts} attempts ` +
      `(last: api default=${last?.defaultTotal} api includeSmoke=${last?.includeSmokeTotal} ` +
      `api systemHealth=${last?.systemHealthTotal} db all=${last?.dbAllCount} ` +
      `db nonSmoke=${last?.dbNonSmokeCount} db smoke=${last?.dbSmokeCount}) — ` +
      `concurrent test activity is too high to verify the smoke filter`,
  );
}

test("/admin/users hides the smoke-test account's email by default", async () => {
  const { ids, emails } = await listAllAdminUsers(false);
  // Sanity: the normal user we seeded must be visible. Without this pair the
  // "smoke missing" assertion below could pass for the wrong reason (e.g.
  // route returning an empty page).
  assert.ok(
    ids.has(normalUserId),
    `seeded normal user ${normalUserId} must appear in default /admin/users (sanity check)`,
  );
  assert.ok(
    emails.has(NORMAL_EMAIL),
    `seeded normal email ${NORMAL_EMAIL} must appear in default /admin/users (sanity check)`,
  );
  assert.ok(
    !ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must NOT appear in default /admin/users — the notSmokeTestUser() filter regressed and the smoke account is now in the admin user table on every page load`,
  );
  assert.ok(
    !emails.has(SMOKE_EMAIL),
    `smoke-test email ${SMOKE_EMAIL} must NOT appear in default /admin/users — the notSmokeTestUser() filter regressed`,
  );
});

test("/admin/users returns the smoke-test account's email with ?includeSmokeTest=true", async () => {
  const { ids, emails } = await listAllAdminUsers(true);
  assert.ok(
    ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must appear in /admin/users when admins explicitly opt in`,
  );
  assert.ok(
    emails.has(SMOKE_EMAIL),
    `smoke-test email ${SMOKE_EMAIL} must appear in /admin/users when admins explicitly opt in`,
  );
  assert.ok(
    ids.has(normalUserId),
    `normal user ${normalUserId} must still appear when ?includeSmokeTest=true`,
  );
  assert.ok(
    emails.has(NORMAL_EMAIL),
    `normal email ${NORMAL_EMAIL} must still appear when ?includeSmokeTest=true`,
  );
});

test("/admin/users paging `total` and /admin/system-health stats.totalUsers exclude exactly the smoke-test account", async () => {
  // Strategy: capture a "consistent snapshot" — API totals taken in
  // Promise.all alongside direct DB counts using the same predicates the
  // routes apply. Retry until the API↔DB pairs agree, which means no
  // concurrent test inserted/deleted users in the racy window. Then verify:
  //
  //   1. /admin/users.total (default) = COUNT(*) WHERE NOT is_smoke_test
  //      → the default filter is correct
  //   2. /admin/users.total (?includeSmokeTest=true) = COUNT(*)
  //      → the opt-in disables the filter
  //   3. /admin/system-health.totalUsers = COUNT(*) WHERE NOT is_smoke_test
  //      → the headline always applies the filter (no opt-in there)
  //   4. The DB does in fact contain at least one smoke user (ours), so the
  //      filter is non-vacuously asserting something.
  //
  // Then delete OUR smoke user and re-snapshot. Verify the smoke count went
  // down by exactly 1 (proving our deletion worked) and the API↔DB equalities
  // STILL hold (proving the filter still excludes whatever smoke users
  // remain). This is concurrency-safe under parallel sibling suites because
  // the per-snapshot retry absorbs other tests' churn.

  const before = await captureConsistentSnapshot();

  // Sanity precondition: our seeded smoke user is in the DB right now and is
  // contributing to the smoke count. Without this the assertions below could
  // pass vacuously (e.g. dbSmokeCount = 0 makes the filter trivially correct).
  assert.ok(
    before.dbSmokeCount >= 1,
    `precondition: at least one smoke user (ours, id ${smokeUserId}) must exist in the DB ` +
      `(saw dbSmokeCount=${before.dbSmokeCount}) — the smoke filter assertion would be vacuous otherwise`,
  );

  // Filter invariants (these are the assertions the test exists to make).
  assert.equal(
    before.includeSmokeTotal,
    before.dbAllCount,
    `/admin/users?includeSmokeTest=true total (${before.includeSmokeTotal}) must equal the ` +
      `unfiltered DB user count (${before.dbAllCount}) — the opt-in branch must disable the filter`,
  );
  assert.equal(
    before.defaultTotal,
    before.dbNonSmokeCount,
    `default /admin/users.total (${before.defaultTotal}) must equal COUNT(users WHERE NOT is_smoke_test) ` +
      `(${before.dbNonSmokeCount}) — if these disagree the smoke account is being counted in the paging ` +
      `total even with the default filter, inflating the admin user table footer`,
  );
  assert.equal(
    before.systemHealthTotal,
    before.dbNonSmokeCount,
    `/admin/system-health stats.totalUsers (${before.systemHealthTotal}) must equal ` +
      `COUNT(users WHERE NOT is_smoke_test) (${before.dbNonSmokeCount}) — if these disagree the smoke ` +
      `account is being counted in the platform-wide user headline, inflating it on every deploy`,
  );

  // Step 2: delete our smoke user. This is the smoke account's exact
  // contribution to each count. The filter invariants must STILL hold — and
  // dbSmokeCount must drop by exactly 1, proving our deletion took effect
  // and the new equalities aren't holding for the wrong reason (e.g.
  // because the API stopped returning rows altogether).
  await db.delete(usersTable).where(eq(usersTable.id, smokeUserId));
  const removedSmokeUserId = smokeUserId;
  // Make sure cleanup in `after` doesn't try to delete it again.
  smokeUserId = 0;

  const afterDelete = await captureConsistentSnapshot();

  assert.equal(
    before.dbSmokeCount - afterDelete.dbSmokeCount,
    1,
    `deleting the seeded smoke user (id ${removedSmokeUserId}) must reduce the DB smoke-user count ` +
      `by exactly 1 (before=${before.dbSmokeCount}, after=${afterDelete.dbSmokeCount}) — ` +
      `if not, our deletion was lost or another smoke row appeared during the test`,
  );

  // Filter invariants must continue to hold after the deletion: the routes
  // must still match the predicate-aligned DB counts to the row.
  assert.equal(
    afterDelete.includeSmokeTotal,
    afterDelete.dbAllCount,
    `after deleting the smoke user, /admin/users?includeSmokeTest=true.total (${afterDelete.includeSmokeTotal}) ` +
      `must still equal the unfiltered DB user count (${afterDelete.dbAllCount})`,
  );
  assert.equal(
    afterDelete.defaultTotal,
    afterDelete.dbNonSmokeCount,
    `after deleting the smoke user, default /admin/users.total (${afterDelete.defaultTotal}) ` +
      `must still equal COUNT(users WHERE NOT is_smoke_test) (${afterDelete.dbNonSmokeCount})`,
  );
  assert.equal(
    afterDelete.systemHealthTotal,
    afterDelete.dbNonSmokeCount,
    `after deleting the smoke user, /admin/system-health stats.totalUsers (${afterDelete.systemHealthTotal}) ` +
      `must still equal COUNT(users WHERE NOT is_smoke_test) (${afterDelete.dbNonSmokeCount})`,
  );

  void removedSmokeUserId;
});
