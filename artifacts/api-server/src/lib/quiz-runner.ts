// Drives a single live quiz through its 5-question lifecycle.
//
// Lifecycle per quiz:
//   1. transition `scheduled → live`, broadcast quiz_status_changed
//   2. for each of 5 questions in order:
//        a. mark current question (in `runnerStates`)
//        b. broadcast `question_started` with server-stamped started_at
//        c. wait window_ms + grace
//        d. broadcast `question_ended` with correct answer + per-option counts
//        e. broadcast `leaderboard_update` (top 10)
//   3. compute top 3, persist to `quiz_winners`, transition `live → ended`
//   4. broadcast `quiz_ended` with the final 3
//
// Server is the SOLE source of timing — clients render countdowns using the
// `startedAt` field in question_started events plus their own monotonic
// clock; they never set the deadline themselves.
//
// One-runner-per-quiz invariant
// ─────────────────────────────
// `quizScheduler` only ever spawns one runner per quizId per instance, and a
// process-wide `activeRunners` Map prevents double-spawn even from manual
// admin force-start. Cross-instance double-spawn is prevented by a Redis
// lock acquired by the scheduler before it spawns (so only one Fly machine
// owns a given quiz). Documented in `quiz-scheduler.ts`.

import { db } from "@workspace/db";
import {
  quizzesTable,
  quizQuestionsTable,
  quizAnswersTable,
  quizWinnersTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { logger } from "./logger";
import { PAYOUT_PCT } from "./quiz-economics";
import { publishQuizEvent } from "./quiz-event-bus";
import {
  clearLeaderboard,
  getParticipantCount,
  getTopN,
  type LeaderboardRow,
} from "./quiz-scoring";
import { creditQuizWinners } from "./quiz-payout";
import { dispatchQuizLivePings } from "./quiz-notifications";

// ─── Per-quiz runner state shared with the answer-submit handler ───────────
// The submit handler in routes/quiz.ts reads `currentQuestionId` and
// `questionStartedAtMs` to compute responseMs and to validate that the
// submission is for the LIVE question (rejecting stale submissions even
// before the DB unique index fires).
export type RunnerState = {
  quizId: number;
  status: "live" | "ended";
  currentQuestionId: number | null;
  currentPosition: number | null;
  questionStartedAtMs: number | null;
  questionDeadlineMs: number | null;
  windowMs: number;
};

const runnerStates = new Map<number, RunnerState>();
const activeRunners = new Map<number, Promise<void>>();

export function getRunnerState(quizId: number): RunnerState | null {
  return runnerStates.get(quizId) ?? null;
}

// Small grace window: clients can submit up to GRACE_MS after the
// server-side deadline to absorb network jitter. Anything later is rejected.
export const ANSWER_GRACE_MS = 250;

// Inter-question pause where users see the "correct answer" reveal screen
// before the next question starts. Long enough to read the reveal but
// short enough that a 5-round quiz finishes inside ~90 seconds.
const INTER_QUESTION_PAUSE_MS = 4_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function maskName(full: string | null | undefined): string {
  if (!full?.trim()) return "Anonymous";
  const parts = full.trim().split(/\s+/);
  const first = parts[0]!;
  const fmasked = first.length <= 2 ? first + "***" : first.slice(0, 2) + "***";
  const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toUpperCase()}.` : "";
  return fmasked + lastInitial;
}

async function namesFor(userIds: number[]): Promise<Map<number, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ id: usersTable.id, fullName: usersTable.fullName })
    .from(usersTable)
    .where(sql`${usersTable.id} = ANY(${userIds})`);
  const out = new Map<number, string>();
  for (const r of rows) out.set(r.id, maskName(r.fullName));
  return out;
}

async function broadcastLeaderboard(quizId: number): Promise<void> {
  const top = await getTopN(quizId, 10);
  const names = await namesFor(top.map((r) => r.userId));
  const participantsCount = await getParticipantCount(quizId);
  await publishQuizEvent(quizId, {
    type: "leaderboard_update",
    quizId,
    participantsCount,
    top: top.map((r) => ({
      userId: r.userId,
      score: r.score,
      rank: r.rank,
      displayName: names.get(r.userId) ?? "Anonymous",
    })),
  });
}

async function questionStats(questionId: number): Promise<{ totalAnswers: number; optionCounts: number[] }> {
  // Per-option vote counts for the just-ended question. 4-element array.
  const rows = await db
    .select({ opt: quizAnswersTable.selectedOption, c: sql<string>`count(*)::text` })
    .from(quizAnswersTable)
    .where(eq(quizAnswersTable.questionId, questionId))
    .groupBy(quizAnswersTable.selectedOption);
  const optionCounts = [0, 0, 0, 0];
  let totalAnswers = 0;
  for (const r of rows) {
    if (r.opt >= 0 && r.opt < 4) {
      const n = parseInt(r.c, 10) || 0;
      optionCounts[r.opt] = n;
      totalAnswers += n;
    }
  }
  return { totalAnswers, optionCounts };
}

/**
 * Persist the final top-3 from the Redis leaderboard into `quiz_winners` and
 * mark the quiz `ended`. Idempotent — wrapped in a transaction and skipped
 * if winners already exist for the quiz.
 */
async function finalizeQuiz(quizId: number, prizePool: string, prizeCurrency: string, prizeSplit: number[]): Promise<LeaderboardRow[]> {
  const top = await getTopN(quizId, 3);
  const names = await namesFor(top.map((r) => r.userId));

  // The advertised prize_pool is the *gross* pot. We retain PLATFORM_RAKE_PCT
  // (currently 20%) as platform revenue and only distribute the remaining
  // PAYOUT_PCT among winners, scaled by the per-rank split fractions.
  // This is intentionally invisible to players — leaderboards & "you won X"
  // toasts surface the post-rake amount which is the real credit they get.
  const pool = parseFloat(prizePool) || 0;
  const distributable = pool * PAYOUT_PCT;
  const splitNorm = (prizeSplit ?? [0.5, 0.3, 0.2]).slice(0, 3);
  while (splitNorm.length < 3) splitNorm.push(0);

  await db.transaction(async (tx) => {
    // Idempotency: if any winners already exist for this quiz, skip insert.
    const existing = await tx
      .select({ id: quizWinnersTable.id })
      .from(quizWinnersTable)
      .where(eq(quizWinnersTable.quizId, quizId))
      .limit(1);
    if (existing.length === 0 && top.length > 0) {
      const values = top.map((row, i) => ({
        quizId,
        userId: row.userId,
        rank: i + 1,
        finalScore: row.score,
        prizeAmount: ((distributable * (splitNorm[i] ?? 0)).toFixed(2)),
        prizeCurrency,
      }));
      await tx.insert(quizWinnersTable).values(values);
    }
    await tx
      .update(quizzesTable)
      .set({ status: "ended", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(quizzesTable.id, quizId));
  });

  await publishQuizEvent(quizId, {
    type: "quiz_status_changed",
    quizId,
    status: "ended",
  });

  await publishQuizEvent(quizId, {
    type: "quiz_ended",
    quizId,
    winners: top.map((row, i) => ({
      userId: row.userId,
      displayName: names.get(row.userId) ?? "Anonymous",
      score: row.score,
      rank: i + 1,
      prizeAmount: (distributable * (splitNorm[i] ?? 0)).toFixed(2),
      prizeCurrency,
    })),
  });

  // Free the leaderboard ZSET — the truth lives in `quiz_winners` now.
  try {
    await clearLeaderboard(quizId);
  } catch (err) {
    logger.warn({ err: (err as Error).message, quizId }, "[quiz-runner] clearLeaderboard failed (non-fatal)");
  }

  return top;
}

/**
 * Spawn (or no-op) a runner for `quizId`. Returns a promise that resolves
 * when the runner completes. Subsequent calls during the same lifecycle
 * return the in-flight promise so a force-start spam doesn't double-run.
 */
export function startQuizRunner(quizId: number): Promise<void> {
  const existing = activeRunners.get(quizId);
  if (existing) return existing;
  const p = runQuiz(quizId).finally(() => {
    activeRunners.delete(quizId);
    runnerStates.delete(quizId);
  });
  activeRunners.set(quizId, p);
  return p;
}

async function runQuiz(quizId: number): Promise<void> {
  const log = logger.child({ scope: "quiz-runner", quizId });
  log.info("starting");

  const [quiz] = await db.select().from(quizzesTable).where(eq(quizzesTable.id, quizId)).limit(1);
  if (!quiz) {
    log.warn("quiz not found, aborting");
    return;
  }
  if (quiz.status === "ended" || quiz.status === "cancelled") {
    log.warn({ status: quiz.status }, "quiz not runnable, aborting");
    return;
  }

  const questions = await db
    .select()
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.quizId, quizId))
    .orderBy(asc(quizQuestionsTable.position));

  if (questions.length === 0) {
    log.error("quiz has no questions, marking ended without winners");
    await db.update(quizzesTable).set({ status: "ended", endedAt: new Date(), updatedAt: new Date() }).where(eq(quizzesTable.id, quizId));
    await publishQuizEvent(quizId, { type: "quiz_status_changed", quizId, status: "ended" });
    return;
  }

  // Transition to live (idempotent if scheduler already did it).
  await db
    .update(quizzesTable)
    .set({ status: "live", startedAt: quiz.startedAt ?? new Date(), updatedAt: new Date() })
    .where(eq(quizzesTable.id, quizId));
  await publishQuizEvent(quizId, { type: "quiz_status_changed", quizId, status: "live" });

  // Fire the "live now" notification fan-out off the critical path. The
  // dispatcher uses a CAS UPDATE on `notified_live_at` so a runner restart
  // won't double-send. Errors never block the question loop — notifications
  // are best-effort.
  void dispatchQuizLivePings(quizId).catch((err) =>
    log.warn({ err: (err as Error).message }, "live ping dispatch failed"),
  );

  const state: RunnerState = {
    quizId,
    status: "live",
    currentQuestionId: null,
    currentPosition: null,
    questionStartedAtMs: null,
    questionDeadlineMs: null,
    windowMs: quiz.questionTimeMs,
  };
  runnerStates.set(quizId, state);

  for (const q of questions) {
    const startedAt = new Date();
    const startedAtMs = startedAt.getTime();
    const deadlineMs = startedAtMs + quiz.questionTimeMs;
    state.currentQuestionId = q.id;
    state.currentPosition = q.position;
    state.questionStartedAtMs = startedAtMs;
    state.questionDeadlineMs = deadlineMs;

    await publishQuizEvent(quizId, {
      type: "question_started",
      quizId,
      questionId: q.id,
      position: q.position,
      totalQuestions: questions.length,
      prompt: q.prompt,
      options: q.options,
      startedAt: startedAt.toISOString(),
      windowMs: quiz.questionTimeMs,
      deadlineAt: new Date(deadlineMs).toISOString(),
    });

    // Wait for the answer window + small grace so late submissions are still
    // reflected in the per-question stats we publish next.
    await sleep(quiz.questionTimeMs + ANSWER_GRACE_MS);

    // Close the question — broadcast the correct answer + counts.
    state.currentQuestionId = null;
    state.questionStartedAtMs = null;
    state.questionDeadlineMs = null;

    const stats = await questionStats(q.id);
    await publishQuizEvent(quizId, {
      type: "question_ended",
      quizId,
      questionId: q.id,
      position: q.position,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      stats,
    });

    // Broadcast leaderboard right after question_ended so users see their new rank.
    await broadcastLeaderboard(quizId);

    // Inter-question pause UNLESS this was the last question.
    if (q.position < questions.length - 1) {
      await sleep(INTER_QUESTION_PAUSE_MS);
    }
  }

  // Finalize — compute winners, persist, broadcast.
  await finalizeQuiz(quizId, String(quiz.prizePool), quiz.prizeCurrency, quiz.prizeSplit ?? [0.5, 0.3, 0.2]);
  state.status = "ended";

  // Auto-credit is best-effort; failures fall back to manual mark-paid.
  try {
    await creditQuizWinners(quizId);
  } catch (err) {
    log.error({ err: (err as Error).message }, "auto-credit pass threw — manual fallback available");
  }

  log.info("ended");
}
