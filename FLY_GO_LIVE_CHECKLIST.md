# Fly.io Go-Live Checklist

One-time setup before the first push to `main` triggers a real deploy. Do these
**in order**. Anything skipped here will surface as a failed deploy, broken
auth, or two machines running cron at once.

Apps: `qorix-api` (artifacts/api-server) and `qorix-markets-web` (artifacts/qorix-markets).
Domains: `api.qorixmarkets.com` and `qorixmarkets.com`.

---

## 1. Create accounts and grab connection strings

- [ ] **Fly.io** — sign up at https://fly.io, install flyctl, log in:
  ```bash
  brew install flyctl   # or: curl -L https://fly.io/install.sh | sh
  fly auth login
  ```
- [ ] **Neon** (Postgres) — create a project at https://console.neon.tech, copy
      the pooled connection string (this is `DATABASE_URL`). It should look like
      `postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`.
- [ ] **Upstash** (Redis) — create a database at https://console.upstash.com,
      copy the **TLS** connection string (this is `REDIS_URL`). It should start
      with `rediss://` (note the double `s`).

## 2. Push the Drizzle schema to Neon

From the repo root, with `DATABASE_URL` pointed at the new Neon DB:
```bash
DATABASE_URL='postgresql://...neon.tech/neondb?sslmode=require' \
  pnpm --filter @workspace/db run push
```

## 3. Create the two Fly apps (no deploy yet)

```bash
fly launch --no-deploy --copy-config --config artifacts/api-server/fly.toml --name qorix-api
fly launch --no-deploy --copy-config --config artifacts/qorix-markets/fly.toml --name qorix-markets-web
```
Answer **No** if asked to add Postgres/Redis (we use Neon + Upstash) and **No**
to deploying now. The `app` and `primary_region` lines in each `fly.toml` are
already correct — don't let `fly launch` overwrite them.

## 4. Set every required secret

**API server (`qorix-api`)** — paste real values for each `...`.

> ⚠️ **Reuse, do not regenerate, `SESSION_SECRET` and `WALLET_ENC_SECRET`.**
> `SESSION_SECRET` signs every JWT — rotating it logs every existing user out.
> `WALLET_ENC_SECRET` decrypts existing on-chain wallet keys — rotating it
> makes every wallet stored in the DB undecryptable. Copy the exact current
> values from the Replit project secrets.

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

**Web app (`qorix-markets-web`)** — no runtime secrets; the API URL is baked
into the bundle via the `VITE_API_URL` build arg in `artifacts/qorix-markets/fly.toml`.

Verify with `fly secrets list --app qorix-api`.

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
