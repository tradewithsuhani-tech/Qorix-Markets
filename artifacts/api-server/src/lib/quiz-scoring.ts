// Scoring + Redis sorted-set leaderboard helpers.
//
// Score formula (matches task-102):
//   correct ? round(BASE + TIME_BONUS_MAX * max(0, 1 - response_ms / window_ms))
//           : 0
//
// BASE = 500, TIME_BONUS_MAX = 500, so a perfect-instant correct answer is
// 1000 and a correct-at-the-buzzer answer is exactly 500. Wrong / no-answer
// is 0. The window_ms is the per-question deadline configured on the quiz.
//
// Leaderboard storage:
//   ZADD qz:scores:v1:{quizId} <total_score> <userId>
//   ZREVRANGE … WITHSCORES for top-N
//   ZREVRANK for a specific user's rank
//
// Persisting in Redis means a 5,000-user quiz reads the top-10 in O(log N)
// instead of doing a full SUM over the answers table for every leaderboard
// tick. At quiz-end we snapshot the final ZSET into the `quiz_winners`
// table so historical results survive Redis loss.

import type IORedis from "ioredis";
import { getRedisConnection } from "./redis";

const BASE_SCORE = 500;
const TIME_BONUS_MAX = 500;

/** Compute the score for a single answer given correctness, response time and window. */
export function computeScore(opts: {
  isCorrect: boolean;
  responseMs: number;
  windowMs: number;
}): number {
  if (!opts.isCorrect) return 0;
  const ratio = Math.max(0, 1 - opts.responseMs / opts.windowMs);
  return Math.round(BASE_SCORE + TIME_BONUS_MAX * ratio);
}

const SCORES_KEY_PREFIX = "qz:scores:v1:";
function scoresKey(quizId: number): string {
  return `${SCORES_KEY_PREFIX}${quizId}`;
}

// Per-quiz "this user has answered question Q" SETNX key. TTL ≈ window_ms
// so the keys auto-expire even if the runner crashes mid-quiz.
const ANSWERED_KEY_PREFIX = "qz:answered:v1:";
function answeredKey(quizId: number, questionId: number, userId: number): string {
  return `${ANSWERED_KEY_PREFIX}${quizId}:${questionId}:${userId}`;
}

/**
 * Atomically claim the answer slot for (quizId, questionId, userId). Returns
 * true if the caller is the FIRST writer; false means the user already
 * answered this question and the caller MUST reject the request without
 * touching the DB.
 *
 * Combined with the DB unique index, this is the two-layer anti-cheat
 * guarantee: Redis blocks 99% of races at zero DB cost; the unique index
 * is the correctness backstop.
 */
export async function claimAnswerSlot(
  quizId: number,
  questionId: number,
  userId: number,
  ttlMs: number,
): Promise<boolean> {
  const redis = getRedisConnection();
  // SET key value NX PX ttl — sets only if not exists, with millisecond TTL.
  const result = await redis.set(answeredKey(quizId, questionId, userId), "1", "PX", ttlMs, "NX");
  return result === "OK";
}

/** Increment a user's running score in the leaderboard sorted set. */
export async function addScore(quizId: number, userId: number, delta: number): Promise<number> {
  if (delta <= 0) {
    // ZINCRBY by 0 still emits a write — skip the round-trip when there's
    // nothing to add (wrong / no-answer cases route through here too).
    const current = await getRedisConnection().zscore(scoresKey(quizId), String(userId));
    return current ? Number(current) : 0;
  }
  const redis = getRedisConnection();
  const newScore = await redis.zincrby(scoresKey(quizId), delta, String(userId));
  return Number(newScore);
}

/** Look up the current score for one user (0 if they have no row yet). */
export async function getUserScore(quizId: number, userId: number): Promise<number> {
  const v = await getRedisConnection().zscore(scoresKey(quizId), String(userId));
  return v ? Number(v) : 0;
}

/**
 * 1-indexed rank of `userId` in the quiz leaderboard, or null if not yet
 * scored. ZREVRANK returns 0 for the highest score, so we add 1.
 */
export async function getUserRank(quizId: number, userId: number): Promise<number | null> {
  const r = await getRedisConnection().zrevrank(scoresKey(quizId), String(userId));
  return r === null ? null : r + 1;
}

export type LeaderboardRow = { userId: number; score: number; rank: number };

/** Top-N leaderboard rows, highest first. Each row carries a 1-indexed rank. */
export async function getTopN(quizId: number, n: number): Promise<LeaderboardRow[]> {
  const raw = await getRedisConnection().zrevrange(scoresKey(quizId), 0, n - 1, "WITHSCORES");
  const out: LeaderboardRow[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ userId: Number(raw[i]!), score: Number(raw[i + 1]!), rank: out.length + 1 });
  }
  return out;
}

/** Total participants currently scored. Used in leaderboard payload. */
export async function getParticipantCount(quizId: number, redis?: IORedis): Promise<number> {
  return (redis ?? getRedisConnection()).zcard(scoresKey(quizId));
}

/** Drop the leaderboard ZSET (called once winners are persisted to DB). */
export async function clearLeaderboard(quizId: number): Promise<void> {
  await getRedisConnection().del(scoresKey(quizId));
}
