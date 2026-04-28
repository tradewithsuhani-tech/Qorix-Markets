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
  investmentsTable,
} = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { teardownHttpServer, teardownRedis } = await import("./cleanup");

// Mirror admin-smoke-test-filter-money.test.ts: forge a JWT against the same
// secret authMiddleware uses, dropping back to the dev default if
// SESSION_SECRET is unset in the test env.
const JWT_SECRET = process.env["SESSION_SECRET"] || "qorix-markets-secret";

const RUN_TAG = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ADMIN_EMAIL = `admin-${RUN_TAG}@smoke-intel-filter-test.local`;
const SMOKE_EMAIL = `smoke-${RUN_TAG}@smoke-intel-filter-test.local`;
const NORMAL_EMAIL = `normal-${RUN_TAG}@smoke-intel-filter-test.local`;

// Distinctive amounts so the compound (opt - def) delta math is unambiguous
// even on a busy shared dev DB. Investment amounts are deliberately huge
// (close to the numeric(18,8) ceiling) so the seeded normal + smoke rows
// are guaranteed to land in the LIMIT-5 topInvestors list — otherwise the
// "smoke is absent by default" assertion could pass for the wrong reason
// (just being pushed off the bottom by unrelated rows).
const SMOKE_DEPOSIT_AMOUNT = 7777.77;
const SMOKE_WITHDRAWAL_AMOUNT = 6666.66;
const SMOKE_PENDING_AMOUNT = 8888.88;
const SMOKE_FEE_AMOUNT = 33.44;
const NORMAL_INVESTMENT_AMOUNT = 9_999_999_998;
const SMOKE_INVESTMENT_AMOUNT = 9_999_999_999;
// Both seeded investments use the same risk level so the delta lands on a
// single bucket, letting us verify riskExposure[INVESTMENT_RISK_LEVEL] moves
// by exactly SMOKE_INVESTMENT_AMOUNT / 1 investor when the smoke row is
// removed under ?includeSmokeTest=true.
const INVESTMENT_RISK_LEVEL = "high";

let server: Server;
let baseUrl = "";
let adminId = 0;
let smokeUserId = 0;
let normalUserId = 0;
let adminToken = "";

// We deliberately seed monetary rows ONLY for the smoke user. The compound
// delta strategy (see ensureSnapshots below) measures the change in
// /admin/intelligence aggregates when the SMOKE rows are removed; it never
// references a normal user's monetary rows, so seeding them would only add
// concurrent-test noise (e.g. the sibling money-filter test's
// /admin/stats pendingWithdrawal assertion is fragile to other tests
// inserting/deleting normal pending withdrawals). The one normal row we DO
// need is an active investment, used for the topInvestors sanity check.
let smokeDepositId = 0;
let smokeWithdrawalId = 0;
let smokePendingId = 0;
let smokeFeeId = 0;
let normalInvestmentId = 0;
let smokeInvestmentId = 0;

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
      fullName: "Smoke Intel Filter Test Admin",
      isAdmin: true,
      adminRole: "admin",
      sponsorId: 0,
      referralCode: `ADM-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  adminId = admin!.id;

  // The smoke-test account: flagged with is_smoke_test=true. Everything we
  // seed for this user must be hidden from /admin/intelligence by default
  // and re-appear when the admin opts in via ?includeSmokeTest=true.
  const [smoke] = await db
    .insert(usersTable)
    .values({
      email: SMOKE_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Intel Filter Test Smoke",
      isSmokeTest: true,
      sponsorId: 0,
      referralCode: `SMK-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  smokeUserId = smoke!.id;

  // A normal user — only used to anchor the topInvestors sanity check (an
  // empty topInvestors response could otherwise be misread as the filter
  // working). No normal monetary rows: the compound delta math doesn't need
  // them and they would create cross-test interference.
  const [normal] = await db
    .insert(usersTable)
    .values({
      email: NORMAL_EMAIL,
      passwordHash: "x",
      fullName: "Smoke Intel Filter Test Normal",
      sponsorId: 0,
      referralCode: `NRM-${RUN_TAG}`.slice(0, 20),
    })
    .returning({ id: usersTable.id });
  normalUserId = normal!.id;

  // Smoke-only completed deposit — drives summary.totalDeposits and the
  // deposit side of flowSeries.
  const [smokeDep] = await db
    .insert(transactionsTable)
    .values({
      userId: smokeUserId,
      type: "deposit",
      amount: SMOKE_DEPOSIT_AMOUNT.toFixed(2),
      status: "completed",
      description: `seeded-smoke-deposit-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  smokeDepositId = smokeDep!.id;

  // Smoke-only completed withdrawal — drives summary.totalWithdrawals and
  // the withdrawal side of flowSeries.
  const [smokeWd] = await db
    .insert(transactionsTable)
    .values({
      userId: smokeUserId,
      type: "withdrawal",
      amount: SMOKE_WITHDRAWAL_AMOUNT.toFixed(2),
      status: "completed",
      description: `seeded-smoke-withdrawal-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  smokeWithdrawalId = smokeWd!.id;

  // Smoke-only pending withdrawal — drives summary.pendingPayouts (the
  // intelligence page's payout badge, separate from /admin/stats).
  const [smokePending] = await db
    .insert(transactionsTable)
    .values({
      userId: smokeUserId,
      type: "withdrawal",
      amount: SMOKE_PENDING_AMOUNT.toFixed(2),
      status: "pending",
      description: `seeded-smoke-pending-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  smokePendingId = smokePending!.id;

  // Smoke-only fee transaction — drives summary.netPlatformProfit (the
  // route sums fee transactions with the smoke filter applied; no status
  // filter, so any fee row counts).
  const [smokeFee] = await db
    .insert(transactionsTable)
    .values({
      userId: smokeUserId,
      type: "fee",
      amount: SMOKE_FEE_AMOUNT.toFixed(2),
      status: "completed",
      description: `seeded-smoke-fee-${RUN_TAG}`,
    })
    .returning({ id: transactionsTable.id });
  smokeFeeId = smokeFee!.id;

  // Active investments — drive riskExposure (sum + investor count) and
  // topInvestors (top 5 by amount). We seed a normal investment AND a smoke
  // investment so the topInvestors sanity check has something positive to
  // assert against. Amounts are intentionally huge (close to the
  // numeric(18,8) ceiling) so the seeds are guaranteed to surface in the
  // LIMIT-5 topInvestors list.
  const [normalInv] = await db
    .insert(investmentsTable)
    .values({
      userId: normalUserId,
      amount: NORMAL_INVESTMENT_AMOUNT.toFixed(2),
      riskLevel: INVESTMENT_RISK_LEVEL,
      isActive: true,
    })
    .returning({ id: investmentsTable.id });
  normalInvestmentId = normalInv!.id;

  const [smokeInv] = await db
    .insert(investmentsTable)
    .values({
      userId: smokeUserId,
      amount: SMOKE_INVESTMENT_AMOUNT.toFixed(2),
      riskLevel: INVESTMENT_RISK_LEVEL,
      isActive: true,
    })
    .returning({ id: investmentsTable.id });
  smokeInvestmentId = smokeInv!.id;

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
      // to a unique seeded ID so it can't touch unrelated rows. Smoke rows
      // are intentionally removed by ensureSnapshots() (snapshot-delete-
      // snapshot pattern) and have their IDs zeroed there to skip cleanup.
      if (normalInvestmentId)
        await db.delete(investmentsTable).where(eq(investmentsTable.id, normalInvestmentId));
      if (smokeInvestmentId)
        await db.delete(investmentsTable).where(eq(investmentsTable.id, smokeInvestmentId));
      if (smokeDepositId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeDepositId));
      if (smokeWithdrawalId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeWithdrawalId));
      if (smokePendingId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, smokePendingId));
      if (smokeFeeId)
        await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeFeeId));
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

interface IntelResponse {
  summary: {
    totalDeposits: number;
    totalWithdrawals: number;
    netPlatformProfit: number;
    riskExposure: Record<string, { amount: number; investors: number }>;
    pendingPayouts: { count: number; amount: number };
  };
  flowSeries: Array<{ date: string; deposits: number; withdrawals: number; net: number }>;
  topInvestors: Array<{ email: string; fullName: string; amount: number; riskLevel: string; totalProfit: number }>;
}

async function getIntel(includeSmoke: boolean): Promise<IntelResponse> {
  const suffix = includeSmoke ? "?includeSmokeTest=true" : "";
  const res = await fetch(`${baseUrl}/api/admin/intelligence${suffix}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(
    res.status,
    200,
    `/api/admin/intelligence should return 200, got ${res.status}`,
  );
  return (await res.json()) as IntelResponse;
}

// Sum a numeric series across the whole 30-day flowSeries window. We sum
// rather than peek at a single "today" bucket because postgres' DATE() runs
// in the server session's timezone while JS toISOString() is UTC; a single
// seeded row could land in different date keys on the two sides of the
// comparison if the session TZ isn't UTC. Summing is timezone-agnostic.
const sumFlowDeposits = (rows: IntelResponse["flowSeries"]) =>
  rows.reduce((acc, r) => acc + r.deposits, 0);
const sumFlowWithdrawals = (rows: IntelResponse["flowSeries"]) =>
  rows.reduce((acc, r) => acc + r.withdrawals, 0);

// All assertions below use the same delta-snapshot strategy as the
// /admin/stats pendingWithdrawal test in admin-smoke-test-filter-money.test.ts:
// snapshot the aggregates, mutate (delete our seeded smoke rows), re-snapshot,
// and assert on the delta. We snapshot in BOTH modes (default and
// ?includeSmokeTest=true) and compute a COMPOUND delta:
//
//   ourSmokeContribution = (opt_pre - opt_post) - (def_pre - def_post)
//
// What this proves
// ----------------
// If the smoke filter HELD: smoke rows contribute only to opt; deleting them
// drops opt by the seeded amount and leaves def unchanged. The compound
// delta therefore lands close to SMOKE_AMOUNT — possibly inflated by other
// concurrent tests' smoke rows being deleted by their own after() hooks
// during our snapshot window, since those also drop opt without affecting
// def. The compound delta is therefore in the band [SMOKE_AMOUNT,
// SMOKE_AMOUNT + concurrent_noise].
//
// If the smoke filter REGRESSED: smoke rows contribute to BOTH opt and def;
// deleting them drops both by the same amount. opt_delta and def_delta
// cancel out and the compound delta collapses to ~0.
//
// We assert the compound delta is at least half of SMOKE_AMOUNT — that
// cleanly distinguishes the two cases on a busy shared dev DB while still
// catching every regression the route is supposed to prevent. (Tighter
// equality would re-introduce the flake we already debugged with the
// concurrent admin-smoke-test-filter-money suite, whose after() can delete
// its own seeded smoke rows mid-window.)

// Compound delta must be at least this fraction of the seeded smoke amount
// to count as "filter held". Half of SMOKE gives ample margin against
// concurrent-smoke noise (other test files' smoke seeds are at most ~$200,
// far below half of even our smallest seeded smoke amount of $33.44).
const HELD_RATIO = 0.5;

interface IntelSnapshots {
  optPre: IntelResponse;
  defPre: IntelResponse;
  optPost: IntelResponse;
  defPost: IntelResponse;
}

let snapshots: IntelSnapshots | null = null;

// Capture the four snapshots (opt_pre, def_pre, mutate, opt_post, def_post)
// once and reuse them across every per-metric assertion. Doing this in a
// dedicated first test means subsequent tests don't have to re-seed or
// re-mutate, and they all read from the same point-in-time state. The four
// HTTP GETs are issued back-to-back to keep the window in which other
// concurrent tests might mutate state as small as possible.
async function ensureSnapshots(): Promise<IntelSnapshots> {
  if (snapshots) return snapshots;

  const optPre = await getIntel(true);
  const defPre = await getIntel(false);

  // Delete every smoke-user row we seeded. Zero out the IDs so the cleanup
  // hook in `after` doesn't try to delete them a second time.
  if (smokeDepositId) {
    await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeDepositId));
    smokeDepositId = 0;
  }
  if (smokeWithdrawalId) {
    await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeWithdrawalId));
    smokeWithdrawalId = 0;
  }
  if (smokePendingId) {
    await db.delete(transactionsTable).where(eq(transactionsTable.id, smokePendingId));
    smokePendingId = 0;
  }
  if (smokeFeeId) {
    await db.delete(transactionsTable).where(eq(transactionsTable.id, smokeFeeId));
    smokeFeeId = 0;
  }
  if (smokeInvestmentId) {
    await db.delete(investmentsTable).where(eq(investmentsTable.id, smokeInvestmentId));
    smokeInvestmentId = 0;
  }

  const optPost = await getIntel(true);
  const defPost = await getIntel(false);

  snapshots = { optPre, defPre, optPost, defPost };
  return snapshots;
}

test("/admin/intelligence topInvestors: smoke is hidden by default and revealed under opt-in", async () => {
  // topInvestors needs the PRE snapshots only — once we delete the smoke
  // investment, the smoke email naturally drops out of every list. Trigger
  // ensureSnapshots so the same opt_pre / def_pre are reused by the
  // delta-based tests below.
  const { optPre, defPre } = await ensureSnapshots();

  const defEmails = defPre.topInvestors.map((t) => t.email);
  const optEmails = optPre.topInvestors.map((t) => t.email);

  // The seeded normal investment is among the largest possible (close to
  // the numeric(18,8) ceiling), so on any sane dev DB it must surface in
  // the top-5 list. If this sanity check fails, raise the seeding amounts
  // — otherwise the negative assertion below could trivially pass for the
  // wrong reason (just being pushed off the bottom of the list).
  assert.ok(
    defEmails.includes(NORMAL_EMAIL),
    `seeded normal investor (${NORMAL_EMAIL}) must appear in default /admin/intelligence topInvestors ` +
      `(sanity check; got emails=${JSON.stringify(defEmails)})`,
  );
  assert.ok(
    !defEmails.includes(SMOKE_EMAIL),
    `smoke-test investor (${SMOKE_EMAIL}) must NOT appear in default /admin/intelligence topInvestors — ` +
      `the notSmokeTestUserRef(investmentsTable.userId) filter regressed and the smoke account is now ` +
      `surfacing in the "Top Investors" table.`,
  );

  assert.ok(
    optEmails.includes(SMOKE_EMAIL),
    `smoke-test investor (${SMOKE_EMAIL}) must appear in /admin/intelligence topInvestors when admins ` +
      `explicitly opt in (got emails=${JSON.stringify(optEmails)})`,
  );
  assert.ok(
    optEmails.includes(NORMAL_EMAIL),
    `normal investor (${NORMAL_EMAIL}) must still appear when ?includeSmokeTest=true ` +
      `(got emails=${JSON.stringify(optEmails)})`,
  );
});

// Lower-bound check: a working filter gives compound ≈ SMOKE_AMOUNT (or
// slightly higher with concurrent-smoke noise); a regressed filter gives
// compound ≈ 0. We require compound ≥ HELD_RATIO * SMOKE_AMOUNT to cleanly
// distinguish the two while tolerating shared-DB noise.
function assertFilterHeldAmount(
  metric: string,
  optDelta: number,
  defDelta: number,
  expectedSmoke: number,
): void {
  const ourSmoke = optDelta - defDelta;
  const threshold = expectedSmoke * HELD_RATIO;
  assert.ok(
    ourSmoke >= threshold,
    `${metric} compound delta (opt=${optDelta}, def=${defDelta}, opt-def=${ourSmoke}) must be at least ` +
      `${threshold} (half of seeded smoke amount $${expectedSmoke}). A value at or near zero means the ` +
      `smoke filter regressed and smoke contributions are now appearing in the default response.`,
  );
}

function assertFilterHeldCount(
  metric: string,
  optDelta: number,
  defDelta: number,
): void {
  const ourSmoke = optDelta - defDelta;
  assert.ok(
    ourSmoke >= 1,
    `${metric} compound delta (opt=${optDelta}, def=${defDelta}, opt-def=${ourSmoke}) must be at least 1 ` +
      `(the seeded smoke row). A value of zero means the smoke filter regressed and the smoke row is ` +
      `now appearing in the default response.`,
  );
}

test("/admin/intelligence summary.totalDeposits filters the smoke-test account", async () => {
  const { optPre, defPre, optPost, defPost } = await ensureSnapshots();
  assertFilterHeldAmount(
    "summary.totalDeposits",
    optPre.summary.totalDeposits - optPost.summary.totalDeposits,
    defPre.summary.totalDeposits - defPost.summary.totalDeposits,
    SMOKE_DEPOSIT_AMOUNT,
  );
});

test("/admin/intelligence summary.totalWithdrawals filters the smoke-test account", async () => {
  const { optPre, defPre, optPost, defPost } = await ensureSnapshots();
  assertFilterHeldAmount(
    "summary.totalWithdrawals",
    optPre.summary.totalWithdrawals - optPost.summary.totalWithdrawals,
    defPre.summary.totalWithdrawals - defPost.summary.totalWithdrawals,
    SMOKE_WITHDRAWAL_AMOUNT,
  );
});

test("/admin/intelligence summary.pendingPayouts filters the smoke-test account", async () => {
  const { optPre, defPre, optPost, defPost } = await ensureSnapshots();
  assertFilterHeldCount(
    "pendingPayouts.count",
    optPre.summary.pendingPayouts.count - optPost.summary.pendingPayouts.count,
    defPre.summary.pendingPayouts.count - defPost.summary.pendingPayouts.count,
  );
  assertFilterHeldAmount(
    "pendingPayouts.amount",
    optPre.summary.pendingPayouts.amount - optPost.summary.pendingPayouts.amount,
    defPre.summary.pendingPayouts.amount - defPost.summary.pendingPayouts.amount,
    SMOKE_PENDING_AMOUNT,
  );
});

test("/admin/intelligence summary.netPlatformProfit (fees) filters the smoke-test account", async () => {
  const { optPre, defPre, optPost, defPost } = await ensureSnapshots();
  assertFilterHeldAmount(
    "summary.netPlatformProfit",
    optPre.summary.netPlatformProfit - optPost.summary.netPlatformProfit,
    defPre.summary.netPlatformProfit - defPost.summary.netPlatformProfit,
    SMOKE_FEE_AMOUNT,
  );
});

test("/admin/intelligence riskExposure filters the smoke-test account", async () => {
  const { optPre, defPre, optPost, defPost } = await ensureSnapshots();

  const optBucketPre = optPre.summary.riskExposure[INVESTMENT_RISK_LEVEL];
  const defBucketPre = defPre.summary.riskExposure[INVESTMENT_RISK_LEVEL];
  const optBucketPost = optPost.summary.riskExposure[INVESTMENT_RISK_LEVEL];
  const defBucketPost = defPost.summary.riskExposure[INVESTMENT_RISK_LEVEL];
  assert.ok(optBucketPre && defBucketPre && optBucketPost && defBucketPost,
    `riskExposure must always contain a "${INVESTMENT_RISK_LEVEL}" bucket (route fills it with zeros)`);

  assertFilterHeldAmount(
    `riskExposure.${INVESTMENT_RISK_LEVEL}.amount`,
    optBucketPre.amount - optBucketPost.amount,
    defBucketPre.amount - defBucketPost.amount,
    SMOKE_INVESTMENT_AMOUNT,
  );
  assertFilterHeldCount(
    `riskExposure.${INVESTMENT_RISK_LEVEL}.investors`,
    optBucketPre.investors - optBucketPost.investors,
    defBucketPre.investors - defBucketPost.investors,
  );
});

test("/admin/intelligence flowSeries filters the smoke-test account", async () => {
  const { optPre, defPre, optPost, defPost } = await ensureSnapshots();
  assertFilterHeldAmount(
    "flowSeries deposits",
    sumFlowDeposits(optPre.flowSeries) - sumFlowDeposits(optPost.flowSeries),
    sumFlowDeposits(defPre.flowSeries) - sumFlowDeposits(defPost.flowSeries),
    SMOKE_DEPOSIT_AMOUNT,
  );
  assertFilterHeldAmount(
    "flowSeries withdrawals",
    sumFlowWithdrawals(optPre.flowSeries) - sumFlowWithdrawals(optPost.flowSeries),
    sumFlowWithdrawals(defPre.flowSeries) - sumFlowWithdrawals(defPost.flowSeries),
    SMOKE_WITHDRAWAL_AMOUNT,
  );
});
