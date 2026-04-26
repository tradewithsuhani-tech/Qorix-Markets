import { test, after } from "node:test";
import assert from "node:assert/strict";
import { sql, inArray } from "drizzle-orm";
import {
  db,
  pool,
  glAccountsTable,
  ledgerEntriesTable,
  walletsTable,
} from "@workspace/db";
import {
  ensureUserAccounts,
  postJournalEntry,
  runReconciliation,
} from "../ledger-service";

// Use a unique prefix per test run so concurrent runs and pre-existing data
// can't collide with our seeded rows.
const RUN_TAG = `${process.pid}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ACCT_ASSET = `test:recon:${RUN_TAG}:asset`;
const ACCT_LIAB = `test:recon:${RUN_TAG}:liab`;
const J1 = `test:recon:${RUN_TAG}:j1`;
const J2 = `test:recon:${RUN_TAG}:j2`;
const J3 = `test:recon:${RUN_TAG}:j3`;
const ALL_OUR_JOURNALS = [J1, J2, J3];
const ALL_OUR_ACCOUNTS = [ACCT_ASSET, ACCT_LIAB];

const BAD_J = `test:recon:${RUN_TAG}:bad`;

// Synthetic user IDs picked from a high range so they cannot collide with real
// users in the test DB. wallets.user_id is a non-FK integer with a UNIQUE
// constraint, so we just need values that are not already present.
function pickTestUserId(): number {
  return 1_500_000_000 + Math.floor(Math.random() * 600_000_000);
}
const DRIFT_USER_ID = pickTestUserId();
const MATCH_USER_ID = pickTestUserId();
const DRIFT_J = `test:recon:${RUN_TAG}:wallet-drift`;
const MATCH_J = `test:recon:${RUN_TAG}:wallet-match`;
const ALL_WALLET_TEST_USER_IDS = [DRIFT_USER_ID, MATCH_USER_ID];
const ALL_WALLET_TEST_JOURNALS = [DRIFT_J, MATCH_J];

async function ensureTestAccounts() {
  await db
    .insert(glAccountsTable)
    .values([
      {
        code: ACCT_ASSET,
        name: "Test Asset (recon)",
        accountType: "asset",
        normalBalance: "debit",
        isSystem: false,
      },
      {
        code: ACCT_LIAB,
        name: "Test Liability (recon)",
        accountType: "liability",
        normalBalance: "credit",
        isSystem: false,
      },
    ])
    .onConflictDoNothing();
}

async function cleanup() {
  await db
    .delete(ledgerEntriesTable)
    .where(
      inArray(ledgerEntriesTable.journalId, [
        ...ALL_OUR_JOURNALS,
        BAD_J,
        ...ALL_WALLET_TEST_JOURNALS,
      ]),
    );
  await db
    .delete(glAccountsTable)
    .where(inArray(glAccountsTable.code, ALL_OUR_ACCOUNTS));
  // Per-user GL accounts created by ensureUserAccounts() for the wallet drift tests.
  await db
    .delete(glAccountsTable)
    .where(inArray(glAccountsTable.userId, ALL_WALLET_TEST_USER_IDS));
  await db
    .delete(walletsTable)
    .where(inArray(walletsTable.userId, ALL_WALLET_TEST_USER_IDS));
}

after(async () => {
  // Always clean up, then close the pg pool so node:test can exit.
  try {
    await cleanup();
  } finally {
    await pool.end();
  }
});

test("runReconciliation summary matches actual ledger state", async () => {
  // Make sure we start clean in case a previous failing run left rows behind
  // for this exact RUN_TAG (extremely unlikely, but defensive).
  await cleanup();

  // Seed two test accounts: one debit-normal asset, one credit-normal liability.
  await ensureTestAccounts();

  // Three balanced journals: 2-line, 2-line, and 3-line.
  // Total debits posted by our test = 100 + 50 + (30 + 20) = 200
  // Total credits posted by our test = 100 + 50 + 50          = 200
  // Total ledger rows added by our test                       = 2 + 2 + 3 = 7
  await postJournalEntry(J1, [
    { accountCode: ACCT_ASSET, entryType: "debit", amount: 100 },
    { accountCode: ACCT_LIAB, entryType: "credit", amount: 100 },
  ]);
  await postJournalEntry(J2, [
    { accountCode: ACCT_ASSET, entryType: "debit", amount: 50 },
    { accountCode: ACCT_LIAB, entryType: "credit", amount: 50 },
  ]);
  await postJournalEntry(J3, [
    { accountCode: ACCT_ASSET, entryType: "debit", amount: 30 },
    { accountCode: ACCT_ASSET, entryType: "debit", amount: 20 },
    { accountCode: ACCT_LIAB, entryType: "credit", amount: 50 },
  ]);

  const report = await runReconciliation();

  // ---- 1. totalEntries must equal SELECT COUNT(*) FROM ledger_entries ----
  const rowCountResult = await db.execute<{ cnt: string }>(
    sql`SELECT COUNT(*)::text AS cnt FROM ${ledgerEntriesTable}`,
  );
  const actualRowCount = Number(rowCountResult.rows[0]!.cnt);
  assert.equal(
    report.summary.totalEntries,
    actualRowCount,
    `summary.totalEntries (${report.summary.totalEntries}) should equal actual ledger row count (${actualRowCount})`,
  );

  // ---- 2. totalJournals must equal COUNT(DISTINCT journal_id) ----
  const journalCountResult = await db.execute<{ cnt: string }>(
    sql`SELECT COUNT(DISTINCT journal_id)::text AS cnt FROM ${ledgerEntriesTable}`,
  );
  const actualJournalCount = Number(journalCountResult.rows[0]!.cnt);
  assert.equal(
    report.summary.totalJournals,
    actualJournalCount,
    `summary.totalJournals (${report.summary.totalJournals}) should equal distinct journal_id count (${actualJournalCount})`,
  );

  // ---- 3. globalDebits / globalCredits must equal DB sums ----
  const sumRows = await db
    .select({
      entryType: ledgerEntriesTable.entryType,
      total: sql<string>`sum(${ledgerEntriesTable.amount})`,
    })
    .from(ledgerEntriesTable)
    .groupBy(ledgerEntriesTable.entryType);

  let dbDebits = 0;
  let dbCredits = 0;
  for (const r of sumRows) {
    const v = parseFloat(r.total ?? "0");
    if (r.entryType === "debit") dbDebits = v;
    else if (r.entryType === "credit") dbCredits = v;
  }

  assert.ok(
    Math.abs(report.summary.globalDebits - dbDebits) < 0.0000001,
    `globalDebits (${report.summary.globalDebits}) should equal DB sum (${dbDebits})`,
  );
  assert.ok(
    Math.abs(report.summary.globalCredits - dbCredits) < 0.0000001,
    `globalCredits (${report.summary.globalCredits}) should equal DB sum (${dbCredits})`,
  );

  // ---- 4. globalBalanced must reflect the same threshold the report uses ----
  const expectedGlobalBalanced = Math.abs(dbDebits - dbCredits) < 0.01;
  assert.equal(
    report.summary.globalBalanced,
    expectedGlobalBalanced,
    "globalBalanced should match |debits - credits| < 0.01",
  );

  // ---- 5. None of our balanced journals must show up as unbalanced ----
  const ourUnbalanced = report.unbalancedJournals.filter((u) =>
    ALL_OUR_JOURNALS.includes(u.journalId),
  );
  assert.equal(
    ourUnbalanced.length,
    0,
    `our balanced journals should not be flagged as unbalanced: ${JSON.stringify(ourUnbalanced)}`,
  );

  // ---- 6. Sanity check on our own contribution to the totals ----
  // We added exactly 7 rows across 3 journals. The reconciliation should be
  // consistent with this delta even though pre-existing data may also exist.
  // (We can't assert the absolute totals because the DB may already contain
  // other ledger rows, but we already covered that above by comparing the
  // report against the live SELECT COUNT(*).)
  const ourRowsResult = await db.execute<{ cnt: string }>(
    sql`SELECT COUNT(*)::text AS cnt FROM ${ledgerEntriesTable}
        WHERE journal_id IN (${J1}, ${J2}, ${J3})`,
  );
  assert.equal(
    Number(ourRowsResult.rows[0]!.cnt),
    7,
    "should have inserted exactly 7 ledger rows for our 3 test journals",
  );
});

test("runReconciliation flags an unbalanced journal", async () => {
  // Self-contained: seed our test accounts independently so this test does
  // not depend on the previous test having run (or any test ordering).
  await ensureTestAccounts();

  // Insert raw entries that intentionally don't balance (100 debit vs 60 credit).
  // We bypass postJournalEntry's balance guard by writing rows directly.
  const acctRows = await db
    .select({ id: glAccountsTable.id, code: glAccountsTable.code })
    .from(glAccountsTable)
    .where(inArray(glAccountsTable.code, ALL_OUR_ACCOUNTS));
  assert.equal(acctRows.length, 2, "both test accounts should be present after ensureTestAccounts()");
  const assetId = acctRows.find((r) => r.code === ACCT_ASSET)!.id;
  const liabId = acctRows.find((r) => r.code === ACCT_LIAB)!.id;

  try {
    await db.insert(ledgerEntriesTable).values([
      {
        journalId: BAD_J,
        accountId: assetId,
        accountCode: ACCT_ASSET,
        entryType: "debit",
        amount: "100.00000000",
      },
      {
        journalId: BAD_J,
        accountId: liabId,
        accountCode: ACCT_LIAB,
        entryType: "credit",
        amount: "60.00000000",
      },
    ]);

    const report = await runReconciliation();
    const flagged = report.unbalancedJournals.find((u) => u.journalId === BAD_J);
    assert.ok(flagged, `unbalanced journal ${BAD_J} should be flagged`);
    assert.ok(
      Math.abs(flagged.debits - 100) < 0.0000001,
      `flagged debits should be 100, got ${flagged.debits}`,
    );
    assert.ok(
      Math.abs(flagged.credits - 60) < 0.0000001,
      `flagged credits should be 60, got ${flagged.credits}`,
    );
    assert.ok(flagged.diff >= 39.99 && flagged.diff <= 40.01, `flagged diff should be ~40, got ${flagged.diff}`);
  } finally {
    await db
      .delete(ledgerEntriesTable)
      .where(inArray(ledgerEntriesTable.journalId, [BAD_J]));
  }
});

test("runReconciliation flags wallet vs ledger drift for a user", async () => {
  // Make sure the offset asset account exists (test 1 may have been skipped or
  // its rows cleaned up by a parallel run).
  await ensureTestAccounts();

  // Create the user's per-wallet GL accounts (main/trading/profit/locked).
  await ensureUserAccounts(DRIFT_USER_ID);

  // Seed the wallet row claiming the user has $100 in main. trading and profit
  // default to 0, which will agree with the ledger (0 entries posted there) and
  // therefore must NOT be reported.
  await db
    .insert(walletsTable)
    .values({
      userId: DRIFT_USER_ID,
      mainBalance: "100.00000000",
      tradingBalance: "0",
      profitBalance: "0",
    })
    .onConflictDoNothing();

  // Post a balanced journal that credits only $80 to user:DRIFT:main, leaving
  // the ledger $20 short of what the wallet row claims.
  await postJournalEntry(DRIFT_J, [
    { accountCode: ACCT_ASSET, entryType: "debit", amount: 80 },
    { accountCode: `user:${DRIFT_USER_ID}:main`, entryType: "credit", amount: 80 },
  ]);

  const report = await runReconciliation();

  const ours = report.walletDiscrepancies.filter(
    (d) => d.userId === DRIFT_USER_ID,
  );
  assert.equal(
    ours.length,
    1,
    `expected exactly one wallet discrepancy for user ${DRIFT_USER_ID}, got ${JSON.stringify(ours)}`,
  );
  const drift = ours[0]!;
  assert.equal(drift.wallet, "main", `discrepancy should be on the main wallet, got ${drift.wallet}`);
  assert.ok(
    Math.abs(drift.walletBalance - 100) < 0.0000001,
    `walletBalance should be 100, got ${drift.walletBalance}`,
  );
  assert.ok(
    Math.abs(drift.ledgerBalance - 80) < 0.0000001,
    `ledgerBalance should be 80, got ${drift.ledgerBalance}`,
  );
  assert.ok(
    Math.abs(drift.diff - 20) < 0.0000001,
    `diff should be 20, got ${drift.diff}`,
  );

  // overall report cannot pass while at least one wallet discrepancy exists.
  assert.equal(
    report.passed,
    false,
    "reconciliation should not be marked passed when wallet drift is present",
  );
});

test("runReconciliation does not flag a user when wallet matches ledger exactly", async () => {
  await ensureTestAccounts();
  await ensureUserAccounts(MATCH_USER_ID);

  await db
    .insert(walletsTable)
    .values({
      userId: MATCH_USER_ID,
      mainBalance: "50.00000000",
      tradingBalance: "0",
      profitBalance: "0",
    })
    .onConflictDoNothing();

  // Post a balanced journal that credits exactly $50 to user:MATCH:main so
  // wallet and ledger agree.
  await postJournalEntry(MATCH_J, [
    { accountCode: ACCT_ASSET, entryType: "debit", amount: 50 },
    { accountCode: `user:${MATCH_USER_ID}:main`, entryType: "credit", amount: 50 },
  ]);

  const report = await runReconciliation();

  const ours = report.walletDiscrepancies.filter(
    (d) => d.userId === MATCH_USER_ID,
  );
  assert.equal(
    ours.length,
    0,
    `user ${MATCH_USER_ID} should NOT appear in walletDiscrepancies, got ${JSON.stringify(ours)}`,
  );
});
