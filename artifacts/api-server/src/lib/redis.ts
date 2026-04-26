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
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
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
