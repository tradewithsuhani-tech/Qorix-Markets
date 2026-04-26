# Fly.io Rollback Runbook

Use this when a deploy to `qorix-api` and/or `qorix-markets-web` has clearly
broken production and you need to get back to a known-good state **fast**.
Companion to `FLY_GO_LIVE_CHECKLIST.md`. Target time to green: **5 minutes**.

Apps: `qorix-api` (artifacts/api-server) and `qorix-markets-web` (artifacts/qorix-markets).
Region: `bom`. You need `flyctl` logged in (`fly auth whoami`).

---

## 1. Confirm it's actually a bad deploy

Don't roll back on a hunch — confirm at least one of these first.

```bash
# Healthchecks (both should be 200; api should return {"status":"ok"})
curl -i https://api.qorixmarkets.com/api/healthz
curl -i https://qorixmarkets.com/healthz

# Live logs — look for crash loops, unhandled rejections, DB connect errors
fly logs --app qorix-api
fly logs --app qorix-markets-web

# Machine state — anything other than "started" + passing checks is a smell
fly status --app qorix-api
fly status --app qorix-markets-web

# Error-rate spike — count non-2xx responses in the last few minutes of logs.
# A sustained 5xx rate above the baseline (~0) is a rollback signal even if
# /healthz still answers 200.
fly logs --app qorix-api --no-tail | tail -n 2000 \
  | grep -E '"status":(5[0-9]{2}|4[0-9]{2})' | wc -l
```

If the GitHub Actions "Smoke test" step on the latest deploy went red, or
the 5xx count above is climbing instead of flat, that alone is enough to
roll back.

## 2. Roll back to the previous release

`flyctl releases` lists every deploy; `rollback` re-points traffic at a prior
image **without rebuilding**, so it's the fastest way back.

**Picking the rollback target:** scan `fly releases` from newest to oldest
and pick the most recent release that (a) shows `STATUS = succeeded`,
(b) had a green Actions "Smoke test" step at deploy time, and (c) had no
sustained 5xx spike in the ~10 minutes after it went live (re-run the
`grep '"status":5..' | wc -l` check from Step 1 against an older window
if you're unsure). Don't just grab `current - 1` blindly — if the last
two deploys were both bad, you need to skip both.

```bash
# API
fly releases --app qorix-api                       # find last v## that was healthy
fly releases rollback <vNN> --app qorix-api        # e.g. fly releases rollback v42 --app qorix-api

# Web
fly releases --app qorix-markets-web
fly releases rollback <vNN> --app qorix-markets-web
```

> ⚠️ Roll back **only the app that is actually broken.** If `qorix-api` is bad
> but `qorix-markets-web` is fine, leave the web alone — rolling both back
> doubles your blast radius for no reason.

If `fly releases rollback` fails (image GC'd, secret changed, etc.), redeploy
a known-good commit from CI instead: GitHub → **Actions → Deploy to Fly.io →
Run workflow** → pick the last green commit on `main` and target `api`,
`web`, or `both`. The workflow re-runs the smoke checks before declaring
success.

## 3. (API only) Fail cron + Telegram back over to Replit

The API instance is the **only** machine that runs cron, the Telegram
poller, watchers, and BullMQ workers (gated by `RUN_BACKGROUND_JOBS` in
`artifacts/api-server/src/index.ts`). If the rollback can't bring those
back — or you're rolling back to an image old enough that you don't trust
its workers — temporarily move them back to Replit.

**Order matters: turn Fly off *before* turning Replit on, or you'll have
two pollers fighting over the same Telegram updates.**

```bash
# 1. Stop background jobs on Fly.
fly secrets set RUN_BACKGROUND_JOBS=false --app qorix-api
# (setting a secret restarts the machine automatically)

# 2. On Replit: project Secrets → set RUN_BACKGROUND_JOBS=true,
#    then restart the `Start application` workflow.
```

Confirm exactly **one** instance is running them:
- Replit logs show `cron`, `Telegram poller`, watchers, and workers as
  *started*.
- `fly logs --app qorix-api` shows
  `RUN_BACKGROUND_JOBS=false — cron, Telegram poller, watchers, and workers are DISABLED on this instance`.

When Fly is healthy again, reverse it: `RUN_BACKGROUND_JOBS=false` on
Replit, then `fly secrets set RUN_BACKGROUND_JOBS=true --app qorix-api`.

## 4. Verify the rollback took effect

```bash
# Same checks as the GitHub Actions smoke step
curl -fsS https://api.qorixmarkets.com/api/healthz | grep '"status":"ok"'
curl -fsS https://api.qorixmarkets.com/api/public/market-indicators | grep '"activeInvestors"'
test "$(curl -fsS https://qorixmarkets.com/healthz)" = "ok" && echo OK

# Confirm the live release is the one you rolled back to
fly releases --app qorix-api          | head -3
fly releases --app qorix-markets-web  | head -3

# Tail logs for ~60s and watch for clean startup, no error spam
fly logs --app qorix-api
```

Then sign in with Google end-to-end on https://qorixmarkets.com and load
the dashboard. If any of these fail, escalate to redeploying a known-good
commit (step 2 fallback) before troubleshooting further.

## 5. Tell the team

Post in the team channel as soon as the rollback command is fired — don't
wait for verification.

```
[INCIDENT] Rolling back <qorix-api | qorix-markets-web | both>
  From: vNN (deployed <time> by <author>, commit <sha>)
  To:   vMM (last known-good)
  Symptom: <healthcheck 5xx | login broken | error spike | …>
  Background jobs: <still on Fly | failed over to Replit>
  Owner: <your name>
```

Follow up within the hour with: root cause (one line), the bad commit
SHA, and a link to the fix PR or revert. File a postmortem ticket so the
fix doesn't get lost once the fire is out.
