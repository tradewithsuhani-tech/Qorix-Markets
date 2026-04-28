// ─────────────────────────────────────────────────────────────────────────────
// Qorix Markets — Phase 5 ramp load test
//
// Stages:        0 → 1k → 3k → 5k VUs over 10 min
// Mix:           ~70% reads (cached/uncached), ~30% writes (login attempts)
// Pass criteria: p95 < 300ms on cached reads,
//                error_rate < 1% on healthz + market-indicators
//
// Usage:
//   BASE_URL=https://qorix-api.fly.dev \
//   SMOKE_EMAIL=loadtest@qorixmarkets.com \
//   SMOKE_PASSWORD='REDACTED' \
//   LOADTEST_TOKEN='shared-with-server' \
//   k6 run tools/load-test/k6-ramp.js
//
// Source-IP note:
//   The server's globalApiLimiter caps each IP at 600 req/min. Running this
//   from one laptop (~5000 VUs all sharing one egress IP) will trip the
//   limiter long before stage 3. Two ways to make a real 5k test work:
//     (a) Run from k6 cloud (distributed source IPs), OR
//     (b) Have the server skip the global limiter when it sees
//         X-Loadtest-Token === process.env.LOADTEST_TOKEN — toggled on for
//         the test window only, removed immediately after.
//   Per-route limiters (login, 2fa, etc.) are NOT bypassed by the token —
//   we WANT the 429s on /auth/login to verify the limiter still works under
//   load. See tools/load-test/README.md for the bypass procedure.
// ─────────────────────────────────────────────────────────────────────────────

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend, Counter } from "k6/metrics";
import { randomString } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://qorix-api.fly.dev";
const SMOKE_EMAIL = __ENV.SMOKE_EMAIL || "";
const SMOKE_PASSWORD = __ENV.SMOKE_PASSWORD || "";
const LOADTEST_TOKEN = __ENV.LOADTEST_TOKEN || "";

// ── Custom metrics ──────────────────────────────────────────────────────────
const cacheHitRatio = new Rate("cache_hit_ratio");           // 1=HIT, 0=MISS
const errorRate = new Rate("errors");                         // 1=err, 0=ok
const latencyMarketInd = new Trend("lat_market_indicators");
const latencySystemStatus = new Trend("lat_system_status");
const latencyDashSummary = new Trend("lat_dashboard_summary");
const latencyHealthz = new Trend("lat_healthz");
const loginRateLimited = new Counter("login_429_count");

// ── Test profile ────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 1000 }, // ramp 0 → 1k
        { duration: "1m", target: 1000 }, // hold 1k
        { duration: "3m", target: 3000 }, // ramp 1k → 3k
        { duration: "1m", target: 3000 }, // hold 3k
        { duration: "2m", target: 5000 }, // ramp 3k → 5k
        { duration: "1m", target: 5000 }, // hold 5k
        { duration: "30s", target: 0 },    // soft drain
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Hard-fail thresholds — abort the test if breached
    "lat_market_indicators": ["p(95)<300", "p(99)<800"],
    "lat_dashboard_summary": ["p(95)<500", "p(99)<1500"],
    "lat_healthz":           ["p(95)<150"],
    "errors":                ["rate<0.01"],
    "cache_hit_ratio":       ["rate>0.85"], // expect >85% HITs once warm
    "http_req_failed":       ["rate<0.02"],
  },
  noConnectionReuse: false,
  userAgent: "k6-loadtest/qorix-phase5",
};

// ── Setup: log in once with the smoke account, hand JWT to every VU ─────────
export function setup() {
  if (!SMOKE_EMAIL || !SMOKE_PASSWORD) {
    console.warn(
      "SMOKE_EMAIL/SMOKE_PASSWORD not set — authenticated requests will be skipped",
    );
    return { token: null };
  }
  const r = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: SMOKE_EMAIL, password: SMOKE_PASSWORD }),
    {
      headers: {
        "content-type": "application/json",
        ...(LOADTEST_TOKEN ? { "x-loadtest-token": LOADTEST_TOKEN } : {}),
      },
    },
  );
  if (r.status !== 200) {
    throw new Error(`setup login failed: ${r.status} ${r.body}`);
  }
  const body = r.json();
  if (!body.token) {
    throw new Error(`setup login: no token in response: ${r.body}`);
  }
  console.log(`setup ok — JWT acquired (len=${body.token.length})`);
  return { token: body.token };
}

// ── Per-VU iteration ────────────────────────────────────────────────────────
export default function (data) {
  const headers = {
    "content-type": "application/json",
    ...(LOADTEST_TOKEN ? { "x-loadtest-token": LOADTEST_TOKEN } : {}),
  };

  // Weighted endpoint pick:
  //   45% market-indicators   (cached, public)
  //   20% system/status       (uncached, public)
  //   25% dashboard/summary   (cached per-user, auth)
  //   05% healthz             (zero-dep, public)
  //   05% bad-cred login      (exercises loginRateLimit)
  const r = Math.random();

  if (r < 0.45) {
    group("GET /api/public/market-indicators", () => {
      const res = http.get(`${BASE_URL}/api/public/market-indicators`, { headers });
      latencyMarketInd.add(res.timings.duration);
      const ok = check(res, { "200": (r) => r.status === 200 });
      errorRate.add(!ok);
      const xCache = res.headers["X-Cache"] || res.headers["x-cache"];
      if (xCache) cacheHitRatio.add(xCache === "HIT" ? 1 : 0);
    });
  } else if (r < 0.65) {
    group("GET /api/system/status", () => {
      const res = http.get(`${BASE_URL}/api/system/status`, { headers });
      latencySystemStatus.add(res.timings.duration);
      const ok = check(res, { "200": (r) => r.status === 200 });
      errorRate.add(!ok);
    });
  } else if (r < 0.90) {
    if (!data.token) {
      // No JWT in setup — fall through to a public read instead
      const res = http.get(`${BASE_URL}/api/public/market-indicators`, { headers });
      latencyMarketInd.add(res.timings.duration);
      errorRate.add(res.status !== 200);
      return;
    }
    group("GET /api/dashboard/summary", () => {
      const res = http.get(`${BASE_URL}/api/dashboard/summary`, {
        headers: { ...headers, authorization: `Bearer ${data.token}` },
      });
      latencyDashSummary.add(res.timings.duration);
      const ok = check(res, { "200": (r) => r.status === 200 });
      errorRate.add(!ok);
      const xCache = res.headers["X-Cache"] || res.headers["x-cache"];
      if (xCache) cacheHitRatio.add(xCache === "HIT" ? 1 : 0);
    });
  } else if (r < 0.95) {
    group("GET /api/healthz", () => {
      const res = http.get(`${BASE_URL}/api/healthz`, { headers });
      latencyHealthz.add(res.timings.duration);
      const ok = check(res, { "200": (r) => r.status === 200 });
      errorRate.add(!ok);
    });
  } else {
    group("POST /api/auth/login (bad creds)", () => {
      const res = http.post(
        `${BASE_URL}/api/auth/login`,
        JSON.stringify({
          email: `noone-${randomString(8)}@example.invalid`,
          password: "wrongwrong",
        }),
        { headers },
      );
      // Expect 401 (bad creds) initially → 429 (rate-limited) once limiter trips.
      // Both are EXPECTED outcomes; treat 5xx as the only real error.
      if (res.status === 429) loginRateLimited.add(1);
      const ok = check(res, { "401 or 429": (r) => r.status === 401 || r.status === 429 });
      errorRate.add(!ok);
    });
  }

  sleep(Math.random() * 0.5 + 0.5); // 0.5-1.0s think time
}

// ── Teardown: surface a final summary line for easy log-grep ────────────────
export function teardown(data) {
  console.log("teardown ok");
}
