// Shared teardown helpers for tests that boot the Express app.
//
// Filename intentionally lacks the `.test.ts` suffix so the suite glob
// (`src/lib/__tests__/*.test.ts` in package.json) does NOT pick it up as a
// test file. This module is test-side only; production code never imports
// it and its presence has zero runtime effect on the API server.
//
// Background
// ----------
// Phase 6 added two Redis-backed components to the request path that every
// HTTP-booting test now exercises transitively:
//   1. globalApiLimiter (rate-limit middleware) — opens the shared ioredis
//      singleton on the first /api/* hit, even unauthenticated.
//   2. authMiddleware's per-userId auth-user RedisCache — same singleton,
//      hit on every Bearer-token request.
//
// The ioredis client keeps a live socket plus a background reconnect timer
// alive on the event loop, so the test process never exits unless the
// client is explicitly torn down. Combined with HTTP keep-alive sockets
// (which `server.close()` does NOT terminate — it only stops accepting
// NEW connections), every HTTP-booting test was hanging in teardown until
// node:test fired its "Promise resolution is still pending but the event
// loop has already resolved" timeout.
//
// These two helpers fix both leaks with the minimum possible surface area
// and no production-code changes.

import type { Server } from "node:http";
import { getRedisConnection } from "../redis";

/**
 * Stop the HTTP server cleanly: refuse new connections AND hard-shut any
 * keep-alive sockets that were left open by `fetch()` calls in the tests.
 *
 * Why both calls are needed:
 *   `server.close(cb)` waits for ACTIVE requests to drain but only stops
 *   accepting NEW connections — keep-alive sockets that finished their last
 *   response stay parked until the server's idle timeout (~5 s default by
 *   Node), which is enough to keep the event loop alive past the suite's
 *   completion. `server.closeAllConnections()` (Node 18.2+) destroys those
 *   parked sockets immediately so the process can exit promptly.
 *
 * Why the ordering matters:
 *   `closeAllConnections()` MUST be called immediately after `close()` is
 *   initiated (i.e. on the same tick, before awaiting close's callback).
 *   If you await close() to completion first, you've already paid the idle
 *   timeout penalty waiting for those keep-alive sockets to drain — the
 *   subsequent closeAllConnections() then has nothing to do. By dispatching
 *   close() and immediately calling closeAllConnections(), the parked
 *   sockets are torn down first, which lets close's callback fire promptly.
 */
export async function teardownHttpServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}

/**
 * Tear down the singleton ioredis client opened by `getRedisConnection()`.
 *
 * The function is safe to call unconditionally: if no test ever touched
 * Redis (e.g. a smoke that 401s before reaching the rate limiter and the
 * auth cache), getRedisConnection() will construct a fresh client which
 * we immediately quit/disconnect — wasteful but harmless.
 *
 * `quit()` is the graceful path; it issues QUIT to Redis and waits for the
 * server to close the socket. In CI / local dev where Redis isn't running,
 * the client will still be in `connecting` state and quit() rejects with
 * `Connection is closed.` — we fall through to `disconnect()`, which is
 * the synchronous "rip the socket out, cancel reconnect timers" path.
 *
 * Catches every error path: teardown must never mask a real assertion
 * failure or block the subsequent `pool.end()` from running.
 */
export async function teardownRedis(): Promise<void> {
  try {
    const redis = getRedisConnection();
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  } catch {
    // Swallow — see docstring.
  }
}
