# Mumbai Database Cutover Runbook

One-time, manual procedure to move live application data from the current
Replit/Neon (US-region) Postgres to the new India-region Postgres that
backs the Fly `bom` deploy. Companion to
[`FLY_GO_LIVE_CHECKLIST.md`](./FLY_GO_LIVE_CHECKLIST.md) (which covers the
deploy config) and [`FLY_ROLLBACK_RUNBOOK.md`](./FLY_ROLLBACK_RUNBOOK.md)
(which covers a *deploy* rollback, not a *DB* rollback).

This runbook is intentionally manual — it runs at most once per provider
and the safety properties (single writer, key reuse, sanity checks) are
worth a human in the loop. **Do not script or automate it.**

Apps: `qorix-api` and `qorix-markets-web`. Source DB = the current
`DATABASE_URL` on Replit (or the existing Fly secret). Target DB = the
India-region Postgres you picked in step 1 of `FLY_GO_LIVE_CHECKLIST.md`
(Fly Managed Postgres in `bom`, Supabase Mumbai, or Neon Singapore).

Target time end-to-end: **30–45 minutes**, of which ~15 minutes is
maintenance window for users. Keep this runbook open in one tab and a
shell with `flyctl`, `psql`, and `pg_dump` in another.

  ---

  ## Fast path (live execution checklist)

  Use this as the at-a-glance during the window. Each line maps to the
  detailed step below — read those *first*, then drive off this list.

  - [ ] **0.** Day-before prereqs done (toolchain, both DB URLs reachable,
        `WALLET_ENC_SECRET` + `SESSION_SECRET` copied to password manager,
        window announced).
  - [ ] **1.** T-15: pin Fly rollback target (`fly releases`), post
        `[CUTOVER]` start message, raise web maintenance banner.
  - [ ] **2.** Stop writes: `fly secrets set RUN_BACKGROUND_JOBS=false
        --app qorix-api`, then `fly scale count 0 --app qorix-api`,
        confirm `pg_stat_activity` is quiet.
  - [ ] **3.** Snapshot source row counts to `/tmp/cutover-source-*.txt`
        and grab one `deposit_addresses` ciphertext sample.
  - [ ] **4.** `pg_dump --format=custom --data-only --no-owner
        --no-privileges` to `/tmp/qorix-cutover-*.dump`.
  - [ ] **5.** Truncate target, `pg_restore --exit-on-error`, **reset
        sequences** (the `setval` batch — don't skip).
  - [ ] **6.** Diff source/target counts (must be empty), run
        wallet-decrypt preflight (must say `OK`). Reminder:
        **`WALLET_ENC_SECRET` and `SESSION_SECRET` do NOT change.**
  - [ ] **7.** `fly secrets set DATABASE_URL=...` (skip on Fly MPG —
        `fly mpg attach` already set it). No DNS changes needed for this
        cutover (see step 7 for the conditional).
  - [ ] **8.** Re-enable: `RUN_BACKGROUND_JOBS=true`, `fly scale count 1`,
        smoke `curl /api/healthz`, drop maintenance banner, post
        `[CUTOVER] complete`. Keep source DB up read-only for 7 days.
  - [ ] **9.** (Only if smoke fails / first-hour errors) execute
        back-out: re-freeze, point `DATABASE_URL` at source, scale up,
        smoke, post `[INCIDENT]`.

  ---

  ## 0. Before you start (do this the day before)

Skipping any of these turns the cutover into an outage. None of them
require touching production.

- [ ] Confirm `FLY_GO_LIVE_CHECKLIST.md` steps 1–7 are **done**. The
      target Mumbai DB exists, the schema is pushed (`pnpm --filter
      @workspace/db run push`), and `DATABASE_URL` is set as a Fly
      secret on `qorix-api`. The cutover only moves *data*, never
      schema.
- [ ] You have **psql client tools that match the Postgres major version
      of both DBs**. Check with `pg_dump --version` and `psql --version`.
      A `pg_dump` older than the source server refuses to run; a newer
      one is fine.
- [ ] You can connect to **both** DBs from your laptop right now:
      ```bash
      psql "$SOURCE_DATABASE_URL" -c 'select count(*) from users;'
      psql "$TARGET_DATABASE_URL" -c 'select count(*) from users;'   # 0 is expected
      ```
      Export both URLs in your shell and **keep them quoted** — they
      contain `?` and `&` that the shell will otherwise eat.
- [ ] Copy the **current production values** of `WALLET_ENC_SECRET` and
      `SESSION_SECRET` into your password manager. You will need to
      paste the *exact same values* into Fly during step 6. Verify
      with:
      ```bash
      fly secrets list --app qorix-api | grep -E 'WALLET_ENC_SECRET|SESSION_SECRET'
      ```
      If those Fly secrets are blank or different from Replit's, **stop
      and fix that first** — see the warning in step 6.
- [ ] Pick a maintenance window when trade volume is lowest (typically
      02:00–02:30 IST, Sun→Mon). Announce it to users at least 24 h in
      advance — banner on the web app + email to active wallets.
- [ ] Tell whoever owns Telegram support that the bot will be silent
      during the window so they don't restart anything.

---

## 1. T-15 min: announce the window and pin the rollback target

```bash
# Pin the Fly release we'll roll back to if this goes wrong, so that even
# if a deploy slips in mid-cutover we know which image was last good.
fly releases --app qorix-api          | head -3   # note the current vNN
fly releases --app qorix-markets-web  | head -3
```

Post in the team channel:

```
[CUTOVER] Mumbai DB cutover starting in 15 min.
  Source: <provider> (<region>)
  Target: <provider> (bom / ap-south-1 / ap-southeast-1)
  Maintenance window: ~15 min, writes only (reads stay up briefly, then 503)
  Rollback target: qorix-api vNN, qorix-markets-web vMM
  Owner: <your name>
```

Flip the maintenance banner on the web app (or merge a one-line PR that
sets it) so signed-in users see *"Brief maintenance in progress, balances
will be back shortly."*

## 2. T-0: stop writes (single-writer invariant)

The **only** way to guarantee zero in-flight write loss is for there to
be exactly one Postgres being written to at a time. We achieve that by
freezing the source.

```bash
# 1. Stop background jobs first — cron, the Telegram poller, the TRON
#    watcher, and BullMQ workers all write to the DB and don't go through
#    the HTTP API. Setting this secret restarts the machine.
fly secrets set RUN_BACKGROUND_JOBS=false --app qorix-api

# 2. If background jobs are still running on Replit (they shouldn't be —
#    step 8 of FLY_GO_LIVE_CHECKLIST.md disabled them), turn them off
#    there too.
#    Replit → Secrets → RUN_BACKGROUND_JOBS=false → restart workflow.

# 3. Stop the API itself so HTTP requests can't write either. We scale
#    to zero rather than rely on a Postgres-side read-only flag because
#    Supabase pooled URLs and Fly MPG don't expose `default_transaction_
#    read_only` in a way the app reliably hits.
fly scale count 0 --app qorix-api
fly status   --app qorix-api          # confirm: 0 machines started
```

Users now see 503 on every API call. The web app keeps serving the
maintenance banner. **Start a stopwatch — your goal is to be back in
step 8 within 15 minutes.**

Sanity check that the source DB is quiet (should be 0 active write
transactions besides your own session):

```bash
psql "$SOURCE_DATABASE_URL" -c "
  select pid, usename, application_name, state, query
  from pg_stat_activity
  where datname = current_database()
    and state <> 'idle'
    and pid <> pg_backend_pid();
"
```

If anything other than your own psql is `active` and writing, find it
and stop it before you dump. A common culprit is a forgotten Replit
workflow or a local dev shell still pointed at prod.

## 3. Snapshot baseline metrics (so you can verify the restore)

Capture row counts for every critical table on the **source**. You'll
diff these against the target after the restore.

```bash
psql "$SOURCE_DATABASE_URL" -At -F',' -c "
  select relname, n_live_tup
  from pg_stat_user_tables
  order by relname;
" > /tmp/cutover-source-counts.csv

# Plus exact counts on the tables we care about most (pg_stat_user_tables
# is approximate). Wallets, users, the ledger, and deposit addresses are
# the four where 'approximately equal' is not good enough.
psql "$SOURCE_DATABASE_URL" -c "
  select 'users'              as t, count(*) from users
  union all select 'wallets',           count(*) from wallets
  union all select 'ledger_entries',    count(*) from ledger_entries
  union all select 'deposit_addresses', count(*) from deposit_addresses
  union all select 'transactions',      count(*) from transactions
  union all select 'investments',       count(*) from investments;
" | tee /tmp/cutover-source-exact.txt
```

Also grab one wallet's ciphertext to use as a decrypt sanity check
later — pick a real, recent row, not a test user:

```bash
psql "$SOURCE_DATABASE_URL" -c "
  select id, user_id, address
  from deposit_addresses
  where private_key_enc <> ''
  order by id desc
  limit 1;
" | tee /tmp/cutover-decrypt-sample.txt
```

## 4. `pg_dump` the source

```bash
# --format=custom + -Z 6: compressed, parallel-restorable, much smaller
#   than plain SQL.
# --no-owner --no-privileges: the target DB has a different role (e.g.
#   neondb_owner vs postgres vs supabase_admin); don't try to recreate
#   GRANTs that won't apply.
# We dump data only here because the schema is already in place on the
# target via `pnpm --filter @workspace/db run push` (FLY_GO_LIVE_CHECKLIST
# step 2/3a). Dumping schema too risks DDL conflicts.
pg_dump "$SOURCE_DATABASE_URL" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  --data-only \
  --file=/tmp/qorix-cutover-$(date -u +%Y%m%dT%H%M%SZ).dump

ls -lh /tmp/qorix-cutover-*.dump        # sanity: not 0 bytes, not 50 GB
```

If the dump fails partway, **do not proceed**. Re-check connectivity to
the source (the read-only mode in step 2 should not have affected
`pg_dump`, but a flaky network will). Fix and re-run. The source is
still authoritative; nothing is lost.

## 5. Restore into the Mumbai target

Truncate any rows the schema-push left behind (it shouldn't have, but
seeded settings or system rows from a `migrate` will collide on PK):

```bash
psql "$TARGET_DATABASE_URL" -c "
  do \$\$
  declare r record;
  begin
    for r in
      select tablename from pg_tables where schemaname = 'public'
    loop
      execute format('truncate table %I restart identity cascade;', r.tablename);
    end loop;
  end \$\$;
"
```

Then load:

```bash
pg_restore \
  --dbname="$TARGET_DATABASE_URL" \
  --no-owner \
  --no-privileges \
  --data-only \
  --jobs=4 \
  --exit-on-error \
  /tmp/qorix-cutover-*.dump
```

`--exit-on-error` is non-negotiable — without it `pg_restore` will skip
broken rows and exit 0, and you'll find the gap a week later when a
user's withdrawal fails. If it errors out mid-restore, truncate again
and re-run; partial restores are not safe to "patch up" by hand.

**Reset sequences.** `pg_restore --data-only` inserts rows with their
original primary-key values but does **not** advance the underlying
`serial` sequences. If you skip this, the first new `INSERT` into
`users`, `wallets`, `ledger_entries`, etc. will collide with PK 1 and
the API will spew duplicate-key errors as soon as a real user signs in
in step 8.

```bash
# Generate one setval(...) statement per serial sequence in the public
# schema, then pipe back into psql to execute them. Safer than hand-
# listing tables — picks up any new tables added to lib/db/src/schema/
# automatically.
psql "$TARGET_DATABASE_URL" -At -c "
  select format(
    'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from %I), 1), true);',
    table_name, column_name, column_name, table_name
  )
  from information_schema.columns
  where table_schema = 'public'
    and column_default like 'nextval(%';
" | psql "$TARGET_DATABASE_URL" -f -
```

After this, every sequence is at `max(id)`, so the next `nextval` is
`max(id) + 1`. Sanity-spot-check one critical table:

```bash
psql "$TARGET_DATABASE_URL" -c "
  select last_value from pg_sequences where sequencename = 'users_id_seq';
"
# Should equal max(users.id) on the source.
```

## 6. Verify the restore (counts + wallet decrypt)

> 🚨 **Do not change `WALLET_ENC_SECRET` or `SESSION_SECRET` during the
> cutover.** They must keep their *exact* current values on `qorix-api`:
> - Rotating `WALLET_ENC_SECRET` makes every `deposit_addresses.private_key_enc`
>   row undecryptable. Funds in those wallets become unsweepable. The
>   wallet preflight in `artifacts/api-server/src/lib/wallet-preflight.ts`
>   will refuse to start the API in production if this happens, but the
>   data damage is already done — *don't rely on the preflight as your
>   safety net, just don't rotate the key*.
> - Rotating `SESSION_SECRET` invalidates every signed JWT, so every
>   logged-in user is forced to sign in again the moment they next hit
>   the API. Sessions are JWT-based (no `sessions` table to migrate),
>   so the secret is the *only* thing tying an existing JWT to a valid
>   session.
> If you genuinely need to rotate either secret, do it in a separate
> change *after* this cutover is verified green, not as part of it.

Re-run the counts on the **target** and diff:

```bash
psql "$TARGET_DATABASE_URL" -c "
  select 'users'              as t, count(*) from users
  union all select 'wallets',           count(*) from wallets
  union all select 'ledger_entries',    count(*) from ledger_entries
  union all select 'deposit_addresses', count(*) from deposit_addresses
  union all select 'transactions',      count(*) from transactions
  union all select 'investments',       count(*) from investments;
" | tee /tmp/cutover-target-exact.txt

diff -u /tmp/cutover-source-exact.txt /tmp/cutover-target-exact.txt
```

The diff must be **empty**. Any row-count mismatch on `users`, `wallets`,
`ledger_entries`, or `deposit_addresses` is a stop-the-line — go to the
back-out path in step 9.

For the broader table list (settings, signal trades, scheduled promos,
etc.), eyeball `/tmp/cutover-source-counts.csv` against:

```bash
psql "$TARGET_DATABASE_URL" -At -F',' -c "
  select relname, n_live_tup
  from pg_stat_user_tables
  order by relname;
" > /tmp/cutover-target-counts.csv

diff -u /tmp/cutover-source-counts.csv /tmp/cutover-target-counts.csv
```

`pg_stat_user_tables` counts are approximate, so a small drift here
(±1–2 on busy queue tables) is OK — but anything more than that on
a financial table is not.

**Wallet decrypt sanity check.** This is the same code path the API
runs at boot (`runWalletEncryptionPreflight` in
`artifacts/api-server/src/lib/wallet-preflight.ts`). We run it with the
target DB so we catch a bad key *before* users hit the API:

```bash
# Point a one-shot machine at the new DB and let it run the preflight.
# The API exits 1 in production if the preflight fails — so a successful
# 'started' line in the logs == green.
DATABASE_URL="$TARGET_DATABASE_URL" \
  fly machine run . \
    --app qorix-api \
    --rm \
    --env DATABASE_URL="$TARGET_DATABASE_URL" \
    --command 'node dist/index.js' \
  2>&1 | tee /tmp/cutover-preflight.log

grep -E '\[wallet-preflight\] (OK|FATAL)' /tmp/cutover-preflight.log
```

You want to see:

```
[wallet-preflight] OK — wallet encryption secret matches existing data
```

If you see `FATAL — cannot decrypt existing wallet ciphertext`, the
`WALLET_ENC_SECRET` on `qorix-api` does not match the secret the source
DB's wallets were encrypted with. **Stop, fix the secret to match
Replit's value, and re-run this step.** Do *not* proceed to step 7.

  > 💡 **Fallback verification path** if `fly machine run` is unavailable
  > or behaves unexpectedly in your version of `flyctl` (the one-shot
  > command and its flags have shifted between flyctl releases). You can
  > exercise the *same* preflight against the new DB without a one-shot
  > machine, by piggy-backing on the regular boot:
  >
  > 1. Temporarily set `DATABASE_URL` on `qorix-api` to the new target,
  >    but **leave the API scaled to 0** so no real users hit it:
  >    `fly secrets set DATABASE_URL="$TARGET_DATABASE_URL" --app qorix-api`
  > 2. Bring exactly one machine up briefly:
  >    `fly scale count 1 --app qorix-api`
  > 3. Tail `fly logs --app qorix-api` and look for the
  >    `[wallet-preflight] OK` line within ~10 s of startup. If you see
  >    `[wallet-preflight] FATAL` and the machine exits, the API will
  >    crashloop — that is the desired behavior, it is telling you the
  >    secret is wrong before any user is exposed.
  > 4. Scale back to 0 (`fly scale count 0 --app qorix-api`) and continue
  >    to step 7. The `DATABASE_URL` you just set is the one you want for
  >    step 7 anyway, so this is not wasted work — just keep step 7's
  >    `fly secrets set` for documentation but you can skip re-running it.
  >
  > Either path is acceptable. The one-shot machine is cleaner because it
  > never brings the API into the load balancer; the boot-and-tail method
  > is more robust against `flyctl` version drift.

## 7. Point the API at the new DB

```bash
# Option A (Fly Managed Postgres in bom): the secret was injected by
# `fly mpg attach` and is already correct. Skip this command.

# Options B/C (Supabase Mumbai / Neon Singapore): set DATABASE_URL to
# the new connection string. fly secrets set restarts the machine.
fly secrets set DATABASE_URL="$TARGET_DATABASE_URL" --app qorix-api
```

There is **no DNS step** — the app's hostname (`api.qorixmarkets.com`)
already points at Fly. The DB swap is a Fly secret + restart, nothing
in DNS changes.

  > ⚠️ **Only touch DNS if app hosting is also moving.** If you're doing
  > a combined cutover that *also* relocates `qorix-api` /
  > `qorix-markets-web` off Fly (e.g. to a different cloud region's load
  > balancer), you'd also need to update the A/AAAA records from
  > `FLY_GO_LIVE_CHECKLIST.md` step 5 and re-issue certs. That is a
  > separate runbook — don't improvise it inline here.

## 8. Re-enable writes and bring the API back

```bash
# Bring background jobs back on Fly (cron, Telegram poller, watchers,
# BullMQ workers). Make sure Replit still has RUN_BACKGROUND_JOBS=false
# from FLY_GO_LIVE_CHECKLIST step 8 — two pollers will fight over
# Telegram updates and double-process trades.
fly secrets set RUN_BACKGROUND_JOBS=true --app qorix-api

# Scale the API back up. fly.toml in this repo defines the desired
# count; `fly scale count 1` is a safe default.
fly scale count 1 --app qorix-api
fly status   --app qorix-api          # wait for "started" + healthchecks passing

# Smoke test (same checks as the GitHub Actions deploy)
curl -fsS https://api.qorixmarkets.com/api/healthz | grep '"status":"ok"'
curl -fsS https://api.qorixmarkets.com/api/public/market-indicators | grep '"activeInvestors"'

# Tail logs for ~60s and watch for [wallet-preflight] OK and clean
# startup with no DB error spam.
fly logs --app qorix-api
```

End-to-end smoke test, in a private browser window:

1. Sign in with Google on https://qorixmarkets.com.
2. Confirm the dashboard loads with the **right balance** for that user
   (cross-check against a screenshot you took before step 2, if you
   were the test user).
3. Open the deposit address page and confirm the TRON address renders
   (this exercises the wallet decrypt path on a live request).
4. Place a tiny test trade and confirm the ledger entry appears in
   `psql "$TARGET_DATABASE_URL" -c "select * from ledger_entries order
   by id desc limit 5;"`.

Take the maintenance banner down. Post in the team channel:

```
[CUTOVER] Mumbai DB cutover complete.
  Source: <provider> (now read-only, frozen at <UTC time>)
  Target: <provider> (bom / ap-south-1 / ap-southeast-1)
  Verified: row counts match, [wallet-preflight] OK, end-to-end login + trade ✅
  Source DB will be kept read-only for 7 days as a safety net.
  Owner: <your name>
```

**Keep the source DB up for 7 days.** Don't delete it. If a problem
surfaces 6 hours from now, the cleanest recovery is the back-out path
in step 9, which assumes the source still exists and still has the
data you froze.

## 9. Back-out path (within the first hour)

If smoke tests fail in step 8, or if the first hour after cutover shows
elevated 5xx, balance drift, or wallet decrypt errors in the logs,
revert to the source DB. The procedure is the cutover in reverse, but
much shorter because the source has not been written to since step 2.

```bash
# 1. Stop writes again — same as step 2.
fly secrets set RUN_BACKGROUND_JOBS=false --app qorix-api
fly scale count 0 --app qorix-api

# 2. Point DATABASE_URL back at the source.
#    (Option A: if you migrated FROM Fly MPG TO another provider, you'll
#    need `fly mpg attach qorix-pg --app qorix-api` to re-attach. If you
#    migrated TO Fly MPG, run `fly secrets set DATABASE_URL=...` with
#    the previous URL.)
fly secrets set DATABASE_URL="$SOURCE_DATABASE_URL" --app qorix-api

# 3. Bring the API and background jobs back up.
fly secrets set RUN_BACKGROUND_JOBS=true --app qorix-api
fly scale count 1 --app qorix-api

# 4. Re-run the step 8 smoke tests against the API. Login + dashboard
#    + deposit address + ledger query must all pass.

# 5. Diff the target DB against the source one more time so you have a
#    record of what (if anything) was written to the target during the
#    failed window. Even if step 2's freeze worked, this is cheap
#    insurance.
psql "$TARGET_DATABASE_URL" -c "
  select 'users' as t, count(*) from users
  union all select 'wallets',           count(*) from wallets
  union all select 'ledger_entries',    count(*) from ledger_entries
  union all select 'deposit_addresses', count(*) from deposit_addresses;
" | tee /tmp/cutover-target-postbackout.txt
diff -u /tmp/cutover-source-exact.txt /tmp/cutover-target-postbackout.txt
```

Post in the team channel:

```
[INCIDENT] Mumbai DB cutover backed out.
  Reason: <healthcheck 5xx | wallet decrypt FATAL | balance mismatch | ...>
  DB is back on: <source provider/region>
  User impact: ~<N> min of 503s, no data loss (source was frozen at <UTC time>)
  Next: postmortem before re-attempting cutover.
  Owner: <your name>
```

After the back-out, **do not re-attempt the cutover the same day**. The
target DB is now in a half-written state from the failed attempt; before
trying again you need to (a) `truncate ... cascade` everything on the
target, and (b) understand and fix whatever caused the failure (wrong
secret, network, version skew, etc.). File a postmortem ticket and
schedule a fresh window.

---

## Critical tables (what to actually care about)

These are the tables where a row-count mismatch or a decrypt failure
means real user money is at risk. Defined in `lib/db/src/schema/`:

- `users` (`users.ts`) — Google OAuth identities, KYC state. Lose a
  row and that user can't log in.
- `wallets` (`wallets.ts`) — `main_balance`, `trading_balance`,
  `profit_balance`. The source of truth for what users see and can
  withdraw.
- `ledger_entries` (`ledger.ts`) — double-entry journal that backs
  every balance. A `wallets` vs `ledger` drift means accounting is
  broken even if balances "look right". Catch this early; the
  reconciliation report is in `artifacts/api-server/src/lib/ledger-service.ts`.
- `deposit_addresses` (`deposit-addresses.ts`) — TRON addresses with
  `private_key_enc`. The encryption check in step 6 is specifically
  about this table.
- `transactions` (`transactions.ts`), `investments` (`investments.ts`)
  — withdrawal/deposit history and active investment positions. Also
  count-checked in step 6.

There is no `sessions` table — auth is JWT, signed by `SESSION_SECRET`.
That's why step 6's warning is about *the secret*, not about migrating
session rows.
