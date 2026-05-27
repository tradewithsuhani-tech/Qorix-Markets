/**
 * B8.1 (Task #3) — Cross-instance session revocation via Redis Pub/Sub
 *
 * Problem: the per-device revokedDeviceCache in auth.ts is in-process only
 * (TTLCache, 30s TTL). On Fly.io with two web replicas, a revocation written
 * on machine A only immediately evicts machine A's cache; machine B keeps
 * serving the revoked device for up to 30s.
 *
 * Solution: after every DB revocation, publish a lightweight JSON message to
 * the `qorix:revoke:device` Redis channel. Every running instance subscribes
 * to that channel and immediately evicts the matching cache entry, reducing
 * cross-instance propagation from ≤30s to ≤network round-trip (~5ms intra-
 * region Upstash).
 *
 * Fail-open by design: if Redis publish fails, the existing 30s TTL window
 * still applies — legitimate users are never blocked by a Redis blip.
 *
 * Pattern: modelled after `lib/p2p-realtime.ts` (same pub/sub wiring).
 */
import IORedis from "ioredis";
import { logger } from "./logger";
import {
  invalidateRevokedDeviceCache,
  invalidateAllRevokedDeviceCaches,
} from "../middlewares/auth";

const CHANNEL = "qorix:revoke:device";

type RevokeMessage =
  | { type: "one"; userId: number; fp: string }
  | { type: "all" };

// ─── Connections ─────────────────────────────────────────────────────────────

let publisher: IORedis | null = null;
let subscriber: IORedis | null = null;
let subscriberInitPromise: Promise<void> | null = null;
let subscribed = false;

function newConnection(role: "pub" | "sub"): IORedis {
  // Pub/Sub demands a dedicated TCP socket: once a client subscribes it can no
  // longer issue regular commands. Subscriber uses `maxRetriesPerRequest: null`
  // so it never errors out waiting for messages; publisher uses the tight 1-retry
  // budget from the shared connection so a Redis blip fails fast (fire-and-forget).
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  const c = new IORedis(url, {
    maxRetriesPerRequest: role === "sub" ? null : 1,
    enableReadyCheck: false,
    connectTimeout: 10_000,
    retryStrategy: (times) => Math.min(times * 250, 5_000),
  });
  c.on("error", (err) =>
    logger.error({ err, role }, "[revoke-pubsub] redis error"),
  );
  return c;
}

function getPublisher(): IORedis {
  if (!publisher) publisher = newConnection("pub");
  return publisher;
}

// ─── Subscriber ──────────────────────────────────────────────────────────────

/**
 * Start the cross-instance revocation subscriber. Should be called once at
 * server startup (index.ts). Returns a `stop()` function for graceful shutdown.
 *
 * Fail-open: errors during init are logged but do not crash the process — the
 * 30s in-process TTL fallback continues to work.
 */
export async function startRevokeSubscriber(): Promise<{ stop: () => void }> {
  // Single-flight: multiple callers (e.g. tests) share one init promise.
  if (!subscriberInitPromise) {
    subscriberInitPromise = (async () => {
      try {
        subscriber = newConnection("sub");
        await subscriber.subscribe(CHANNEL);
        subscriber.on("message", (_chan, raw) => {
          let msg: RevokeMessage;
          try {
            msg = JSON.parse(raw);
          } catch {
            return; // malformed — ignore
          }
          if (msg.type === "one") {
            if (typeof msg.userId === "number" && typeof msg.fp === "string") {
              invalidateRevokedDeviceCache(msg.userId, msg.fp);
            }
          } else if (msg.type === "all") {
            invalidateAllRevokedDeviceCaches();
          }
        });
        subscribed = true;
        logger.info("[revoke-pubsub] subscribed to redis channel");
      } catch (err) {
        // Reset so a later restart_workflow call can retry init.
        subscriberInitPromise = null;
        logger.error({ err }, "[revoke-pubsub] subscriber init failed — 30s TTL fallback active");
        throw err;
      }
    })();
  }

  try {
    await subscriberInitPromise;
  } catch {
    // Swallow — already logged; fail-open
  }

  return {
    stop(): void {
      subscriber?.disconnect();
      publisher?.disconnect();
      subscriber = null;
      publisher = null;
      subscribed = false;
      subscriberInitPromise = null;
    },
  };
}

// ─── Publishers ──────────────────────────────────────────────────────────────

/**
 * Publish a single-device revocation to all instances.
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishRevokeDevice(userId: number, fp: string): void {
  if (!subscribed) return; // subscriber not started — skip (dev without Redis)
  const msg: RevokeMessage = { type: "one", userId, fp };
  getPublisher()
    .publish(CHANNEL, JSON.stringify(msg))
    .catch((err) => logger.error({ err, userId }, "[revoke-pubsub] publish failed"));
}

/**
 * Publish a revoke-all event to all instances (DELETE /sessions/others).
 * Fire-and-forget: errors are logged, not thrown.
 */
export function publishRevokeAll(): void {
  if (!subscribed) return;
  const msg: RevokeMessage = { type: "all" };
  getPublisher()
    .publish(CHANNEL, JSON.stringify(msg))
    .catch((err) => logger.error({ err }, "[revoke-pubsub] publish-all failed"));
}
