# Smoke-Test Account (`SMOKE_TEST_EMAIL`)

The deploy workflow at `.github/workflows/deploy.yml` runs an authenticated
smoke check against the freshly deployed API on every push to `main`. It logs
in as a real user account whose credentials are stored as repo secrets:

- `SMOKE_TEST_EMAIL`
- `SMOKE_TEST_PASSWORD`

Because that account logs in dozens of times a day from shared CI infra, we
cannot let it behave like a normal customer account. This document describes
how the platform isolates it.

## How the flag is set

`lib/db/src/schema/users.ts` has a boolean column `is_smoke_test` (default
`false`). At api-server boot, `flagSmokeTestAccount()` (in
`artifacts/api-server/src/lib/smoke-test-account.ts`) runs idempotently:

1. Reads `SMOKE_TEST_EMAIL` from the environment. If unset (e.g. local dev),
   it logs a warning and exits — no rows are touched.
2. `UPDATE users SET is_smoke_test = false WHERE is_smoke_test = true AND email != $1`
   so that rotating the smoke email clears the flag from the previous account.
3. `UPDATE users SET is_smoke_test = true WHERE email = $1`. If the email
   does not (yet) match a row, it logs a warning and continues — the deploy
   smoke check itself will create the account on first login, and the flag
   will be set on the next boot.

`isSmokeTestUser(userId)` is the runtime check. It has a 60-second
in-process cache and is **fail-closed**: any DB error is treated as "smoke
test", so a transient outage cannot accidentally enable real-money operations
on the smoke account.

## What the flag blocks

| Surface                                              | Behavior for smoke-test user                                  |
| ---------------------------------------------------- | ------------------------------------------------------------- |
| `POST /api/wallet/deposit` (real-money / TRON)       | 403 `smoke_test_account_blocked`                              |
| `POST /api/wallet/withdraw`                          | 403 `smoke_test_account_blocked`                              |
| `POST /api/wallet/transfer`                          | 403 `smoke_test_account_blocked`                              |
| `POST /api/investment/start` (open a trade)          | 403 `smoke_test_account_blocked`                              |
| TRON deposit watcher (`creditUserDeposit`)           | Skipped; row marked `status='ignored_smoke_test'`             |
| Referral leaderboard (`/api/leaderboard/referrals`)  | Excluded from top-10, from rank lookup, from rewards counter  |
| `/api/referral` and `/api/referral/referred-users`   | Hidden from any sponsor's downline / counts                   |
| `/api/public/market-indicators` active investors     | Excluded from real-active-investors count                     |
| `/api/dashboard/fund-stats` active investors         | Excluded from displayed Active Investors tile                 |
| Signup `active_investors_count` bump                 | Skipped on smoke-test signup                                  |
| Fraud service (`runFraudChecks`)                     | Early-returns; no signals raised against the smoke account    |
| Multi-account / device-cluster checks for real users | Smoke account excluded from peer set (no false flags)         |

Login events themselves are still recorded in `login_events` so the
authenticated smoke check still verifies the auth pipeline end-to-end — they
just don't produce fraud signals.

## Rotating the password / email

1. Generate a new password and update the GitHub repo secret
   `SMOKE_TEST_PASSWORD`. Then change the password on the live account
   through the normal flow — the smoke check on the next deploy will use the
   new value.
2. To swap the email entirely, update `SMOKE_TEST_EMAIL` in repo secrets and
   in the Fly app config (`fly secrets set SMOKE_TEST_EMAIL=...`). The next
   api-server boot will clear the flag from the old account and set it on
   the new one. If the new email does not yet exist as a user row, the first
   deploy smoke check will create it and the flag will be applied on the
   following boot.

## Local development

Leaving `SMOKE_TEST_EMAIL` unset in local `.env` is fine — `flagSmokeTestAccount()`
is a no-op when it's missing, and `isSmokeTestUser()` will return `false`
for every local account.

## Deploying schema changes

The `is_smoke_test` column is added to the `users` table via the Drizzle
schema in `lib/db/src/schema/users.ts`. In Replit, schema changes are
auto-applied by `scripts/post-merge.sh` (`pnpm --filter db push`) on every
merge. **For Fly.io production deploys, run the same push against the
production `DATABASE_URL` before (or as part of) the api-server release**
so the new code doesn't query a column that doesn't yet exist:

```bash
DATABASE_URL=postgres://… pnpm --filter db push
```

If you skip this, the api-server will boot fine (the bootstrap hook
catches and logs the error) but every query that filters on
`is_smoke_test` (leaderboards, public stats, fraud peer lookups) will
500 until the column is created.

## Analytics / ad-hoc queries

Login events still get rows in `login_events` for the smoke account so the
deploy smoke check exercises the auth pipeline end-to-end. **Any future
analytics or BI query that reads `login_events` directly should JOIN
`users` and exclude `is_smoke_test = true`** (or `WHERE user_id NOT IN
(SELECT id FROM users WHERE is_smoke_test)`) so CI logins don't skew
metrics like DAU, login funnel, or session counts.
