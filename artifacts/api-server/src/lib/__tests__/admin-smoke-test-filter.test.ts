import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";

const { default: app } = await import("../../app");
const { db, pool, usersTable, systemSettingsTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");

// SESSION_SECRET is set in the test env; fall back to the same dev default
// the auth middleware uses so the JWTs we forge here match what authMiddleware
// will accept.
const JWT_SECRET = process.env["SESSION_SECRET"] || "qorix-markets-secret";

const RUN_TAG = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ADMIN_EMAIL = `admin-${RUN_TAG}@smoke-filter-test.local`;
const SMOKE_EMAIL = `smoke-${RUN_TAG}@smoke-filter-test.local`;
const NORMAL_EMAIL = `normal-${RUN_TAG}@smoke-filter-test.local`;

let server: Server;
let baseUrl = "";
let adminId = 0;
let smokeUserId = 0;
let normalUserId = 0;
let adminToken = "";

// `undefined` = no row at start. `null`/string = row was present with that
// value and must be restored on teardown.
let prevWhitelist: string | null | undefined;
let hadWhitelistRow = false;

before(async () => {
  // adminMiddleware refuses requests when an `admin_ip_whitelist` is set and
  // the caller's IP isn't on it. The test client connects from 127.0.0.1, so
  // make sure no whitelist is configured for the duration of this suite — and
  // restore the prior value in `after` so we don't surprise other suites or
  // local dev sessions sharing this DB.
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

  // Seed a dedicated admin so we have a real user backing the JWT we'll mint.
  // (authMiddleware re-loads the user from the DB on every request and 401s
  //  if it's missing or disabled.)
  const [admin] = await db
    .insert(usersTable)
    .values({
      email: ADMIN_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Filter Test Admin",
      isAdmin: true,
      adminRole: "admin",
      sponsorId: 0,
      referralCode: `ADM-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  adminId = admin!.id;

  // The smoke-test account: flagged with is_smoke_test=true, and seeded with
  // both KYC queues in "pending" so the identity AND address admin queues
  // have something to filter out.
  const [smoke] = await db
    .insert(usersTable)
    .values({
      email: SMOKE_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Filter Test Smoke",
      isSmokeTest: true,
      kycStatus: "pending",
      kycSubmittedAt: new Date(),
      kycAddressStatus: "pending",
      kycAddressSubmittedAt: new Date(),
      sponsorId: 0,
      referralCode: `SMK-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  smokeUserId = smoke!.id;

  // A normal user in the same pending KYC states. This is what we expect to
  // KEEP seeing in the default-filtered admin views, so the assertion "smoke
  // hidden" can't be confused with "queue empty for unrelated reasons".
  const [normal] = await db
    .insert(usersTable)
    .values({
      email: NORMAL_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Filter Test Normal",
      kycStatus: "pending",
      kycSubmittedAt: new Date(),
      kycAddressStatus: "pending",
      kycAddressSubmittedAt: new Date(),
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
      // Best-effort cleanup. Each delete is scoped to a unique RUN_TAG-derived
      // ID we created in `before`, so it's safe even on partial failures.
      if (adminId)  await db.delete(usersTable).where(eq(usersTable.id, adminId));
      if (smokeUserId)  await db.delete(usersTable).where(eq(usersTable.id, smokeUserId));
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

// Walk every page of /admin/users so we don't get fooled by pagination if the
// shared test DB has many users. Returns the union of IDs and the route's
// reported `total` (which is itself filtered by the same smoke predicate).
async function listAllAdminUserIds(includeSmoke: boolean): Promise<{ ids: Set<number>; total: number }> {
  const ids = new Set<number>();
  const limit = 500;
  const suffix = includeSmoke ? "&includeSmokeTest=true" : "";
  let page = 1;
  let total = 0;
  // Hard cap so a misbehaving endpoint can't loop forever.
  for (let safety = 0; safety < 50; safety++) {
    const res = await authedFetch(`/api/admin/users?page=${page}&limit=${limit}${suffix}`);
    assert.equal(
      res.status,
      200,
      `/api/admin/users page=${page} limit=${limit} should return 200, got ${res.status}`,
    );
    const body = (await res.json()) as {
      data: Array<{ id: number }>;
      total: number;
      page: number;
      totalPages: number;
    };
    total = body.total;
    for (const u of body.data) ids.add(u.id);
    if (body.data.length === 0 || page >= body.totalPages) break;
    page++;
  }
  return { ids, total };
}

async function listKycQueueIds(
  kind: "identity" | "address",
  includeSmoke: boolean,
): Promise<Set<number>> {
  const suffix = includeSmoke ? "&includeSmokeTest=true" : "";
  const res = await authedFetch(`/api/admin/kyc/queue?kind=${kind}${suffix}`);
  assert.equal(
    res.status,
    200,
    `/api/admin/kyc/queue?kind=${kind} should return 200, got ${res.status}`,
  );
  const body = (await res.json()) as { users: Array<{ id: number }>; kind: string };
  return new Set(body.users.map((u) => u.id));
}

test("/admin/users hides the smoke-test account by default", async () => {
  const { ids } = await listAllAdminUserIds(false);
  assert.ok(
    ids.has(normalUserId),
    `seeded normal user ${normalUserId} must appear in default /admin/users (sanity check)`,
  );
  assert.ok(
    !ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must NOT appear in default /admin/users — the notSmokeTestUser() filter regressed`,
  );
});

test("/admin/users returns the smoke-test account with ?includeSmokeTest=true", async () => {
  const { ids } = await listAllAdminUserIds(true);
  assert.ok(
    ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must appear in /admin/users when admins explicitly opt in`,
  );
  assert.ok(
    ids.has(normalUserId),
    `normal user ${normalUserId} must still appear when ?includeSmokeTest=true`,
  );
});

test("/admin/kyc/queue?kind=identity hides the smoke-test account by default", async () => {
  const ids = await listKycQueueIds("identity", false);
  assert.ok(
    ids.has(normalUserId),
    `seeded normal user ${normalUserId} must appear in default identity KYC queue (sanity check)`,
  );
  assert.ok(
    !ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must NOT appear in default identity KYC queue`,
  );
});

test("/admin/kyc/queue?kind=identity returns the smoke-test account with ?includeSmokeTest=true", async () => {
  const ids = await listKycQueueIds("identity", true);
  assert.ok(
    ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must appear in identity KYC queue when admins opt in`,
  );
  assert.ok(
    ids.has(normalUserId),
    `normal user ${normalUserId} must still appear when ?includeSmokeTest=true`,
  );
});

test("/admin/kyc/queue?kind=address hides the smoke-test account by default", async () => {
  const ids = await listKycQueueIds("address", false);
  assert.ok(
    ids.has(normalUserId),
    `seeded normal user ${normalUserId} must appear in default address KYC queue (sanity check)`,
  );
  assert.ok(
    !ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must NOT appear in default address KYC queue`,
  );
});

test("/admin/kyc/queue?kind=address returns the smoke-test account with ?includeSmokeTest=true", async () => {
  const ids = await listKycQueueIds("address", true);
  assert.ok(
    ids.has(smokeUserId),
    `smoke-test user ${smokeUserId} must appear in address KYC queue when admins opt in`,
  );
  assert.ok(
    ids.has(normalUserId),
    `normal user ${normalUserId} must still appear when ?includeSmokeTest=true`,
  );
});

test("/admin/stats totalUsers matches the default (filtered) /admin/users.total", async () => {
  // The route filters its `total` by the same notSmokeTestUser() predicate as
  // /admin/stats — so the dashboard headline count and the user list footer
  // must agree to the row. Catches the regression where /admin/stats stops
  // applying the filter and the badge starts disagreeing with the visible
  // list (e.g. shows N+1 because the smoke account is silently included).
  const usersRes = await authedFetch(`/api/admin/users?page=1&limit=1`);
  assert.equal(usersRes.status, 200);
  const usersBody = (await usersRes.json()) as { total: number };

  const statsRes = await authedFetch(`/api/admin/stats`);
  assert.equal(statsRes.status, 200);
  const statsBody = (await statsRes.json()) as { totalUsers: number };

  assert.equal(
    statsBody.totalUsers,
    usersBody.total,
    `dashboard totalUsers (${statsBody.totalUsers}) must equal filtered /admin/users.total (${usersBody.total})`,
  );
});
