import IORedis from "ioredis";
import { logger } from "./logger";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on("connect", () => {
  logger.info({ url: REDIS_URL.replace(/:[^:@]+@/, ":***@") }, "Redis: connected");
});

redisConnection.on("error", (err) => {
  logger.error({ err }, "Redis: connection error");
});
