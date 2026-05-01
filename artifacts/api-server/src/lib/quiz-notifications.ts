// Pre-quiz notification dispatcher.
//
// Two pings per quiz (joined participants only):
//   1. "Starting in 5 min"  — sent ~5 minutes before scheduledStartAt
//   2. "Live now"           — sent the moment the runner flips status to live
//
// Both use the existing in-app notification + branded transactional email
// channels (in-app `createNotification` mirrors to Telegram for users who
// have opted in, so we don't need a separate "push" pipeline). Per-quiz
// `notifyEnabled` is checked at dispatch time, so an admin can disable
// pings on a quiz that was created with notifications on.
//
// Cross-instance safety
// ─────────────────────
// In a multi-Fly-machine deploy more than one scheduler tick can fire for
// the same quiz on the same second. We use the `notified_five_min_at` /
// `notified_live_at` timestamps as the dedupe: a conditional UPDATE …
// WHERE … IS NULL … RETURNING is atomic in Postgres, so only one machine
// gets the row back and runs the actual sends. No extra Redis lock needed.

import { db } from "@workspace/db";
import {
  quizzesTable,
  quizParticipantsTable,
} from "@workspace/db/schema";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { createNotification } from "./notifications";
import { sendTxnEmailToUser } from "./email-service";

// ─── Constants ─────────────────────────────────────────────────────────────
// "Starting in 5 minutes" lead time. The scheduler tick is 5s so the actual
// send fires within ~5s of the 5-min mark.
const FIVE_MIN_MS = 5 * 60 * 1000;

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatStartTime(d: Date): string {
  // UTC for now — the email body is plain text and rendering localized time
  // for every recipient would need a per-user TZ column we don't have. UTC
  // is unambiguous and matches the tone of our other transactional emails.
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

async function fetchJoinedUserIds(quizId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: quizParticipantsTable.userId })
    .from(quizParticipantsTable)
    .where(eq(quizParticipantsTable.quizId, quizId));
  return rows.map((r) => r.userId);
}

// ─── 5-min "starting soon" dispatcher ──────────────────────────────────────
// Called from quiz-scheduler.ts on every tick. Cheap when nothing is due
// (single indexed select). The CAS UPDATE per-quiz means even if two
// machines tick at the exact same instant only one will actually send.
export async function dispatchUpcomingFiveMinPings(): Promise<void> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + FIVE_MIN_MS);

  // Find quizzes that:
  //  - are still scheduled (not cancelled / live / ended)
  //  - have notifications enabled
  //  - haven't been pinged yet
  //  - start more than ~now (avoid double-sending right before live)
  //  - start within the next 5 minutes
  const due = await db
    .select({ id: quizzesTable.id })
    .from(quizzesTable)
    .where(
      and(
        eq(quizzesTable.status, "scheduled"),
        eq(quizzesTable.notifyEnabled, true),
        isNull(quizzesTable.notifiedFiveMinAt),
        gt(quizzesTable.scheduledStartAt, now),
        lte(quizzesTable.scheduledStartAt, cutoff),
      ),
    );

  for (const q of due) {
    void sendFiveMinPing(q.id).catch((err) =>
      logger.warn(
        { err: (err as Error).message, quizId: q.id },
        "[quiz-notifications] 5-min ping failed",
      ),
    );
  }
}

async function sendFiveMinPing(quizId: number): Promise<void> {
  // Atomically claim the send by stamping the dedupe column. If another
  // instance got there first (or the admin disabled notify in the last
  // 5s), this returns no rows and we exit silently.
  const [claimed] = await db
    .update(quizzesTable)
    .set({ notifiedFiveMinAt: new Date() })
    .where(
      and(
        eq(quizzesTable.id, quizId),
        eq(quizzesTable.status, "scheduled"),
        eq(quizzesTable.notifyEnabled, true),
        isNull(quizzesTable.notifiedFiveMinAt),
      ),
    )
    .returning({
      id: quizzesTable.id,
      title: quizzesTable.title,
      scheduledStartAt: quizzesTable.scheduledStartAt,
      prizePool: quizzesTable.prizePool,
      prizeCurrency: quizzesTable.prizeCurrency,
    });
  if (!claimed) return;

  const userIds = await fetchJoinedUserIds(quizId);
  if (userIds.length === 0) {
    logger.info({ quizId }, "[quiz-notifications] 5-min ping — no joined users");
    return;
  }

  const startAt = formatStartTime(claimed.scheduledStartAt);
  const title = `Starting in 5 minutes: ${claimed.title}`;
  const message =
    `Heads up — the "${claimed.title}" quiz you joined kicks off at ${startAt} ` +
    `(in about 5 minutes). Prize pool: ${claimed.prizePool} ${claimed.prizeCurrency}. ` +
    `Open the Quizzes page so you're ready when the first question drops.`;

  for (const userId of userIds) {
    // In-app notification (also mirrors to Telegram if user opted in).
    await createNotification(userId, "system", title, message).catch((err) =>
      logger.warn(
        { err: (err as Error).message, quizId, userId },
        "[quiz-notifications] in-app 5-min create failed",
      ),
    );
    // Branded email (fire-and-forget; respects user.email being null).
    sendTxnEmailToUser(userId, title, message);
  }

  logger.info(
    { quizId, recipients: userIds.length },
    "[quiz-notifications] sent 5-min pings",
  );
}

// ─── Live-now dispatcher ───────────────────────────────────────────────────
// Called from quiz-runner.ts immediately after the status → live transition.
// Same CAS pattern — runner already holds a Redis lock, but the conditional
// UPDATE protects against a second runner re-firing this on retry/restart.
export async function dispatchQuizLivePings(quizId: number): Promise<void> {
  const [claimed] = await db
    .update(quizzesTable)
    .set({ notifiedLiveAt: new Date() })
    .where(
      and(
        eq(quizzesTable.id, quizId),
        eq(quizzesTable.notifyEnabled, true),
        isNull(quizzesTable.notifiedLiveAt),
      ),
    )
    .returning({
      id: quizzesTable.id,
      title: quizzesTable.title,
      prizePool: quizzesTable.prizePool,
      prizeCurrency: quizzesTable.prizeCurrency,
    });
  if (!claimed) return;

  const userIds = await fetchJoinedUserIds(quizId);
  if (userIds.length === 0) {
    logger.info({ quizId }, "[quiz-notifications] live ping — no joined users");
    return;
  }

  const title = `Live now: ${claimed.title}`;
  const message =
    `The "${claimed.title}" quiz just went live. ` +
    `Hop in now — questions appear one at a time and you have a few seconds each. ` +
    `Prize pool: ${claimed.prizePool} ${claimed.prizeCurrency}.`;

  for (const userId of userIds) {
    await createNotification(userId, "system", title, message).catch((err) =>
      logger.warn(
        { err: (err as Error).message, quizId, userId },
        "[quiz-notifications] in-app live create failed",
      ),
    );
    sendTxnEmailToUser(userId, title, message);
  }

  logger.info(
    { quizId, recipients: userIds.length },
    "[quiz-notifications] sent live pings",
  );
}

// Reset both dedupe stamps. Used when an admin moves a scheduled quiz's
// start time more than 5 minutes into the future after the 5-min ping has
// already gone out, OR when re-enabling notify after toggling off. Currently
// not wired automatically; exported for future use.
export async function resetQuizNotificationStamps(quizId: number): Promise<void> {
  await db
    .update(quizzesTable)
    .set({ notifiedFiveMinAt: null, notifiedLiveAt: null, updatedAt: new Date() })
    .where(eq(quizzesTable.id, quizId));
}

// Re-export sql in case future callers need raw expressions for CAS.
export { sql };
