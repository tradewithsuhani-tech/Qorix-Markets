import IORedis from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let connection: IORedis | null = null;

/**
 * Lazy IORedis factory. The client is constructed on first call instead of at
 * module import time, so any module that merely imports this file (or anything
 * transitively pulling in routes/queues/workers) does NOT open a Redis socket.
 *
 * Test suites that boot the Express app to assert HTTP-level behaviour can
 * therefore stay green without a running Redis — and without registering
 * process-level error handlers that would also swallow real bugs.
 */
export function getRedisConnection(): IORedis {
  if (connection) return connection;
  const client = new IORedis(REDIS_URL, {
    // Bounded retries — was `null` (infinite). With infinite retries plus no
    // command timeout, an Upstash incident would queue commands indefinitely
    // and starve every /api/* request to the 30s app-level timeout, turning a
    // Redis blip into a full outage. One retry is enough for a transient
    // single-packet loss; anything worse should fail fast and let callers
    // either pass-through (rate-limit `passOnStoreError`) or recompute
    // (RedisCache best-effort).
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    // Fail fast on connect — 5s is well above any normal Upstash latency
    // (<50 ms p99 from BOM/SIN) but tight enough that a wedged TCP handshake
    // doesn't park a request.
    connectTimeout: 5_000,
    // Hard cap on per-command latency. Upstash Singapore p99 is ~50 ms intra-
    // region; 1500 ms is 30× headroom for legit traffic but bounds the worst
    // case to a fraction of the request budget. Cache and limiter both
    // tolerate this throwing — see RedisCache.get() and
    // makeRedisLimiter()'s `passOnStoreError: true`.
    commandTimeout: 1_500,
    // We deliberately leave `enableOfflineQueue` at the ioredis default
    // (true). rate-limit-redis loads its increment Lua script in the
    // RedisStore constructor (synchronous, at module-import time), which
    // happens before the socket emits "ready" — turning the offline queue
    // off here would crash app startup with
    // "Stream isn't writeable and enableOfflineQueue options is false".
    //
    // The combination of `maxRetriesPerRequest: 1` + `commandTimeout` is
    // what bounds the disaster scenario instead: ioredis flushes the entire
    // pending queue with a `MaxRetriesPerRequestError` after a single retry
    // attempt fails, so commands cannot pile up indefinitely during an
    // Upstash outage. Cache/limiter callers see a fast error and degrade
    // gracefully (best-effort miss / pass-through).
  });
  client.on("connect", () => {
    logger.info({ url: REDIS_URL.replace(/:[^:@]+@/, ":***@") }, "Redis: connected");
  });
  client.on("error", (err) => {
    logger.error({ err }, "Redis: connection error");
  });
  connection = client;
  return client;
}

// Dedicated IORedis factory for BullMQ Workers. BullMQ refuses to start a
// Worker unless `maxRetriesPerRequest` is `null` because workers use blocking
// commands (BRPOPLPUSH) that must not error out mid-wait — see BullMQ source
// `RedisConnection.checkBlockingOptions`. The shared `getRedisConnection()`
// keeps `maxRetriesPerRequest: 1` for app traffic (Upstash incident
// protection), so workers need their own connection with the BullMQ-required
// settings. Returns a fresh IORedis per call: each Worker should own its
// own socket so a long BLPOP on one doesn't serialize the others, and so
// `worker.close()` can shut its connection down without affecting peers.
export function newBullMQConnection(): IORedis {
  return new IORedis(REDIS_URL, {
    // BullMQ requirement — null disables per-request retry cap because
    // blocking commands have no natural deadline.
    maxRetriesPerRequest: null,
    // Match the shared client: BullMQ doesn't need the ioredis ready handshake.
    enableReadyCheck: false,
    // Same fail-fast connect timeout as the shared client — Upstash from
    // BOM/SIN is sub-50ms so 5s is generous.
    connectTimeout: 5_000,
    // No commandTimeout: BullMQ blocking pulls are designed to wait until a
    // job arrives, and a low timeout would just churn the worker loop.
  });
}
