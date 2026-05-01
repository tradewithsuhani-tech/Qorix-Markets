// Auto-credit quiz prizes to winners' wallets.
//
// Each winner is credited inside its own DB transaction. The winner row is
// locked with FOR UPDATE so a manual mark-paid (or a re-spawned runner)
// cannot double-credit. We post a balanced ledger entry mirroring the
// deposit-credit pattern (debit platform:usdt_pool, credit user:{uid}:main)
// so reconciliation keeps balancing.
//
// Only USDT prizes auto-credit; anything else is left pending for the
// existing manual mark-paid flow. The `quiz_auto_credit_enabled` setting
// (default true) is the kill-switch.

import { db } from "@workspace/db";
import {
  quizWinnersTable,
  walletsTable,
  transactionsTable,
  systemSettingsTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  ensureUserAccounts,
  postJournalEntry,
  journalForTransaction,
} from "./ledger-service";

const SETTINGS_KEY = "quiz_auto_credit_enabled";

// Failure-open: a transient settings-table error keeps auto-credit ON
// rather than silently switching operating mode.
export async function isAutoCreditEnabled(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: systemSettingsTable.value })
      .from(systemSettingsTable)
      .where(eq(systemSettingsTable.key, SETTINGS_KEY))
      .limit(1);
    if (!row) return true;
    return row.value !== "false";
  } catch (err) {
    logger.warn(
      { err: (err as Error).message },
      "[quiz-payout] settings lookup failed — defaulting to ENABLED",
    );
    return true;
  }
}

export type CreditOutcome =
  | { status: "credited"; winnerId: number; userId: number; txnId: number; amount: number }
  | { status: "skipped"; winnerId: number; userId: number; reason: string };

export async function creditOneWinner(winnerId: number): Promise<CreditOutcome> {
  return await db.transaction(async (tx) => {
    const lockedRows = await tx.execute<{
      id: number;
      quiz_id: number;
      user_id: number;
      prize_amount: string;
      prize_currency: string;
      paid_status: "pending" | "paid";
    }>(
      sql`SELECT id, quiz_id, user_id, prize_amount, prize_currency, paid_status
          FROM quiz_winners
          WHERE id = ${winnerId}
          FOR UPDATE`,
    );
    const row = lockedRows.rows[0];
    if (!row) {
      return { status: "skipped", winnerId, userId: 0, reason: "winner_not_found" };
    }
    if (row.paid_status !== "pending") {
      return { status: "skipped", winnerId, userId: row.user_id, reason: "already_paid" };
    }

    const amount = parseFloat(row.prize_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { status: "skipped", winnerId, userId: row.user_id, reason: "non_positive_prize" };
    }
    if ((row.prize_currency ?? "USDT").toUpperCase() !== "USDT") {
      return { status: "skipped", winnerId, userId: row.user_id, reason: "unsupported_currency" };
    }

    const userId = row.user_id;

    await ensureUserAccounts(userId, tx);

    const updated = await tx
      .update(walletsTable)
      .set({
        mainBalance: sql`${walletsTable.mainBalance} + ${amount.toFixed(8)}`,
        updatedAt: new Date(),
      })
      .where(eq(walletsTable.userId, userId))
      .returning({ userId: walletsTable.userId });
    if (updated.length === 0) {
      // No wallet row — refuse to invent one; flag for manual review.
      logger.warn(
        { userId, winnerId },
        "[quiz-payout] user has no wallet row — leaving winner pending for manual review",
      );
      return { status: "skipped", winnerId, userId, reason: "no_wallet_row" };
    }

    const [txn] = await tx
      .insert(transactionsTable)
      .values({
        userId,
        type: "quiz_prize",
        amount: amount.toFixed(8),
        status: "completed",
        description: `Quiz #${row.quiz_id} prize — auto-credited`,
      })
      .returning({ id: transactionsTable.id });

    await postJournalEntry(
      journalForTransaction(txn!.id),
      [
        {
          accountCode: "platform:usdt_pool",
          entryType: "debit",
          amount,
          description: `Quiz #${row.quiz_id} prize paid out`,
        },
        {
          accountCode: `user:${userId}:main`,
          entryType: "credit",
          amount,
          description: `Quiz #${row.quiz_id} prize credited to main wallet`,
        },
      ],
      txn!.id,
      tx,
    );

    await tx
      .update(quizWinnersTable)
      .set({
        paidStatus: "paid",
        paidAt: new Date(),
        paidByAdminId: null,
        paidTxnId: txn!.id,
        paidNote: "Auto-credited from quiz prize pool",
      })
      .where(
        and(
          eq(quizWinnersTable.id, winnerId),
          eq(quizWinnersTable.paidStatus, "pending"),
        ),
      );

    return { status: "credited", winnerId, userId, txnId: txn!.id, amount };
  });
}

// Per-winner failures are logged but never block the others; the runner
// caller treats this whole pass as best-effort.
export async function creditQuizWinners(quizId: number): Promise<{
  enabled: boolean;
  outcomes: CreditOutcome[];
}> {
  const enabled = await isAutoCreditEnabled();
  if (!enabled) {
    logger.info({ quizId }, "[quiz-payout] kill-switch off — skipping auto-credit");
    return { enabled: false, outcomes: [] };
  }

  const winners = await db
    .select({ id: quizWinnersTable.id })
    .from(quizWinnersTable)
    .where(eq(quizWinnersTable.quizId, quizId));

  const outcomes: CreditOutcome[] = [];
  for (const w of winners) {
    try {
      const outcome = await creditOneWinner(w.id);
      outcomes.push(outcome);
    } catch (err) {
      logger.error(
        { err: (err as Error).message, quizId, winnerId: w.id },
        "[quiz-payout] failed to auto-credit winner",
      );
    }
  }

  const credited = outcomes.filter((o) => o.status === "credited").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  logger.info(
    { quizId, credited, skipped, total: winners.length },
    "[quiz-payout] auto-credit pass complete",
  );
  return { enabled: true, outcomes };
}
