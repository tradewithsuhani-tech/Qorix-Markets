// Redis-backed rate-limit middleware factory.
//
// Why Redis-backed:
//   With multiple Fly app instances (2× BOM + 1× SIN under Phase 5 scale),
//   express-rate-limit's default in-memory store would let an attacker get
//   `limit × N_instances` tries by round-robining through machines. A
//   shared Redis store collapses that back to the intended `limit` per IP
//   per window, regardless of which machine the request lands on.
//
// Why a factory (not a singleton middleware):
//   Each protected endpoint needs its own (windowMs, limit, prefix). Sharing
//   a single bucket across login + 2FA-mgmt + forgot-password would create
//   bizarre cross-talk where an attacker burning the password-reset budget
//   would simultaneously lock out their own login retries.
//
// Lazy Redis connection:
//   The store calls `getRedisConnection()` per command, NOT at module load.
//   This is what lets test suites import routes that mount these limiters
//   without opening a Redis socket — the existing test pattern that the
//   `getRedisConnection()` thunk was designed for.
//
// Failure mode:
//   express-rate-limit catches store errors and (by default) skips counting
//   for that request — meaning a Redis outage degrades to "no rate limiting"
//   rather than "all requests blocked". For login this is the right tradeoff:
//   we'd rather take a transient brute-force window than 503 the whole
//   sign-in flow during an Upstash incident. The bcrypt cost on /auth/login
//   (10 rounds, ~70ms) caps the practical brute-force throughput anyway.

import rateLimit, { type Options as RateLimitOptions } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { getRedisConnection } from "../lib/redis";

const PREFIX_NAMESPACE = "qorix:ratelimit:";

export type MakeRedisLimiterOptions = {
  /**
   * Stable identifier for this limiter — becomes the Redis key prefix
   * (`qorix:ratelimit:<name>:`). MUST be unique per limiter instance.
   */
  name: string;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests per (key, window). `key` is req.ip by default. */
  limit: number;
  /** Optional custom 429 body. Default: `{ error: "Too many requests" }`. */
  message?: RateLimitOptions["message"];
  /** Skip counting requests that responded 5xx. Default false. */
  skipFailedRequests?: boolean;
  /** Skip counting requests that responded 2xx/3xx (e.g. count only failed login attempts). Default false. */
  skipSuccessfulRequests?: boolean;
  /** Optional custom key (e.g. user id for authed endpoints). Defaults to req.ip. */
  keyGenerator?: RateLimitOptions["keyGenerator"];
  /** Optional skip predicate (e.g. always allow /healthz probes). */
  skip?: RateLimitOptions["skip"];
};

export function makeRedisLimiter(opts: MakeRedisLimiterOptions) {
  const store = new RedisStore({
    // Per-request thunk into the cached IORedis singleton — no socket
    // is opened at construction time. Required signature: sendCommand
    // returns whatever the underlying redis call returns.
    sendCommand: (...args: string[]) =>
      getRedisConnection().call(args[0]!, ...args.slice(1)) as Promise<
        // rate-limit-redis expects this generic shape; ioredis returns
        // `unknown` from .call(). Cast at the boundary instead of leaking
        // the union into every caller.
        ReturnType<RedisStore["sendCommand"]> extends Promise<infer R>
          ? R
          : never
      >,
    prefix: `${PREFIX_NAMESPACE}${opts.name}:`,
  });

  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: true,
    legacyHeaders: false,
    store,
    ...(opts.message !== undefined ? { message: opts.message } : {}),
    ...(opts.skipFailedRequests !== undefined
      ? { skipFailedRequests: opts.skipFailedRequests }
      : {}),
    ...(opts.skipSuccessfulRequests !== undefined
      ? { skipSuccessfulRequests: opts.skipSuccessfulRequests }
      : {}),
    ...(opts.keyGenerator !== undefined ? { keyGenerator: opts.keyGenerator } : {}),
    ...(opts.skip !== undefined ? { skip: opts.skip } : {}),
  });
}

// ─── Global per-IP backstop for /api/* ─────────────────────────────────────
// A blanket per-IP cap so a single attacker can't DoS the entire fleet with
// cheap unauthenticated GETs. Applied in app.ts before the router. Sized
// generously: a real user polling 4–5 endpoints every 5 seconds tops out at
// ~1 req/sec; 600/min (10/sec) is 10× headroom for legit usage but caps
// abuse at one machine's worth of work.
//
// Healthz is exempted explicitly — the Fly load balancer probes it every
// 15s from a small set of internal IPs, and a 429 there would deregister
// otherwise-healthy instances.
export const globalApiLimiter = makeRedisLimiter({
  name: "global-ip",
  windowMs: 60_000,
  limit: 600,
  message: { error: "Too many requests, slow down.", code: "rate_limited" },
  skip: (req) => req.path === "/healthz" || req.path === "/api/healthz",
});
