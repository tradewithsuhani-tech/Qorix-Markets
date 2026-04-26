# Fly.io Go-Live Checklist

One-time setup before the first push to `main` triggers a real deploy. Do these
**in order**. Anything skipped here will surface as a failed deploy, broken
auth, or two machines running cron at once.

Apps: `qorix-api` (artifacts/api-server) and `qorix-markets-web` (artifacts/qorix-markets).
Domains: `api.qorixmarkets.com` and `qorixmarkets.com`.
**Region: `bom` (Mumbai)** — both `fly.toml` files pin `primary_region = "bom"`.
Pick Postgres and Redis providers in the **same region** or you give back all
the latency you just paid Fly to save.

---

## 1. Create accounts and grab connection strings

- [ ] **Fly.io** — sign up at https://fly.io, install flyctl, log in:
  ```bash
  brew install flyctl   # or: curl -L https://fly.io/install.sh | sh
  fly auth login
  ```

- [ ] **Postgres** — pick **one** of the options below. They're listed in order
      of latency from the `bom` Fly app. Whichever you pick, the result is a
      single connection string assigned to `DATABASE_URL`.

  **Option A — Fly Managed Postgres in `bom` (recommended, lowest latency).**
  Single bill, sub-millisecond RTT from the app, automatic SSL. Created in
  step 3 below — for now just decide you're using it and skip ahead.

  **Option B — Supabase Mumbai.** Create a project at https://supabase.com,
  pick region **Asia Pacific (Mumbai) `ap-south-1`**, then Project Settings →
  Database → Connection string → **URI** (use the *pooled* "Transaction" mode
  string, port 6543). Looks like
  `postgresql://postgres.PROJECT:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require`.

  **Option C — Neon Singapore (fallback only).** Neon has no India region;
  `ap-southeast-1` (Singapore) is the closest at ~50 ms RTT. Only pick this
  if A and B are unavailable. Connection string format:
  `postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.

- [ ] **Redis (Upstash Mumbai)** — create a database at
      https://console.upstash.com, region **AWS Mumbai `ap-south-1`**,
      eviction enabled. Copy the **TLS** connection string (this is
      `REDIS_URL`). It must start with `rediss://` (double `s`). Upstash is
      the only managed Redis with a Mumbai region — don't pick anything else
      here or you'll add 200+ ms to every BullMQ job.

## 2. Push the Drizzle schema to Postgres

Skip this step if you picked **Option A** above — Fly Managed Postgres
doesn't exist yet. You'll come back here after step 3.

For Options B/C, with `DATABASE_URL` pointed at the new DB:
```bash
DATABASE_URL='postgresql://...?sslmode=require' \
  pnpm --filter @workspace/db run push
```

## 3. Create the two Fly apps (no deploy yet)

```bash
fly launch --no-deploy --copy-config --config artifacts/api-server/fly.toml --name qorix-api
fly launch --no-deploy --copy-config --config artifacts/qorix-markets/fly.toml --name qorix-markets-web
```

> ⚠️ **Keep `--copy-config`.** Without it, `fly launch` rewrites `fly.toml`
> from scratch and silently picks a region based on your laptop's location
> (so you'll end up in `iad` or `sin` instead of `bom`). With `--copy-config`
> the `app` and `primary_region = "bom"` lines from the file in this repo
> are preserved as-is. If `flyctl` still prompts for a region, answer with
> `bom`.

Answer **No** if asked to add Postgres/Redis here (we provision Postgres
explicitly in 3a below, and Redis is on Upstash) and **No** to deploying
now.

### 3a. (Option A only) Provision Fly Managed Postgres in `bom`

```bash
fly mpg create --name qorix-pg --region bom        # follow the prompts for size
fly mpg attach qorix-pg --app qorix-api            # injects DATABASE_URL as a Fly secret
fly mpg connect qorix-pg                           # opens a psql shell — exit when it works
```
Then push the schema using the same connection string Fly just attached
(visible in `fly secrets list --app qorix-api` as `DATABASE_URL`):
```bash
DATABASE_URL='<copy from fly secrets / fly mpg status>' \
  pnpm --filter @workspace/db run push
```
After this, **omit** `DATABASE_URL` from the `fly secrets set` block in
step 4 — `fly mpg attach` already set it. Setting it again with the wrong
value will break the api on the next deploy.

## 4. Set every required secret

**API server (`qorix-api`)** — paste real values for each `...`.

> ⚠️ **Reuse, do not regenerate, `SESSION_SECRET` and `WALLET_ENC_SECRET`.**
> `SESSION_SECRET` signs every JWT — rotating it logs every existing user out.
> `WALLET_ENC_SECRET` decrypts existing on-chain wallet keys — rotating it
> makes every wallet stored in the DB undecryptable. Copy the exact current
> values from the Replit project secrets.

> 🚨 **Option A users (Fly Managed Postgres): DO NOT set `DATABASE_URL` here.**
> `fly mpg attach` in step 3a already injected the correct value as a Fly
> secret. Setting it again overwrites Fly's value with a wrong/stale one
> and the API will fail to connect on the next deploy. Use the **Option A
> command** below instead.

**Options B/C (Supabase / Neon) — sets `DATABASE_URL` from your provider:**

```bash
fly secrets set --app qorix-api \
  DATABASE_URL='...' \
  REDIS_URL='...' \
  CORS_ORIGIN='https://qorixmarkets.com,https://www.qorixmarkets.com,https://qorix-markets-web.fly.dev' \
  RUN_BACKGROUND_JOBS='true' \
  SESSION_SECRET='...' \
  WALLET_ENC_SECRET='...' \
  AWS_ACCESS_KEY_ID='...' \
  AWS_SECRET_ACCESS_KEY='...' \
  AWS_REGION='...' \
  GOOGLE_CLIENT_ID='...' \
  GOOGLE_CLIENT_SECRET='...' \
  RECAPTCHA_SITE_KEY='...' \
  RECAPTCHA_SECRET_KEY='...' \
  SES_FROM_EMAIL='...' \
  SMTP_HOST='...' \
  SMTP_PORT='...' \
  SMTP_USER='...' \
  SMTP_PASS='...' \
  TELEGRAM_BOT_TOKEN='...' \
  PLATFORM_TRON_ADDRESS='...' \
  PLATFORM_TRON_PRIVATE_KEY='...'
```

**Option A (Fly Managed Postgres) — same block, with `DATABASE_URL` removed:**

```bash
fly secrets set --app qorix-api \
  REDIS_URL='...' \
  CORS_ORIGIN='https://qorixmarkets.com,https://www.qorixmarkets.com,https://qorix-markets-web.fly.dev' \
  RUN_BACKGROUND_JOBS='true' \
  SESSION_SECRET='...' \
  WALLET_ENC_SECRET='...' \
  AWS_ACCESS_KEY_ID='...' \
  AWS_SECRET_ACCESS_KEY='...' \
  AWS_REGION='...' \
  GOOGLE_CLIENT_ID='...' \
  GOOGLE_CLIENT_SECRET='...' \
  RECAPTCHA_SITE_KEY='...' \
  RECAPTCHA_SECRET_KEY='...' \
  SES_FROM_EMAIL='...' \
  SMTP_HOST='...' \
  SMTP_PORT='...' \
  SMTP_USER='...' \
  SMTP_PASS='...' \
  TELEGRAM_BOT_TOKEN='...' \
  PLATFORM_TRON_ADDRESS='...' \
  PLATFORM_TRON_PRIVATE_KEY='...'
```

**Web app (`qorix-markets-web`)** — no runtime secrets; the API URL is baked
into the bundle via the `VITE_API_URL` build arg in `artifacts/qorix-markets/fly.toml`.

Verify with `fly secrets list --app qorix-api`. Sanity-check that
`DATABASE_URL` and `REDIS_URL` are both present (regardless of which path
you took) before moving to step 5.

## 5. DNS and TLS certificates

In your DNS provider, add records pointing at Fly (use the IPs from
`fly ips list --app <app>`):
- `api.qorixmarkets.com` → A/AAAA records for `qorix-api`
- `qorixmarkets.com` and `www.qorixmarkets.com` → A/AAAA records for `qorix-markets-web`

Then issue certs:
```bash
fly certs add api.qorixmarkets.com   --app qorix-api
fly certs add qorixmarkets.com       --app qorix-markets-web
fly certs add www.qorixmarkets.com   --app qorix-markets-web
```
Wait for `fly certs show <hostname> --app <app>` to report `Issued`.

## 6. Update Google OAuth authorized redirect URIs

In the Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0
Client, add **both** the Fly hostnames and the production hostnames to
**Authorized redirect URIs**:
- `https://qorix-api.fly.dev/api/auth/google/callback`
- `https://api.qorixmarkets.com/api/auth/google/callback`

Save. Changes can take a few minutes to propagate.

## 7. Wire up GitHub Actions

`.github/workflows/deploy.yml` uses **one** secret (`FLY_API_TOKEN`) to deploy
**both** apps. A `fly tokens create deploy --app ...` token is app-scoped and
will fail authorization on the other app, so create an **org-scoped** token
that can deploy any app in the org:

```bash
fly orgs list                               # find your org slug
fly tokens create org --name github-actions-qorix --expiry 8760h
```

Copy the token (starts with `FlyV1 ...`) and add it in GitHub → repo →
Settings → Secrets and variables → Actions → **New repository secret**:
- Name: `FLY_API_TOKEN`
- Value: the token from above

Push a no-op commit to `main` (or run the workflow via **Actions → Deploy to
Fly.io → Run workflow**) and confirm **both** `deploy-api` and `deploy-web`
jobs go green. If only one passes, the token is app-scoped — recreate it with
`fly tokens create org` as above.

## 8. Stop cron from running in two places

On Replit, set `RUN_BACKGROUND_JOBS=false` in the project secrets (this is the
gate in `artifacts/api-server/src/index.ts`). Restart the API workflow. Confirm
the log line `RUN_BACKGROUND_JOBS=false — cron, Telegram poller, watchers, and
workers are DISABLED on this instance` appears on Replit, and the matching
"started" lines appear in `fly logs --app qorix-api`. **Only one machine should
ever be polling Telegram or running cron.**

---

### Smoke test
```bash
curl https://api.qorixmarkets.com/api/healthz   # → 200
curl https://qorixmarkets.com/healthz           # → 200
```
Then sign in with Google end-to-end on https://qorixmarkets.com.

---

### When a deploy goes bad

See [`FLY_ROLLBACK_RUNBOOK.md`](./FLY_ROLLBACK_RUNBOOK.md) for the 5-minute
rollback procedure (`fly releases rollback`, background-jobs failover to
Replit, post-rollback verification, and incident comms).
