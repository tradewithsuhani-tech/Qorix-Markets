// Background scheduler that flips `scheduled` quizzes to `live` when their
// start time arrives, and spawns a runner per quiz.
//
// Runs as a 5-second interval inside the api-server process group. Lives
// behind the `shouldRunBackgroundJobs` gate so a maintenance-mode instance
// or a webserver-only deploy never spawns runners (the runner-owner is
// always the same instance that owns the rest of the cron / poller stack).
//
// Cross-instance safety
// ─────────────────────
// In a multi-Fly-machine deploy ALL machines could try to start the runner
// for the same quiz at the same time. We use a Redis SET NX lock keyed per
// quiz to guarantee exactly one machine wins. The lock has a TTL slightly
// longer than the worst-case quiz length (5 questions × 15s + 4 pauses +
// finalize buffer). If the owning instance dies the lock expires naturally
// and another machine picks it up on the next tick.

import { db } from "@workspace/db";
import { quizzesTable } from "@workspace/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { logger } from "./logger";
import { getRedisConnection } from "./redis";
import { startQuizRunner } from "./quiz-runner";
import { dispatchUpcomingFiveMinPings } from "./quiz-notifications";

const SCHEDULER_TICK_MS = 5_000;
const LOCK_PREFIX = "qz:runner-lock:v1:";
// Worst-case quiz duration: 5q × 15s + 4 × pause + 30s finalize buffer.
const LOCK_TTL_MS = 5 * 15_000 + 4 * 5_000 + 30_000;

let timer: NodeJS.Timeout | null = null;
let stopped = false;

async function acquireLock(quizId: number): Promise<boolean> {
  try {
    const r = await getRedisConnection().set(
      `${LOCK_PREFIX}${quizId}`,
      String(process.pid),
      "PX",
      LOCK_TTL_MS,
      "NX",
    );
    return r === "OK";
  } catch (err) {
    logger.warn({ err: (err as Error).message, quizId }, "[quiz-scheduler] acquireLock error");
    return false;
  }
}

async function releaseLock(quizId: number): Promise<void> {
  try {
    await getRedisConnection().del(`${LOCK_PREFIX}${quizId}`);
  } catch {
    // Best-effort — TTL will clean it up.
  }
}

async function tick(): Promise<void> {
  if (stopped) return;

  // ── 1. Pre-quiz "starting in 5 min" pings ────────────────────────────────
  // Cheap: a single indexed select bounded by the same status filter as
  // below. Errors here MUST NOT prevent the runner-spawn step that follows
  // (notifications are best-effort; quiz execution is core).
  await dispatchUpcomingFiveMinPings().catch((err) =>
    logger.warn({ err: (err as Error).message }, "[quiz-scheduler] 5-min ping dispatch error"),
  );

  // ── 2. Spawn runners for quizzes whose start time has arrived ────────────
  // Index `quizzes_status_start_idx` makes this O(matches).
  const due = await db
    .select({ id: quizzesTable.id })
    .from(quizzesTable)
    .where(and(eq(quizzesTable.status, "scheduled"), lte(quizzesTable.scheduledStartAt, new Date())));

  for (const q of due) {
    const won = await acquireLock(q.id);
    if (!won) continue;
    // Don't await — we want the scheduler tick to keep moving. The runner
    // releases the lock when it returns (success or failure).
    void (async () => {
      try {
        await startQuizRunner(q.id);
      } catch (err) {
        logger.error({ err: (err as Error).message, quizId: q.id }, "[quiz-scheduler] runner failed");
      } finally {
        await releaseLock(q.id);
      }
    })();
  }
}

/**
 * Start the scheduler. Idempotent — calling start twice is a no-op. Returns
 * a stoppable handle compatible with the `shouldRunBackgroundJobs` gate.
 */
export function startQuizScheduler(): { stop: () => void } {
  if (timer) {
    return { stop: () => stopQuizScheduler() };
  }
  stopped = false;
  timer = setInterval(() => {
    void tick().catch((err) => {
      logger.error({ err: (err as Error).message }, "[quiz-scheduler] tick error");
    });
  }, SCHEDULER_TICK_MS);
  // Run immediately so a freshly-deployed instance picks up any already-due
  // quizzes without waiting for the first interval.
  void tick().catch((err) => {
    logger.error({ err: (err as Error).message }, "[quiz-scheduler] initial tick error");
  });
  logger.info({ tickMs: SCHEDULER_TICK_MS }, "[quiz-scheduler] started");
  return { stop: () => stopQuizScheduler() };
}

export function stopQuizScheduler(): void {
  stopped = true;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Force-start a quiz from an admin endpoint. Bypasses the scheduled-time
 * check but still respects the cross-instance lock. Returns true if THIS
 * instance won the lock and started the runner; false otherwise (the
 * other instance handled it).
 */
export async function forceStartQuiz(quizId: number): Promise<boolean> {
  const won = await acquireLock(quizId);
  if (!won) return false;
  void (async () => {
    try {
      await startQuizRunner(quizId);
    } catch (err) {
      logger.error({ err: (err as Error).message, quizId }, "[quiz-scheduler] force-start runner failed");
    } finally {
      await releaseLock(quizId);
    }
  })();
  return true;
}
