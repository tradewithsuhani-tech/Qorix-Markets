import { db, usersTable, investmentsTable, notificationsTable } from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
import { createNotification } from "./notifications";
import { sendEmail } from "./email-service";
import { logger } from "./logger";

/**
 * Loyalty milestones — keep in sync with frontend rewards.tsx LOYALTY_MILESTONES.
 * When a sponsor's network AUM (sum of active investment amounts of all
 * directly-referred users) crosses a milestone, we fire a one-shot
 * notification + email to the sponsor.
 *
 * Idempotency is enforced by checking the notifications table — each
 * milestone uses a unique [M{id}] tag in the title prefix so we can
 * safely re-run the check on every referral activation.
 */
export interface Milestone {
  id: number;
  networkAum: number;
  reward: string;
  label: string;
}

export const LOYALTY_MILESTONES: Milestone[] = [
  { id: 1, networkAum: 50_000, reward: "$500", label: "$50K Network" },
  { id: 2, networkAum: 200_000, reward: "$2,000", label: "$200K Network" },
  { id: 3, networkAum: 1_000_000, reward: "$10,000", label: "$1M Network" },
];

const TAG_PREFIX = "[M"; // title format: "[M1] $50K Network milestone reached"

async function computeNetworkAum(sponsorId: number): Promise<number> {
  const rows = await db
    .select({
      total: sql<string>`COALESCE(SUM(${investmentsTable.amount}::numeric), 0)`,
    })
    .from(investmentsTable)
    .innerJoin(usersTable, eq(usersTable.id, investmentsTable.userId))
    .where(and(eq(usersTable.sponsorId, sponsorId), eq(investmentsTable.isActive, true)));
  return parseFloat(String(rows[0]?.total ?? "0")) || 0;
}

// Accepts an executor (db or tx) so the read shares the same connection as
// any advisory lock held in the caller's transaction. Without this, a
// transactional advisory lock and a read on the global pool would land on
// different connections — defeating the lock.
async function alreadyNotified(
  executor: { select: typeof db.select },
  sponsorId: number,
  milestoneId: number,
): Promise<boolean> {
  const tag = `${TAG_PREFIX}${milestoneId}]`;
  const rows = await executor
    .select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, sponsorId),
        eq(notificationsTable.type, "milestone"),
        like(notificationsTable.title, `${tag}%`),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// Stable Postgres advisory-lock keyspace for milestone firing. Composed of
// two int4s: (LOCK_NAMESPACE, sponsorId). This guarantees that two
// concurrent calls for the same sponsor serialize through the lock — so the
// `alreadyNotified → createNotification` check-and-act sequence is race-free
// across processes and connections.
const LOCK_NAMESPACE = 0x715e_71c5; // arbitrary "qorix" magic number

/**
 * Check the sponsor's current network AUM against all milestones; fire a
 * notification + email for every newly-crossed (and not-yet-notified) one.
 *
 * Idempotency: protected by a Postgres advisory lock keyed on sponsorId
 * combined with the [M{id}] tag check, so concurrent referral activations
 * for the same sponsor cannot race into duplicate notifications/emails.
 *
 * Safe to call repeatedly. Errors are logged but never thrown (this is a
 * side-effect, not critical path).
 */
export async function checkAndFireMilestones(sponsorId: number): Promise<void> {
  try {
    if (!sponsorId || sponsorId <= 0) return;

    const networkAum = await computeNetworkAum(sponsorId);
    if (networkAum <= 0) return;

    // Find user email for outbound mail (best-effort; skip mail if missing).
    const sponsorRows = await db
      .select({ email: usersTable.email, fullName: usersTable.fullName, isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, sponsorId))
      .limit(1);
    const sponsor = sponsorRows[0];
    if (!sponsor || sponsor.isAdmin) return;

    // Serialize all milestone firing for this sponsor across the cluster.
    // pg_try_advisory_lock returns false if another process already holds it
    // — in that case we just bail out; that other process will fire whatever
    // needs firing (and will see the latest AUM since it ran after us).
    await db.transaction(async (tx) => {
      const lockRes = await tx.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_xact_lock(${LOCK_NAMESPACE}::int, ${sponsorId}::int) AS locked`,
      );
      const locked = (lockRes.rows[0] as { locked?: boolean } | undefined)?.locked === true;
      if (!locked) {
        logger.debug({ sponsorId }, "Milestone check skipped — another worker holds the lock");
        return;
      }

      for (const m of LOYALTY_MILESTONES) {
        if (networkAum < m.networkAum) continue;
        // CRITICAL: read AND write must use `tx` — both must run on the same
        // pooled connection that holds the advisory lock above. Using the
        // global `db` would route the queries to a different connection and
        // re-introduce the TOCTOU race the lock was meant to prevent.
        if (await alreadyNotified(tx, sponsorId, m.id)) continue;

        const title = `${TAG_PREFIX}${m.id}] ${m.label} Milestone Reached`;
        const message =
          `Congratulations! Your referral network has crossed $${m.networkAum.toLocaleString()} in active investments. ` +
          `Your ${m.reward} loyalty reward will be credited to your profit balance shortly.`;

        await createNotification(sponsorId, "milestone", title, message, tx);

        // Email — fire-and-forget, never blocks
        try {
          await sendEmail(
            sponsor.email,
            `${m.label} milestone reached — ${m.reward} reward incoming`,
            `Hi ${sponsor.fullName || "there"},\n\n` +
              `Your referral network has just crossed $${m.networkAum.toLocaleString()} in active investments.\n\n` +
              `As part of the Qorix Markets Loyalty Program, you've unlocked a ${m.reward} cash reward, ` +
              `which will be credited to your profit balance shortly.\n\n` +
              `Keep growing — the next milestone awaits.\n\n` +
              `— Qorix Markets`,
          );
        } catch (err) {
          logger.warn({ err, sponsorId, milestoneId: m.id }, "Milestone email send failed (non-fatal)");
        }

        logger.info(
          { sponsorId, milestoneId: m.id, networkAum, reward: m.reward },
          "Milestone notification fired",
        );
      }
    });
  } catch (err) {
    logger.error({ err, sponsorId }, "checkAndFireMilestones failed");
  }
}
