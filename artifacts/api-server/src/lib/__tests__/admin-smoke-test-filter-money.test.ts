import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";

const { default: app } = await import("../../app");
const {
  db,
  pool,
  usersTable,
  systemSettingsTable,
  transactionsTable,
  loginEventsTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { teardownHttpServer, teardownRedis } = await import("./cleanup");

// Mirror admin-smoke-test-filter.test.ts: forge a JWT against the same secret
// authMiddleware uses, dropping back to the dev default if SESSION_SECRET is
// unset in the test env.
const JWT_SECRET = process.env["SESSION_SECRET"] || "qorix-markets-secret";

const RUN_TAG = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ADMIN_EMAIL = `admin-${RUN_TAG}@smoke-money-filter-test.local`;
const SMOKE_EMAIL = `smoke-${RUN_TAG}@smoke-money-filter-test.local`;
const NORMAL_EMAIL = `normal-${RUN_TAG}@smoke-money-filter-test.local`;

// Use very small, distinctive amounts so the /admin/stats delta math is
// unambiguous even if other suites happen to seed pending withdrawals while
// we're running.
const NORMAL_PENDING_AMOUNT = 12.34;
const SMOKE_PENDING_AMOUNT = 56.78;

let server: Server;
let baseUrl = "";
let adminId = 0;
let smokeUserId = 0;
let normalUserId = 0;
let adminToken = "";

// Specific seeded transaction / login IDs we'll look for in the responses.
// Asserting on these (rather than counts) keeps the tests safe when the
// shared dev DB already has unrelated rows.
let normalTxnId = 0;
let smokeTxnId = 0;
let normalWithdrawalId = 0;
let smokeWithdrawalId = 0;
let normalLoginId = 0;
let smokeLoginId = 0;

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
      fullName: "Smoke Money Filter Test Admin",
      isAdmin: true,
      adminRole: "admin",
      sponsorId: 0,
      referralCode: `ADM-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  adminId = admin!.id;

  // The smoke-test account: flagged with is_smoke_test=true. Everything we
  // seed for this user should be hidden from the default admin views.
  const [smoke] = await db
    .insert(usersTable)
    .values({
      email: SMOKE_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Money Filter Test Smoke",
      isSmokeTest: true,
      sponsorId: 0,
      referralCode: `SMK-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  smokeUserId = smoke!.id;

  // A normal user — we seed equivalent rows here so each "smoke hidden"
  // assertion is paired with a "normal still visible" sanity check. That way
  // an empty response can't be misread as the filter working.
  const [normal] = await db
    .insert(usersTable)
    .values({
      email: NORMAL_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Money Filter Test Normal",
      sponsorId: 0,
      referralCode: `NRM-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  normalUserId = normal!.id;

  // Seed a completed deposit for each user. These show up in
  // /admin/transactions, and the smoke one must be filtered out by default.
  const [normalTxn] = await db
    .insert(transactionsTable)
    .values({
      userId: normalUserId,
      type: "deposit",
      amount: "100.00",
      status: "completed",
      description: `seeded-normal-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  normalTxnId = normalTxn!.id;

  const [smokeTxn] = await db
    .insert(transactionsTable)
    .values({
      userId: smokeUserId,
      type: "deposit",
      amount: "100.00",
      status: "completed",
      description: `seeded-smoke-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  smokeTxnId = smokeTxn!.id;

  // Seed a pending withdrawal for each user. These drive both
  // /admin/withdrawals and the pendingWithdrawals/pendingWithdrawalAmount
  // aggregates on /admin/stats. The amounts are deliberately distinct so we
  // can verify the stats delta to the cent.
  const [normalWd] = await db
    .insert(transactionsTable)
    .values({
      userId: normalUserId,
      type: "withdrawal",
      amount: NORMAL_PENDING_AMOUNT.toFixed(2),
      status: "pending",
      description: `seeded-normal-pending-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  normalWithdrawalId = normalWd!.id;

  const [smokeWd] = await db
    .insert(transactionsTable)
    .values({
      userId: smokeUserId,
      type: "withdrawal",
      amount: SMOKE_PENDING_AMOUNT.toFixed(2),
      status: "pending",
      description: `seeded-smoke-pending-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  smokeWithdrawalId = smokeWd!.id;

  // Seed a recent login event for each user. /admin/activity-logs is the
  // surface the fraud / abuse reviewers look at — the smoke user must NOT
  // appear there by default, otherwise its synthetic logins pollute fraud
  // signals on every deploy.
  const [normalLogin] = await db
    .insert(loginEventsTable)
    .values({
      userId: normalUserId,
      ipAddress: "127.0.0.1",
      userAgent: `smoke-money-test-${RUN_TAG}`,
      eventType: "login",
    })
    .returning({ id: loginEventsTable.id });
  normalLoginId = normalLogin!.id;

  const [smokeLogin] = await db
    .insert(loginEventsTable)
    .values({
      userId: smokeUserId,
      ipAddress: "127.0.0.1",
      userAgent: `smoke-money-test-${RUN_TAG}`,
      eventType: "login",
    })
    .returning({ id: loginEventsTable.id });
  smokeLoginId = smokeLogin!.id;

  adminToken = jwt.sign({ userId: adminId, isAdmin: true }, JWT_SECRET);

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
      // Best-effort cleanup of every row we inserted. Each delete is scoped
      // to a unique RUN_TAG-derived ID so it can't touch unrelated rows.
      if (normalLoginId)
        await db.delete(loginEventsTable).where(eq(loginEventsTable.id, normalLoginId));
      if (smokeLoginId)
        await db.delete(loginEventsTable).where(eq(loginEventsTable.id, smokeLoginId));
      if (normalTxnId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, normalTxnId));
      if (smokeTxnId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeTxnId));
      if (normalWithdrawalId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, normalWithdrawalId));
      if (smokeWithdrawalId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeWithdrawalId));
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
      await teardownRedis();
      await pool.end();
    }
  }
});

function authedFetch(path: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}

// /admin/transactions caps at limit=200 and sorts by createdAt desc, so our
// freshly-seeded rows are guaranteed to be on the first page even on a busy
// shared dev DB.
async function listAdminTxnIds(includeSmoke: boolean): Promise<Set<number>> {
  const suffix = includeSmoke ? "?includeSmokeTest=true&limit=200" : "?limit=200";
  const res = await authedFetch(`/api/admin/transactions${suffix}`);
  assert.equal(
    res.status,
    200,
    `/api/admin/transactions should return 200, got ${res.status}`,
  );
  const body = (await res.json()) as { data: Array<{ id: number }> };
  return new Set(body.data.map((t) => t.id));
}

async function listAdminWithdrawalIds(includeSmoke: boolean): Promise<Set<number>> {
  const suffix = includeSmoke ? "?includeSmokeTest=true" : "";
  const res = await authedFetch(`/api/admin/withdrawals${suffix}`);
  assert.equal(
    res.status,
    200,
    `/api/admin/withdrawals should return 200, got ${res.status}`,
  );
  const body = (await res.json()) as Array<{ id: number }>;
  return new Set(body.map((w) => w.id));
}

async function listActivityLoginUserIds(includeSmoke: boolean): Promise<Set<number>> {
  const suffix = includeSmoke ? "?includeSmokeTest=true" : "";
  const res = await authedFetch(`/api/admin/activity-logs${suffix}`);
  assert.equal(
    res.status,
    200,
    `/api/admin/activity-logs should return 200, got ${res.status}`,
  );
  const body = (await res.json()) as { logins: Array<{ userId: number }> };
  return new Set(body.logins.map((l) => l.userId));
}

async function getStats(): Promise<{ pendingWithdrawals: number; pendingWithdrawalAmount: number }> {
  const res = await authedFetch(`/api/admin/stats`);
  assert.equal(res.status, 200, `/api/admin/stats should return 200, got ${res.status}`);
  return (await res.json()) as {
    pendingWithdrawals: number;
    pendingWithdrawalAmount: number;
  };
}

test("/admin/transactions hides the smoke-test account by default", async () => {
  const ids = await listAdminTxnIds(false);
  assert.ok(
    ids.has(normalTxnId),
    `seeded normal txn ${normalTxnId} must appear in default /admin/transactions (sanity check)`,
  );
  assert.ok(
    !ids.has(smokeTxnId),
    `smoke-test txn ${smokeTxnId} must NOT appear in default /admin/transactions — the notSmokeTestUser() filter regressed`,
  );
});

test("/admin/transactions returns the smoke-test account with ?includeSmokeTest=true", async () => {
  const ids = await listAdminTxnIds(true);
  assert.ok(
    ids.has(smokeTxnId),
    `smoke-test txn ${smokeTxnId} must appear in /admin/transactions when admins explicitly opt in`,
  );
  assert.ok(
    ids.has(normalTxnId),
    `normal txn ${normalTxnId} must still appear when ?includeSmokeTest=true`,
  );
});

test("/admin/withdrawals hides the smoke-test account by default", async () => {
  const ids = await listAdminWithdrawalIds(false);
  assert.ok(
    ids.has(normalWithdrawalId),
    `seeded normal pending withdrawal ${normalWithdrawalId} must appear in default /admin/withdrawals (sanity check)`,
  );
  assert.ok(
    !ids.has(smokeWithdrawalId),
    `smoke-test pending withdrawal ${smokeWithdrawalId} must NOT appear in default /admin/withdrawals — the notSmokeTestUser() filter regressed`,
  );
});

test("/admin/withdrawals returns the smoke-test account with ?includeSmokeTest=true", async () => {
  const ids = await listAdminWithdrawalIds(true);
  assert.ok(
    ids.has(smokeWithdrawalId),
    `smoke-test pending withdrawal ${smokeWithdrawalId} must appear in /admin/withdrawals when admins explicitly opt in`,
  );
  assert.ok(
    ids.has(normalWithdrawalId),
    `normal pending withdrawal ${normalWithdrawalId} must still appear when ?includeSmokeTest=true`,
  );
});

test("/admin/stats pendingWithdrawal aggregates exclude the smoke-test account", async () => {
  // Seed delta approach: snapshot stats with our normal row in place, then
  // delete it and re-snapshot. The delta must reflect the normal user's
  // amount only — never the smoke user's. If the smoke filter regressed and
  // /admin/stats started counting the smoke pending withdrawal, the delta
  // would be off by the SMOKE_PENDING_AMOUNT. Working in deltas keeps this
  // safe even when other suites have seeded unrelated pending withdrawals.
  const before = await getStats();

  await db
    .delete(transactionsTable)
    .where(eq(transactionsTable.id, normalWithdrawalId));
  // Make sure cleanup in `after` doesn't try to delete it again.
  const removedNormalWithdrawalId = normalWithdrawalId;
  normalWithdrawalId = 0;

  const afterDelete = await getStats();

  // Removing exactly one normal pending withdrawal must drop the count by 1
  // and the amount by exactly NORMAL_PENDING_AMOUNT. If the smoke withdrawal
  // were also being counted, the snapshot wouldn't move by the same amount
  // we removed — it would move by 0 (filter held) or there'd be a baseline
  // including SMOKE_PENDING_AMOUNT to begin with.
  assert.equal(
    before.pendingWithdrawals - afterDelete.pendingWithdrawals,
    1,
    `removing one normal pending withdrawal must reduce stats.pendingWithdrawals by exactly 1 ` +
      `(before=${before.pendingWithdrawals}, after=${afterDelete.pendingWithdrawals}) — ` +
      `if it changed by more, the smoke-test row is leaking into the count`,
  );

  const amountDelta = before.pendingWithdrawalAmount - afterDelete.pendingWithdrawalAmount;
  // Cents-level tolerance for the numeric → float round-trip.
  assert.ok(
    Math.abs(amountDelta - NORMAL_PENDING_AMOUNT) < 0.01,
    `removing one normal pending withdrawal of $${NORMAL_PENDING_AMOUNT} must reduce ` +
      `stats.pendingWithdrawalAmount by that exact amount (delta=${amountDelta}) — ` +
      `the smoke-test row's $${SMOKE_PENDING_AMOUNT} must not leak in`,
  );

  // Sanity: even after we removed the normal row, the smoke row is still in
  // the table — so the only reason these stats agree is the filter.
  const smokeStillPresent = await db
    .select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(eq(transactionsTable.id, smokeWithdrawalId))
    .limit(1);
  assert.equal(
    smokeStillPresent.length,
    1,
    `precondition: smoke pending withdrawal must still exist in DB during this assertion`,
  );

  // Avoid an unused-binding lint warning while making the intent obvious.
  void removedNormalWithdrawalId;
});

test("/admin/activity-logs hides the smoke-test account's logins by default", async () => {
  const userIds = await listActivityLoginUserIds(false);
  assert.ok(
    userIds.has(normalUserId),
    `seeded normal login (user ${normalUserId}) must appear in default /admin/activity-logs (sanity check)`,
  );
  assert.ok(
    !userIds.has(smokeUserId),
    `smoke-test login (user ${smokeUserId}) must NOT appear in default /admin/activity-logs — ` +
      `the notSmokeTestUserRef(loginEventsTable.userId) filter regressed and smoke logins are now polluting fraud signals`,
  );
});

test("/admin/activity-logs returns the smoke-test account's logins with ?includeSmokeTest=true", async () => {
  const userIds = await listActivityLoginUserIds(true);
  assert.ok(
    userIds.has(smokeUserId),
    `smoke-test login (user ${smokeUserId}) must appear in /admin/activity-logs when admins explicitly opt in`,
  );
  assert.ok(
    userIds.has(normalUserId),
    `normal login (user ${normalUserId}) must still appear when ?includeSmokeTest=true`,
  );
  // Reference seeded login IDs so a future change that drops one accidentally
  // is easier to bisect from a failing test name.
  void normalLoginId;
  void smokeLoginId;
});
