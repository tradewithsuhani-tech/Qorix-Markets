// ─── Quiz event bus (in-process EventEmitter + Redis pub/sub bridge) ──────
//
// Architecture
// ────────────
// The api-server runs as N stateless Fly machines behind a proxy. SSE
// subscribers can land on ANY machine, but the quiz-runner that produces
// events for a given quiz only runs on ONE machine at a time (whoever the
// scheduler started). To make every subscriber see every event, we:
//
//   1. Always publish locally via the in-process EventEmitter so subscribers
//      on the SAME machine see events with zero round-trip latency.
//   2. Mirror every publish to a Redis pub/sub channel keyed per quiz. Other
//      machines hold a single subscriber connection that re-emits incoming
//      messages onto their LOCAL EventEmitter, so subscribers on those
//      machines receive them indistinguishably from local events.
//
// The Redis subscriber is shared (one `psubscribe` for `quiz:*` rather than
// one subscriber per quiz) so a server with thousands of concurrent SSE
// clients still only opens a single Redis subscriber connection.
//
// Why not WebSockets / Socket.IO? See task-102 architectural notes — SSE is
// adequate for one-way push, survives Fly's proxy with the right headers,
// and avoids a brand-new transport stack.
//
// Failure mode
// ────────────
// Redis hiccups never throw to callers. Publishes log + swallow; the
// subscriber side auto-reconnects via ioredis defaults. In the worst case
// other machines briefly lag behind the runner — recoverable via the SSE
// `event_id` deduplication the client already handles on reconnect.

import { EventEmitter } from "node:events";
import IORedis from "ioredis";
import { logger } from "./logger";

// ─── Event payload contract (mirrored on the SSE wire) ─────────────────────
export type QuizSseEvent =
  | { type: "quiz_status_changed"; quizId: number; status: "scheduled" | "live" | "ended" | "cancelled" }
  | {
      type: "question_started";
      quizId: number;
      questionId: number;
      position: number; // 0..4
      totalQuestions: number;
      prompt: string;
      options: string[]; // never includes the correct flag
      startedAt: string; // ISO — server-stamped, clients render countdown from this
      windowMs: number;
      deadlineAt: string; // ISO — startedAt + windowMs (+ small grace handled server-side)
    }
  | {
      type: "question_ended";
      quizId: number;
      questionId: number;
      position: number;
      correctIndex: number;
      explanation: string;
      stats: {
        totalAnswers: number;
        optionCounts: number[]; // length-4
      };
    }
  | {
      type: "leaderboard_update";
      quizId: number;
      // Top N rows with masked display names + score. Sized to fit in one SSE frame.
      top: Array<{ userId: number; displayName: string; score: number; rank: number }>;
      participantsCount: number;
    }
  | {
      type: "quiz_ended";
      quizId: number;
      winners: Array<{
        userId: number;
        displayName: string;
        score: number;
        rank: number;
        prizeAmount: string;
        prizeCurrency: string;
      }>;
    };

// Server-attached envelope. `id` is monotonic per quiz (set by the runner
// before publish) so clients can ignore duplicates after a reconnect.
export type QuizSseEnvelope = {
  id: number;
  ts: string;
  payload: QuizSseEvent;
};

const CHANNEL_PREFIX = "qz:event:v1:";
function channelFor(quizId: number): string {
  return `${CHANNEL_PREFIX}${quizId}`;
}

const localEmitter = new EventEmitter();
// Default 10-listener cap is fine for runner internals but our SSE handler
// adds one listener per connected client. 5,000 concurrent clients on a
// single machine is part of the design budget — bump well above that to
// avoid noisy warnings while still tripping on a real listener leak (e.g.
// 50,000 unintentional adds).
localEmitter.setMaxListeners(50_000);

// ─── Subscriber side: lazy single Redis connection used for psubscribe ────
let _subscriber: IORedis | null = null;
function getSubscriber(): IORedis {
  if (_subscriber) return _subscriber;
  const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  // ioredis pub/sub connections cannot be shared with normal command
  // connections (Redis enters subscribe mode on the socket). Build a
  // dedicated client here. maxRetriesPerRequest must be `null` for
  // long-lived subscribers per ioredis docs; subscribers don't issue
  // commands so the bounded-retry rationale used by the main client
  // doesn't apply.
  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 5_000,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    logger.warn({ err: (err as Error).message }, "[quiz-event-bus] subscriber error");
  });
  client.on("connect", () => {
    logger.info("[quiz-event-bus] subscriber connected");
  });
  client.psubscribe(`${CHANNEL_PREFIX}*`).catch((err) => {
    logger.error({ err: (err as Error).message }, "[quiz-event-bus] psubscribe failed");
  });
  client.on("pmessage", (_pattern, channel, message) => {
    try {
      const env = JSON.parse(message) as QuizSseEnvelope;
      // `quiz:` is parsed off the channel to scope the local event name.
      const quizId = Number(channel.slice(CHANNEL_PREFIX.length));
      if (!Number.isFinite(quizId)) return;
      localEmitter.emit(localEventName(quizId), env);
    } catch (err) {
      logger.warn({ err: (err as Error).message }, "[quiz-event-bus] bad pmessage");
    }
  });
  _subscriber = client;
  return client;
}

// ─── Publisher side ───────────────────────────────────────────────────────
// Use a SEPARATE small client for publishing. The main getRedisConnection()
// in lib/redis.ts has aggressive timeouts that match the request-path
// budget; for fan-out we tolerate slightly slower publishes in exchange
// for using the existing connection pool.
let _publisher: IORedis | null = null;
function getPublisher(): IORedis {
  if (_publisher) return _publisher;
  const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
  const client = new IORedis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 5_000,
    commandTimeout: 1_500,
  });
  client.on("error", (err) => {
    logger.warn({ err: (err as Error).message }, "[quiz-event-bus] publisher error");
  });
  _publisher = client;
  return client;
}

function localEventName(quizId: number): string {
  return `quiz:${quizId}`;
}

// Auto-incrementing id per quiz — used as the SSE `id:` line so clients can
// dedupe on reconnect. Lives only for the runner's lifetime which is a
// single ~1-minute quiz; rolling over is impossible in practice.
const idCounters = new Map<number, number>();

export function nextEventId(quizId: number): number {
  const next = (idCounters.get(quizId) ?? 0) + 1;
  idCounters.set(quizId, next);
  return next;
}

/**
 * Publish a quiz event. Fans out to:
 *   - LOCAL EventEmitter (synchronous, microsecond latency)
 *   - Redis pub/sub channel for cross-instance (best-effort, never throws)
 *
 * Callers must NOT include `id` / `ts` themselves — this function stamps
 * them so the wire format is consistent.
 */
export async function publishQuizEvent(quizId: number, payload: QuizSseEvent): Promise<void> {
  const env: QuizSseEnvelope = {
    id: nextEventId(quizId),
    ts: new Date().toISOString(),
    payload,
  };
  // Local fan-out first so subscribers on this machine never miss an event
  // because Redis is wedged.
  localEmitter.emit(localEventName(quizId), env);
  try {
    await getPublisher().publish(channelFor(quizId), JSON.stringify(env));
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, quizId, type: payload.type },
      "[quiz-event-bus] redis publish failed (local subscribers still notified)",
    );
  }
}

/**
 * Subscribe to events for a single quiz. Returns an unsubscribe function.
 * Lazily ensures the cross-instance subscriber is connected on first call.
 */
export function subscribeToQuiz(
  quizId: number,
  handler: (env: QuizSseEnvelope) => void,
): () => void {
  // Ensure the Redis pmessage listener is wired up. Idempotent.
  getSubscriber();
  const name = localEventName(quizId);
  localEmitter.on(name, handler);
  return () => {
    localEmitter.off(name, handler);
  };
}

/** Returns the current local subscriber count for a quiz — useful for tests / metrics. */
export function localSubscriberCount(quizId: number): number {
  return localEmitter.listenerCount(localEventName(quizId));
}
