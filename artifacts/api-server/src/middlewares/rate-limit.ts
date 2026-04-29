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
// Failure mode (explicit, not library-default):
//   By DEFAULT we set `passOnStoreError: true` on every limiter so a Redis
//   outage degrades to "no rate limiting for this request" rather than
//   "503 the whole sign-in flow". For login this is the right tradeoff:
//   we'd rather take a transient brute-force window than block the whole
//   auth flow during an Upstash incident. The bcrypt cost on /auth/login
//   (10 rounds, ~70ms) caps the practical brute-force throughput anyway.
//
//   Endpoints that send EXPENSIVE side-effects (OTP emails / SMS) where
//   "no rate limit" effectively means "free inbox-bomb" can opt OUT of the
//   default by passing `passOnStoreError: false`. In that mode a Redis
//   outage causes the request to fail (Express error middleware → 5xx)
//   rather than silently ungating the side-effect. Currently used by the
//   withdrawal-OTP limiter (see auth.ts).
//
//   Combined with the bounded `commandTimeout` on the shared ioredis client
//   (see lib/redis.ts), a Redis hang surfaces as a fast store error within
//   ~1.5s and the request is served (or, in fail-closed mode, errored)
//   — instead of parking on Redis until the 30s app-level timeout fires.

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
  /**
   * Override the default `passOnStoreError: true`. Set to `false` to make
   * this limiter fail-CLOSED on Redis errors (request errors out instead
   * of being silently allowed through). Use only for endpoints whose
   * side-effect is too expensive to leave ungated during a Redis incident
   * — currently the withdrawal-OTP send. See file header for rationale.
   */
  passOnStoreError?: boolean;
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
    // Explicit availability guarantee — see header comment on this file.
    // If the Redis store throws (timeout, connection refused, AUTH failure),
    // we let the request through instead of returning 503. This is the
    // intentional tradeoff: a Redis outage briefly disables rate limiting
    // for affected windows rather than taking down auth/API endpoints.
    //
    // Endpoints that send expensive side-effects (e.g. OTP emails) override
    // this to `false` to fail-CLOSED instead — see file header.
    passOnStoreError: opts.passOnStoreError ?? true,
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
//
// LOADTEST_TOKEN bypass:
//   When LOADTEST_TOKEN is set as a Fly secret AND the request carries a
//   matching `x-loadtest-token` header, the GLOBAL limiter is skipped so a
//   single-source-IP k6 run can drive 5 000 VUs without tripping the per-IP
//   cap. Per-route limiters (login, 2fa, forgot, etc.) explicitly do NOT
//   honor this — we want the load test to confirm those still fire under
//   load. The token is unset immediately after the test window. See
//   `tools/load-test/README.md` for the run procedure.
export const globalApiLimiter = makeRedisLimiter({
  name: "global-ip",
  windowMs: 60_000,
  limit: 600,
  message: { error: "Too many requests, slow down.", code: "rate_limited" },
  skip: (req) => {
    if (req.path === "/healthz" || req.path === "/api/healthz") return true;
    const expected = process.env.LOADTEST_TOKEN;
    if (expected && expected.length >= 16) {
      const header = req.header("x-loadtest-token");
      if (header && header === expected) return true;
    }
    return false;
  },
});
