// Shared, multi-instance TTL cache backed by Redis (Upstash in prod, local
// redis-server in dev). Drop-in replacement for the per-process `TTLCache`
// with the same `getOrCompute` / `get` / `set` / `invalidate` / `stats`
// surface — so callers (`/api/public/market-indicators`,
// `/api/dashboard/summary`) are migrated by swapping the constructor only.
//
// Why shared cache matters at 5,000+ concurrent users:
//   - With per-process TTLCache, every Fly machine warms its cache
//     independently — so 3 web instances + 10s TTL means up to 3 misses per
//     window instead of 1. Negligible at small scale, painful under load.
//   - Shared Redis cache means one instance pays the warmup cost and the
//     other two free-ride. Cache hit ratio approaches 1.0 once warm.
//
// Single-flight is still PER-INSTANCE (in-process Map) — at most 3 backend
// computes per cold key (one per machine) instead of N (one per request).
// Cross-instance single-flight would require a Redis distributed lock, which
// adds 2x round-trips on every miss. Not worth it for our TTL/load profile.
//
// Failure mode: any Redis error (connection refused, timeout, parse failure)
// is logged at warn level and treated as a cache miss — the request falls
// through to `compute()` and serves fresh data. Cache is best-effort, never
// a request-blocking dependency. This is what lets us deploy Redis without
// risking a hard outage if Upstash has a regional incident.
//
// Optional `fallback` constructor arg: pass a `TTLCache<T>` instance and
// the RedisCache will mirror writes to it. When Redis is unavailable, reads
// fall back to the in-memory copy so a transient Upstash blip still serves
// stale-but-working data instead of hammering Neon.

import type IORedis from "ioredis";
import { logger } from "../logger";
import { TTLCache } from "./ttl-cache";

const NAMESPACE_PREFIX = "qorix:cache:v1";

export type RedisCacheOptions<T> = {
  /**
   * Lazy redis getter — RedisCache will only resolve this on first cache
   * access, NEVER at construction time. This is the property that lets
   * route files instantiate RedisCache at module-load without opening a
   * Redis socket (HTTP-only test suites still pass with no Redis running).
   */
  getRedis: () => IORedis;
  /** Namespace segment in the Redis key (e.g. "market-indicators"). */
  namespace: string;
  /** TTL in milliseconds. Stored in Redis as ceil(ttlMs/1000) seconds. */
  ttlMs: number;
  /**
   * Optional in-process fallback. Reads + writes are mirrored here so a
   * Redis outage degrades to per-instance caching instead of no caching.
   * Pass a `new TTLCache<T>(ttlMs)` with the same TTL.
   */
  fallback?: TTLCache<T>;
};

export class RedisCache<T> {
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly ttlSeconds: number;
  private hits = 0;
  private misses = 0;
  private redisErrors = 0;

  constructor(private readonly opts: RedisCacheOptions<T>) {
    if (!Number.isFinite(opts.ttlMs) || opts.ttlMs <= 0) {
      throw new Error(`RedisCache requires a positive ttlMs, got ${opts.ttlMs}`);
    }
    this.ttlSeconds = Math.max(1, Math.ceil(opts.ttlMs / 1000));
  }

  private redisKey(key: string): string {
    return `${NAMESPACE_PREFIX}:${this.opts.namespace}:${key}`;
  }

  /** Read from Redis (with in-memory fallback). Returns undefined on miss / error. */
  async get(key: string): Promise<T | undefined> {
    try {
      const raw = await this.opts.getRedis().get(this.redisKey(key));
      if (raw === null) {
        // Redis miss — try the fallback before giving up. The fallback may
        // hold a value from before a Redis flush / failover.
        return this.opts.fallback?.get(key);
      }
      try {
        return JSON.parse(raw) as T;
      } catch (parseErr) {
        // Corrupt entry — drop it so the next caller computes fresh.
        logger.warn(
          { err: parseErr, namespace: this.opts.namespace, key },
          "RedisCache: failed to JSON.parse cached value, evicting",
        );
        await this.opts.getRedis().del(this.redisKey(key)).catch(() => undefined);
        return this.opts.fallback?.get(key);
      }
    } catch (err) {
      this.redisErrors++;
      logger.warn(
        { err, namespace: this.opts.namespace, key },
        "RedisCache: Redis GET failed, serving fallback",
      );
      return this.opts.fallback?.get(key);
    }
  }

  /** Write to Redis (with in-memory fallback mirror). Errors are swallowed. */
  async set(key: string, value: T): Promise<void> {
    // Mirror to fallback first so a Redis hiccup doesn't lose the value
    // for the local instance.
    this.opts.fallback?.set(key, value);
    let serialised: string;
    try {
      serialised = JSON.stringify(value);
    } catch (err) {
      logger.warn(
        { err, namespace: this.opts.namespace, key },
        "RedisCache: failed to serialise value, NOT cached",
      );
      return;
    }
    try {
      await this.opts.getRedis().set(this.redisKey(key), serialised, "EX", this.ttlSeconds);
    } catch (err) {
      this.redisErrors++;
      logger.warn(
        { err, namespace: this.opts.namespace, key },
        "RedisCache: Redis SET failed, value cached only in fallback",
      );
    }
  }

  /**
   * Single-flight cached compute — same contract as `TTLCache.getOrCompute`.
   * Returns `{ value, cached }` where `cached === true` means the value came
   * from the cache (Redis or fallback) or piggybacked on an in-flight peer.
   */
  async getOrCompute(
    key: string,
    compute: () => Promise<T>,
  ): Promise<{ value: T; cached: boolean }> {
    const fresh = await this.get(key);
    if (fresh !== undefined) {
      this.hits++;
      return { value: fresh, cached: true };
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      this.hits++;
      return { value: await existing, cached: true };
    }
    this.misses++;
    const promise = (async () => {
      try {
        const value = await compute();
        await this.set(key, value);
        return value;
      } finally {
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, promise);
    return { value: await promise, cached: false };
  }

  /** Drop a single key from both Redis and fallback. */
  async invalidate(key: string): Promise<void> {
    this.opts.fallback?.invalidate(key);
    try {
      await this.opts.getRedis().del(this.redisKey(key));
    } catch (err) {
      this.redisErrors++;
      logger.warn(
        { err, namespace: this.opts.namespace, key },
        "RedisCache: Redis DEL failed",
      );
    }
  }

  /** Drop everything in this namespace (Redis SCAN+DEL plus fallback clear). Mainly for tests / emergencies. */
  async clear(): Promise<void> {
    this.opts.fallback?.clear();
    this.inFlight.clear();
    this.hits = 0;
    this.misses = 0;
    this.redisErrors = 0;
    try {
      const redis = this.opts.getRedis();
      const pattern = `${NAMESPACE_PREFIX}:${this.opts.namespace}:*`;
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      logger.warn({ err, namespace: this.opts.namespace }, "RedisCache: clear failed");
    }
  }

  /** Per-instance observability counters. Hit ratio is a useful health signal. */
  stats(): { namespace: string; hits: number; misses: number; hitRate: number; redisErrors: number } {
    const total = this.hits + this.misses;
    return {
      namespace: this.opts.namespace,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : this.hits / total,
      redisErrors: this.redisErrors,
    };
  }
}
