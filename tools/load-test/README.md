# Qorix Markets — Phase 5 load test

`k6-ramp.js` is a 10-minute ramp test that takes `qorix-api.fly.dev` from
0 → 1 000 → 3 000 → 5 000 concurrent virtual users while measuring p95/p99
latency, cache hit ratio, and the `/auth/login` rate limiter.

## Pre-requisites

1. **k6 installed locally** (or run from k6 cloud):
   - macOS: `brew install k6`
   - Linux: https://grafana.com/docs/k6/latest/set-up/install-k6/
   - Docker: `docker run -i --rm grafana/k6 run -`

2. **A dedicated load-test account on prod** (NOT your real admin account):
   - Email: `loadtest@qorixmarkets.com`
   - Set this once via the normal sign-up flow, then verify the email.
   - Mark `is_load_test = true` in the DB so the worker skips fraud-checks
     for it (optional but nice).
   - Save the email + password where you can paste them into env vars.

3. **A 3-instance Fly app tier** (T508):
   ```
   flyctl scale count app=3 --region bom=2 --region sin=1 -a qorix-api
   flyctl status -a qorix-api      # confirm 3 app + 1 worker, all started
   curl -sI https://qorix-api.fly.dev/api/healthz   # 200
   ```

## Two test modes

### Mode A — Smoke (single laptop, ~600 RPS ceiling)

Quick sanity-check that the cache/limiter wiring is correct end-to-end.
Will trip the global IP limiter once you push past ~600 req/min, so don't
expect to actually reach 5 000 VUs.

```bash
BASE_URL=https://qorix-api.fly.dev \
SMOKE_EMAIL=loadtest@qorixmarkets.com \
SMOKE_PASSWORD='paste-from-vault' \
k6 run tools/load-test/k6-ramp.js
```

What you should see:
- First 30s: `cache_hit_ratio` climbs from ~0 to >0.9 as Redis warms.
- ~600 req/min in: `errors` rate climbs (429s from globalApiLimiter).
- `login_429_count` increments after the first 20 bad-cred attempts.

### Mode B — Real 5 000 VU run (with bypass token)

To actually push 5 000 VUs from one source IP, the server has to skip the
global IP limiter for the load-test client. The per-route limiters
(`/auth/login`, `/auth/forgot`, etc.) stay on.

1. **Generate a token** (any random 32+ char string):
   ```bash
   LOADTEST_TOKEN=$(openssl rand -hex 32)
   echo $LOADTEST_TOKEN   # save for step 4
   ```

2. **Set it on Fly** so the server-side bypass check matches:
   ```bash
   flyctl secrets set LOADTEST_TOKEN=$LOADTEST_TOKEN -a qorix-api
   ```
   (This triggers a rolling restart — wait ~30s for `flyctl status` to be
   green again.)

3. **Run the test** (this is the actual 5 000-VU pass):
   ```bash
   BASE_URL=https://qorix-api.fly.dev \
   SMOKE_EMAIL=loadtest@qorixmarkets.com \
   SMOKE_PASSWORD='paste-from-vault' \
   LOADTEST_TOKEN=$LOADTEST_TOKEN \
   k6 run tools/load-test/k6-ramp.js
   ```

4. **Tear down the bypass IMMEDIATELY after**:
   ```bash
   flyctl secrets unset LOADTEST_TOKEN -a qorix-api
   flyctl status -a qorix-api    # wait for green
   ```
   The bypass is gone — anyone sending `X-Loadtest-Token: ...` after this
   point hits the same limits as everybody else.

## What to capture & report (T510)

Paste these into `replit.md` § Phase 5 findings:

| Metric                           | Source                                  | Pass     |
| -------------------------------- | --------------------------------------- | -------- |
| p95 `lat_market_indicators`      | k6 summary                              | < 300ms  |
| p99 `lat_market_indicators`      | k6 summary                              | < 800ms  |
| p95 `lat_dashboard_summary`      | k6 summary                              | < 500ms  |
| `cache_hit_ratio`                | k6 summary                              | > 0.85   |
| `errors` rate                    | k6 summary                              | < 1%     |
| Neon DB CPU peak                 | Neon dashboard, BOM project             | < 80%    |
| Neon DB connections peak         | Neon dashboard                          | < 90 (pool max) |
| Fly app machine CPU peak         | `flyctl machine status <id> -a qorix-api` per machine | < 85%   |
| Fly app machine memory peak      | same                                    | < 80%   |
| Upstash Redis ops/sec peak       | Upstash console                         | observe |
| Upstash Redis latency p95        | Upstash console                         | < 5ms   |
| Worker process CPU during test   | `flyctl machine status <worker-id>`     | unaffected |

If p95 `lat_dashboard_summary` is high but `cache_hit_ratio` is also high,
the bottleneck is probably the cold-key DB query — investigate slow query
log, add an index, or pre-warm cache on login.

If the 1 SIN web instance shows much lower latency than the 2 BOM
instances when measured from a SIN-region client (use a Singapore VPN or
a Fly machine in `sin`), that's the expected payoff. Note it in the
findings as the case for keeping a SIN web instance.

## Server-side bypass (referenced from Mode B)

The bypass is implemented inside the `globalApiLimiter` factory at
`artifacts/api-server/src/middlewares/rate-limit.ts` — see the `skip:`
function. It compares the request header `x-loadtest-token` against
`process.env.LOADTEST_TOKEN`; if either is empty or they don't match,
the request is rate-limited normally.

Per-route limiters (`loginRateLimit`, `changePasswordLimiter`,
`forgotLimiter`, `twoFactorMgmtLimit`) intentionally do NOT honor the
bypass — we want the load test to confirm they fire.
