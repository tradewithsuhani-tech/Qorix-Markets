/**
 * scripts/reconcile-orphan-inr-withdrawals.ts
 *
 * Backfills `transactions` rows + ledger journal entries for any INR
 * withdrawal that was approved before B21 — i.e., approved by the
 * pre-fix code path which only flipped the inr_withdrawals.status to
 * "approved" but never inserted a transactions row and never posted a
 * journal entry.
 *
 * For each orphan approved withdrawal, the script posts a *direct
 * settlement* journal:
 *
 *   debit  user:UID:main           amountUsdt
 *   credit platform:usdt_pool      amountUsdt
 *
 * This bypasses the platform:pending_withdrawals lock stage because the
 * pre-fix submit handler never posted the lock journal — there's nothing
 * to release. The wallet was already debited at submit time, so the
 * direct settlement aligns the ledger main balance with the wallet main
 * balance going forward.
 *
 * IDEMPOTENCY:
 *   - skips any inr_withdrawal that already has a transactions row
 *     whose description starts with `[INR-WD:${id}]`
 *   - skips any inr_withdrawal that already has ledger entries with
 *     journal_id `inr_wd:${id}:approve`
 *
 * SAFETY:
 *   - dry-run by default: prints exactly what it would do without
 *     touching the database
 *   - pass `--apply` to commit
 *   - everything is wrapped in a single transaction; either all
 *     orphans get reconciled or none do
 *
 * USAGE:
 *   # 1. dry-run (default — no DB writes)
 *   NEON_DATABASE_URL="$NEON_DATABASE_URL" \
 *     pnpm --filter @workspace/api-server exec tsx \
 *     ../../scripts/reconcile-orphan-inr-withdrawals.ts
 *
 *   # 2. once you've reviewed the dry-run output, apply
 *   NEON_DATABASE_URL="$NEON_DATABASE_URL" \
 *     pnpm --filter @workspace/api-server exec tsx \
 *     ../../scripts/reconcile-orphan-inr-withdrawals.ts --apply
 */

import pg from "pg";

const DRY_RUN = !process.argv.includes("--apply");

interface OrphanWithdrawal {
  id: number;
  user_id: number;
  amount_inr: string;
  amount_usdt: string;
  payout_method: string;
  reviewed_at: string | null;
  payout_reference: string | null;
  username: string;
}

(async () => {
  if (!process.env.NEON_DATABASE_URL) {
    console.error("ERROR: NEON_DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: process.env.NEON_DATABASE_URL });
  await client.connect();

  console.log("==========================================================");
  console.log(`  reconcile-orphan-inr-withdrawals  (${DRY_RUN ? "DRY-RUN" : "APPLY"})`);
  console.log("==========================================================\n");

  // 1. Find all approved INR withdrawals that have NO matching transactions
  //    row and NO matching ledger journal — true orphans.
  const orphansRes = await client.query<OrphanWithdrawal>(
    `
    SELECT
      w.id,
      w.user_id,
      w.amount_inr::text,
      w.amount_usdt::text,
      w.payout_method,
      w.reviewed_at::text,
      w.payout_reference,
      u.email AS username
    FROM inr_withdrawals w
    JOIN users u ON u.id = w.user_id
    WHERE w.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.user_id = w.user_id
          AND t.type = 'withdrawal'
          AND t.description LIKE '[INR-WD:' || w.id || ']%'
      )
      AND NOT EXISTS (
        SELECT 1 FROM ledger_entries le
        WHERE le.journal_id = 'inr_wd:' || w.id || ':approve'
      )
    ORDER BY w.user_id, w.id
    `,
  );

  if (orphansRes.rows.length === 0) {
    console.log("✅ No orphan INR withdrawals found. Nothing to reconcile.");
    await client.end();
    return;
  }

  console.log(`Found ${orphansRes.rows.length} orphan approved INR withdrawal(s):\n`);
  const byUser = new Map<number, OrphanWithdrawal[]>();
  for (const w of orphansRes.rows) {
    if (!byUser.has(w.user_id)) byUser.set(w.user_id, []);
    byUser.get(w.user_id)!.push(w);
    console.log(
      `  • WD#${w.id}  user=${w.user_id} (${w.username})  ` +
        `₹${parseFloat(w.amount_inr).toFixed(2)}  $${parseFloat(w.amount_usdt).toFixed(6)}  ` +
        `via ${w.payout_method}  approved ${w.reviewed_at}`,
    );
  }
  console.log("");

  // 2. Pre-flight: verify required GL accounts exist for every affected user
  //    and the platform side. Resolve account ids in batch so we don't issue
  //    one SELECT per row.
  const usdtPoolRes = await client.query(
    `SELECT id, normal_balance FROM gl_accounts WHERE code = 'platform:usdt_pool'`,
  );
  if (usdtPoolRes.rows.length === 0) {
    console.error("ERROR: platform:usdt_pool account is missing. Aborting.");
    await client.end();
    process.exit(1);
  }
  const usdtPoolId: number = usdtPoolRes.rows[0].id;

  const affectedUserIds = Array.from(byUser.keys());
  const userMainAccountsRes = await client.query<{ user_id: number; id: number; code: string }>(
    `
    SELECT user_id, id, code
    FROM gl_accounts
    WHERE user_id = ANY($1::int[]) AND code LIKE 'user:%:main'
    `,
    [affectedUserIds],
  );
  const userMainAcctIdByUid = new Map<number, number>();
  for (const r of userMainAccountsRes.rows) userMainAcctIdByUid.set(r.user_id, r.id);

  const usersMissingMain = affectedUserIds.filter((uid) => !userMainAcctIdByUid.has(uid));
  if (usersMissingMain.length > 0) {
    console.error(
      `ERROR: missing user:UID:main GL account for users: ${usersMissingMain.join(", ")}.`,
    );
    console.error("       Run a deposit/withdrawal first via the new B21 path so");
    console.error("       ensureUserAccounts() lazily creates the missing accounts,");
    console.error("       or seed them manually before re-running this script.");
    await client.end();
    process.exit(1);
  }

  // 3. Compute the projected ledger balance change per user and verify it
  //    will exactly close the wallet/ledger drift (sanity check).
  const projectionRows: {
    user_id: number;
    username: string;
    wallet_main: number;
    ledger_main: number;
    drift: number;
    backfill_total: number;
    after_ledger_main: number;
    will_match: boolean;
  }[] = [];

  for (const [uid, withdrawals] of byUser.entries()) {
    const balRes = await client.query<{
      wallet_main: string;
      ledger_main: string;
      username: string;
    }>(
      `
      SELECT
        u.email AS username,
        w.main_balance::text AS wallet_main,
        COALESCE((
          SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END)
          FROM ledger_entries
          WHERE account_code = 'user:' || $1::int || ':main'
        ), 0)::text AS ledger_main
      FROM users u
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.id = $1::int
      `,
      [uid],
    );
    const walletMain = parseFloat(balRes.rows[0].wallet_main ?? "0");
    const ledgerMain = parseFloat(balRes.rows[0].ledger_main ?? "0");
    const backfillTotal = withdrawals.reduce((s, w) => s + parseFloat(w.amount_usdt), 0);
    const afterLedgerMain = ledgerMain - backfillTotal;
    const willMatch = Math.abs(afterLedgerMain - walletMain) < 0.000001;
    projectionRows.push({
      user_id: uid,
      username: balRes.rows[0].username,
      wallet_main: walletMain,
      ledger_main: ledgerMain,
      drift: ledgerMain - walletMain,
      backfill_total: backfillTotal,
      after_ledger_main: afterLedgerMain,
      will_match: willMatch,
    });
  }

  console.log("Projected reconciliation:\n");
  console.log(
    "  user_id | username              | wallet_main | ledger_main | drift     | backfill   | after_ledger | match",
  );
  console.log(
    "  --------|-----------------------|-------------|-------------|-----------|------------|--------------|------",
  );
  for (const r of projectionRows) {
    console.log(
      `  ${String(r.user_id).padStart(7)} | ${r.username.padEnd(21)} | ` +
        `${r.wallet_main.toFixed(6).padStart(11)} | ${r.ledger_main.toFixed(6).padStart(11)} | ` +
        `${r.drift.toFixed(6).padStart(9)} | ${r.backfill_total.toFixed(6).padStart(10)} | ` +
        `${r.after_ledger_main.toFixed(6).padStart(12)} | ${r.will_match ? "✓ YES" : "✗ NO"}`,
    );
  }
  console.log("");

  const anyMismatch = projectionRows.some((r) => !r.will_match);
  if (anyMismatch) {
    console.error(
      "❌ WARNING: After backfill, at least one user's ledger_main would still NOT equal wallet_main.",
    );
    console.error("   This likely means there are OTHER drift sources beyond the orphan withdrawals");
    console.error("   (e.g., orphan deposits, manual adjustments, missing trade journals).");
    console.error("   Investigate before applying. Aborting in safety.");
    await client.end();
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("🛈  DRY-RUN — no changes written. Re-run with --apply to commit.");
    await client.end();
    return;
  }

  // 4. APPLY — wrap everything in a single transaction so the whole
  //    backfill is atomic.
  console.log("Applying reconciliation in one transaction...\n");

  await client.query("BEGIN");
  try {
    for (const w of orphansRes.rows) {
      const amountUsdt = w.amount_usdt; // numeric string, preserves precision
      const wdTag = `[INR-WD:${w.id}]`;
      const description =
        `${wdTag} INR withdrawal paid — ₹${parseFloat(w.amount_inr).toFixed(2)} ` +
        `(≈$${parseFloat(amountUsdt).toFixed(2)} USDT) via ${w.payout_method.toUpperCase()}` +
        (w.payout_reference ? ` — ref ${w.payout_reference}` : "") +
        ` (B21 retroactive reconciliation of pre-B21 orphan withdrawal)`;

      // Insert the completed transaction row first; we need its id for the
      // ledger entries' transaction_id link.
      const txnRes = await client.query<{ id: number }>(
        `
        INSERT INTO transactions (user_id, type, amount, status, description, created_at)
        VALUES ($1, 'withdrawal', $2::numeric, 'completed', $3, COALESCE($4::timestamp, now()))
        RETURNING id
        `,
        [w.user_id, amountUsdt, description, w.reviewed_at],
      );
      const txnId = txnRes.rows[0].id;

      // Two-line journal: debit user:UID:main, credit platform:usdt_pool.
      const userMainAcctId = userMainAcctIdByUid.get(w.user_id)!;
      const journalId = `inr_wd:${w.id}:approve`;

      await client.query(
        `
        INSERT INTO ledger_entries
          (journal_id, transaction_id, account_id, account_code, entry_type, amount, currency, description, created_at)
        VALUES
          ($1, $2, $3, $4, 'debit',  $5::numeric, 'USDT', $6, COALESCE($7::timestamp, now())),
          ($1, $2, $8, 'platform:usdt_pool', 'credit', $5::numeric, 'USDT', $9, COALESCE($7::timestamp, now()))
        `,
        [
          journalId,
          txnId,
          userMainAcctId,
          `user:${w.user_id}:main`,
          amountUsdt,
          `INR withdrawal #${w.id} settled (B21 retroactive)`,
          w.reviewed_at,
          usdtPoolId,
          `INR withdrawal #${w.id} paid out (user ${w.user_id})`,
        ],
      );

      console.log(
        `  ✓ WD#${w.id}  user=${w.user_id} (${w.username})  $${parseFloat(amountUsdt).toFixed(6)}  → txn#${txnId}, journal=${journalId}`,
      );
    }

    // 5. Post-flight verification INSIDE the transaction — re-compute the
    //    ledger balance for every affected user and ensure it exactly
    //    matches the wallet. If not, abort the whole thing.
    console.log("\nPost-flight verification:");
    for (const r of projectionRows) {
      const verifyRes = await client.query<{
        wallet_main: string;
        ledger_main: string;
      }>(
        `
        SELECT
          w.main_balance::text AS wallet_main,
          COALESCE((
            SELECT SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END)
            FROM ledger_entries
            WHERE account_code = 'user:' || $1::int || ':main'
          ), 0)::text AS ledger_main
        FROM wallets w
        WHERE w.user_id = $1::int
        `,
        [r.user_id],
      );
      const walletMain = parseFloat(verifyRes.rows[0].wallet_main ?? "0");
      const ledgerMain = parseFloat(verifyRes.rows[0].ledger_main ?? "0");
      const ok = Math.abs(walletMain - ledgerMain) < 0.000001;
      console.log(
        `  ${ok ? "✓" : "✗"} user ${r.user_id} (${r.username}): wallet=${walletMain.toFixed(6)}  ledger=${ledgerMain.toFixed(6)}  diff=${(ledgerMain - walletMain).toFixed(6)}`,
      );
      if (!ok) {
        throw new Error(
          `Post-flight check FAILED for user ${r.user_id}: wallet_main (${walletMain}) != ledger_main (${ledgerMain}). Aborting.`,
        );
      }
    }

    await client.query("COMMIT");
    console.log("\n✅ COMMITTED. Reconciliation complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ ROLLED BACK due to error:", err);
    process.exitCode = 1;
  }

  await client.end();
})();
