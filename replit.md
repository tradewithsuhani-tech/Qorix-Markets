# Qorix Markets

## Overview

A premium fintech PWA for automated USDT investment and trading. Users deposit USDT, select a risk level, and the platform simulates daily trading with profit distribution. Includes wallet management, referral system, VIP membership tiers, and a full enterprise-grade admin panel.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (Tailwind CSS v4, Framer Motion, Recharts, Wouter)
- **Backend**: Express 5 (Node.js)
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/qorix-markets run dev` — run frontend locally

## Project Structure

```
artifacts/
  api-server/          # Express backend API
    src/
      routes/          # auth, wallet, investment, referral, dashboard, admin, transactions, notifications
      middlewares/     # JWT auth middleware
  qorix-markets/       # React + Vite frontend
    src/
      pages/           # landing, dashboard, wallet, invest, transactions, referral, admin, settings
      hooks/           # use-auth
      components/      # Layout, AnimatedCounter, ui/...
lib/
  api-spec/            # OpenAPI spec (openapi.yaml)
  api-client-react/    # Generated React Query hooks
  api-zod/             # Generated Zod validation schemas
  db/                  # Drizzle ORM schema and db connection
    src/schema/        # users, wallets, transactions, investments, trades, equity, settings, notifications
```

## Features

1. **Auth**: JWT login/register with bcrypt password hashing
2. **Wallet**: main_balance, trading_balance, profit_balance; deposit/withdraw/transfer
3. **Investment**: Start/stop auto trading, Low/Medium/High risk (3%/5%/10% drawdown limits)
4. **Trading Simulation**: Admin sets daily profit %, distributed across all active investors
5. **Auto Compounding**: Optional — compounds profit back into trading balance
6. **Referral System**: Unique referral codes, sponsor earns 0.5% monthly on active investment
7. **Dashboard**: Animated balances, equity area chart, recent trades, P&L display
8. **Capital Protection**: Configurable drawdown limits (3/5/10%), auto-pause trading, sticky banner
9. **Anti-Fraud / Signup Security**: Honeypot field, IP signup rate limiting (5/IP/day), bot timing detection, device fingerprint & IP tracking, multi-account detection
10. **Email OTP Verification**: 6-digit OTP on signup and withdrawal confirmation; dev mode logs OTP to console
11. **Task & Points System**: Daily/weekly/social/one-time task definitions (seeded at startup); points awarded per task; daily cap of 200pts; points usable for fee discounts & VIP upgrades; admin-side task proof approval/rejection
12. **Social Task Verification**: Users submit URL/text proof; admin review queue at /admin/task-proofs
13. **Withdrawal Security**: OTP required before every withdrawal; large withdrawals require admin approval
14. **Points Ledger**: Full points history per user; admin can grant/deduct points
9. **Advanced Analytics**: Equity curve, drawdown chart, profit distribution, risk/return scatter, rolling returns (Chart.js)
10. **Notification System**: Real-time bell icon with badge, dropdown panel, per-event types (deposit, withdrawal, daily_profit, monthly_payout, drawdown_alert, system), mark-read/delete
11. **Admin Panel**: Set daily profit %, view AUM, approve/reject withdrawals, user management
12. **PWA**: manifest.json, service worker, mobile bottom navigation
13. **Qorix Assistant Chatbot**: Floating chat button (bottom-right), predefined flows (How to Start, Investment Guide, Returns, Risk), quick reply buttons, typing animation, "Talk to Expert" escalation, admin chat panel with real-time replies and session resolution
14. **Separate Admin Portal**: Admins use `/admin-login` for a dedicated admin login flow. Admin-only pages use an admin navigation layout with no investor/user menu items.
15. **Upgraded Admin System**: Admin modules include Dashboard, Users, Deposits, Withdrawals, Trading, Wallet, Analytics, System, Logs, Intelligence, Fraud Monitor, and Support Chats. User security controls include freeze/unfreeze, enable/disable, and force logout. System controls include maintenance mode, registration toggle, auto-withdraw limit, and in-app broadcast notifications.
16. **Test Lab** (`/admin/test`): Isolated test environment for safe simulation. Accessible from the Admin Dashboard quick links. Features: Test Mode toggle (suspends real blockchain polling when active), 50 test user seeding with wallets and investments, full automated test suite (Deposit Engine, Profit Engine, Withdrawal Flow, Security, Fraud Detection, Load & Performance), JSON test report with pass/fail/warning breakdown, bug auto-detection with severity ratings, and one-click cleanup. All test data uses `@qorix-test.internal` email domain and is fully isolated from real users. Test Mode API: `GET/POST /api/test/status|enable|disable|seed-users|run-all` + `DELETE /api/test/cleanup`.

## Demo Accounts

- Admin: `admin@qorix.com` / `Admin@1234`
- Demo User: `demo@qorix.com` / `Demo@1234`

## TRON USDT Deposit System (Modular)

Self-contained on-chain deposit pipeline in `artifacts/api-server/src/lib/crypto-deposit/`:

- **`wallet.ts`** — In-memory wallet store. `createWallet()` generates a fresh TRON address + private key pair (via `tron-address.ts`) and tracks a per-wallet USDT balance.
- **`depositWatcher.ts`** — Background poller (every 15 s). Iterates all registered wallets, fetches TRC20 USDT transfers from TronGrid, deduplicates by tx hash, credits balance, and kicks off the sweep pipeline.
- **`sweep.ts`** — Two-step sweep: (1) sends 1 TRX from MAIN_WALLET to the deposit wallet for gas, waits 8 s, then (2) sweeps all USDT back to MAIN_WALLET using TronWeb + the user's private key.

**Required env vars** (set in Secrets):

| Variable | Description |
|---|---|
| `TRONGRID_API_KEY` | TronGrid Pro API key |
| `MAIN_WALLET` | Platform wallet address (receives swept USDT) |
| `MAIN_PRIVATE_KEY` | Private key for MAIN_WALLET (sends TRX gas + is destination) |
| `USDT_CONTRACT` | TRC20 USDT contract (default: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`) |

**Public API endpoints** (no auth required):
- `POST /api/create-wallet` — generate a new deposit wallet
- `GET /api/balance/:address` — query in-memory USDT balance

## API Routes

All routes prefixed with `/api`:
- POST `/auth/register`, POST `/auth/login`, GET `/auth/me`
- GET/POST `/wallet`, POST `/wallet/deposit`, POST `/wallet/withdraw`, POST `/wallet/transfer`
- GET `/transactions`
- GET/POST `/investment`, POST `/investment/start`, POST `/investment/stop`, PATCH `/investment/compounding`
- GET `/trades`
- GET `/referral`, GET `/referral/referred-users`
- GET `/dashboard/summary`, GET `/dashboard/equity-chart`
- GET `/admin/stats`, POST `/admin/profit`, GET `/admin/profit/history`, GET `/admin/users`
- GET `/admin/withdrawals`, POST `/admin/withdrawals/:id/approve`, POST `/admin/withdrawals/:id/reject`
- GET `/notifications`, PATCH `/notifications/read-all`, PATCH `/notifications/:id/read`, DELETE `/notifications/:id`

## Frontend Routes

- Public/user login: `/login`
- Admin-only login: `/admin-login`
- Admin portal: `/admin`, `/admin/users`, `/admin/deposits`, `/admin/withdrawals`, `/admin/trading`, `/admin/wallet`, `/admin/analytics`, `/admin/system`, `/admin/logs`, `/admin/intelligence`, `/admin/fraud`, `/admin/chats`

## Cron Jobs (node-cron)

Defined in `artifacts/api-server/src/lib/cron.ts`, initialized on server start:
- **Daily at midnight (00:00)**: Runs profit distribution using the last saved `daily_profit_percent` from `system_settings`. Skips if no rate is configured.
- **Monthly on the 25th at midnight (00:00 25 * *)**: Sweeps all user `profit_balance` → `main_balance` and creates transfer transaction records.

## VIP Membership System

`artifacts/api-server/src/lib/vip.ts` — pure computed tiers based on investment amount:

| Tier     | Min Investment | Profit Bonus | Withdrawal Fee |
|----------|---------------|--------------|----------------|
| Standard | $0            | —            | 2.0%           |
| Silver   | $500          | +5%          | 1.5%           |
| Gold     | $2,000        | +10%         | 1.0%           |
| Platinum | $10,000       | +15%         | 0.5%           |

- Tier is computed dynamically from `investmentAmount`, no DB column needed
- Profit bonus applied in `profit-service.ts` as an additive multiplier on top of risk multiplier (only on positive days)
- Withdrawal fee applied in `wallet.ts` withdraw route (deducted from gross amount, fee logged as separate `fee` transaction)
- `dashboard/summary` exposes `vip` object: `{ tier, label, profitBonus, withdrawalFee, minAmount, nextTier }`
- Frontend: `VipBadge` and `VipCard` components in `vip-badge.tsx`; badge shown in desktop sidebar user card, mobile top bar, and wallet withdraw panel; full VIP card on Settings page

## Signal Trading System
Admin opens a signal trade (pair, BUY/SELL, entry, pips target, expected profit %); on close,
realized profit % is distributed proportionally to every user's `trading_balance`.
- Schema: `signal_trades`, `signal_trade_distributions` (UNIQUE on `trade_id, user_id`).
- Service: `lib/signal-trade-service.ts` (atomic claim via `running → closing` status update,
  per-user wallet update + transaction row + distribution audit + double-entry journal,
  reverts to `running` if distribution fails).
- Routes: `POST /api/admin/signal-trades`, `POST /api/admin/signal-trades/:id/close`,
  `GET /api/admin/signal-trades?status=`, `GET /api/signal-trades/history`,
  `GET /api/signal-trades/recent`.
- Pages: `/admin/signal-trades` (admin), `/signal-history` (user).
- Ledger: profit → debit `platform:profit_expense`, credit `user:{id}:profit`.
  Loss path reverses both legs (debit user profit, credit profit_expense).

## Shared Profit Service

`artifacts/api-server/src/lib/profit-service.ts` exposes:
- `distributeDailyProfit(profitPercent)` — full distribution logic (drawdown check, compounding, equity snapshot, trade simulation, referral bonus, run log)
- `transferProfitToMain()` — monthly sweep of profit_balance → main_balance
- `getLastDailyProfitPercent()` — reads persisted rate from system_settings

## Anti-Fraud & Viral Growth System

Defense-in-depth, three layers:

**1. Application-layer guards (fast path)**
- KYC required for withdrawals + KYC/deposit-gated tasks (`task-service.ts`)
- 24h new-account withdrawal cool-off (`wallet.ts`)
- Daily referral cap: 10 sponsored signups per user per calendar day (`auth.ts /register`) — silently drops sponsor link past limit
- Weekly referral points cap (1000 pts/week) (`task-service.ts awardPoints`)
- Daily total points cap (200 pts/day)
- IP signup rate limit + honeypot + reCAPTCHA on `/register`
- Email-OTP gated withdrawals (`/auth/withdrawal-otp`)
- Auto-freeze user on 3+ unresolved high-severity fraud flags (`fraud-service.ts`)

**2. Atomic SQL guards (race-condition prevention)**
- Wallet balance debit: `UPDATE … SET balance = balance - $amt WHERE balance >= $amt RETURNING id` — 0 rows ⇒ throws `INSUFFICIENT_BALANCE` and rolls back the transaction (`wallet.ts /withdraw`)
- Points debit (for fee discount): same atomic guarded pattern → throws `INSUFFICIENT_POINTS`
- Both run inside a single `db.transaction(async tx => …)` so any failure rolls back the withdrawal request, ledger journal, and points debit together

**3. Schema-level idempotency (defense in depth)**
- `fraud_flags`: partial unique index `(user_id, flag_type) WHERE is_resolved = false` — no concurrent duplicate active flags. `raiseFraudFlag` uses `ON CONFLICT DO NOTHING` with explicit target.
- `user_task_completions`: unique `(user_id, task_id, period_key)`. `period_key` is computed in UTC: `YYYY-MM-DD` for daily, `YYYY-Www` (ISO week) for weekly, `"ALL"` for one_time/social/referral. `completeTask` uses `ON CONFLICT DO NOTHING`. `todayStart`/`weekStart` SQL filters were also switched to UTC to keep the application pre-check aligned with the DB unique constraint.

**Points → withdrawal fee discount**
- 1 pt = $0.01, max 50% of fee
- Wallet GET response now includes user `points`
- `/wallet/withdraw` accepts `usePoints` field; UI on wallet page lets users toggle "Use X pts" before review

### ⚠️ Production migration note (one-time)

Before running `pnpm --filter @workspace/db run push` against the **production** DB the first time, back-fill `period_key` on existing rows so the new unique index doesn't conflict on historical daily/weekly completions:

```sql
-- Run BEFORE schema push on prod (idempotent):
UPDATE user_task_completions u
SET period_key = CASE
  WHEN t.category = 'daily'  THEN to_char(u.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  WHEN t.category = 'weekly' THEN to_char(u.completed_at AT TIME ZONE 'UTC', 'IYYY-"W"IW')
  ELSE 'ALL'
END
FROM tasks t
WHERE t.id = u.task_id AND u.period_key = 'ALL';
```

If push has already been attempted and the index failed, drop the bad index, run the backfill above, then re-push.

### External services to verify post-deploy

- **AWS SES**: sender email must be verified; request production access to leave sandbox
- **reCAPTCHA**: live domain `qorix-markets-1.replit.app` must be added in the reCAPTCHA console

## Promotions System

Two layered offer sources, both gated by ONE-redemption-per-user-lifetime in `promo_redemptions`:

1. **Rotating-window offers** (`/api/promo/offer`) — deterministic HMAC-derived codes per N-minute window. Window length, %, prefix, master toggle in `system_settings`. Admin-tunable via System Control panel without redeploy.
2. **Scheduled holiday promos** (`scheduled_promos` table, admin CRUD at `/api/admin/scheduled-promos`) — fixed bonus % over a `[startsAt, endsAt)` window. When active, OVERRIDE the rotating offer (highest bonus % wins on overlap). Optional per-promo cap. Redeem flow runs in a single DB transaction with `SELECT ... FOR UPDATE` on the user redemption row + WHERE-filtered cap claim — atomic, no cap drift, safe under concurrency. Composite index `(is_active, starts_at, ends_at)` covers the active-lookup path.

Cap rule, lifetime cap, milestone idempotency (advisory-lock) and PROMO_BOUNDS bounds-clamp all live in `lib/promo-bounds.ts` + `lib/milestone-service.ts`.

## Telegram Alerts (opt-in)

Personal account alerts via Telegram bot. Bot: **@Qorixmarketsbot**.

- `users.telegram_chat_id` (bigint, unique idx) + link_code/expires_at + opt_in flag.
- Long-poll worker `lib/telegram-poller.ts` boots with api-server; handles `/start <code>` deep-link binds with atomic conditional UPDATE (id+code+not-expired+chatId IS NULL).
- Routes `/api/telegram/*`: link/start (mints 8-char A-Z2-9 code with 15-min TTL, returns deep link `https://t.me/Qorixmarketsbot?start=<code>`), status, opt-in toggle, unlink.
- Frontend card on Settings page (`components/telegram-alerts-card.tsx`).
- `createNotification` mirrors title+message to Telegram via `setImmediate` (fire-and-forget, never throws, never blocks tx). On 403/400 (user blocked or deleted bot) the binding is auto-cleared.
- Requires `TELEGRAM_BOT_TOKEN` env var. All code degrades to no-op when token missing — card hides on the frontend via `/status.configured`.

## Design

- Dark theme: deep navy/obsidian (HSL 224 71% 4%) + electric blue (#3b82f6)
- Glassmorphism cards (bg-white/5 + backdrop-blur)
- Framer Motion animations
- Mobile bottom navigation + desktop sidebar
- Recharts equity area chart
- PWA installable

## STAGING_MODE (blue-green deployment safety)

Set `STAGING_MODE=true` (or `1`) on a staging copy of this server to disable ALL background jobs that mutate shared state. Used when running a parallel staging Replit alongside production to avoid double-processing.

When `STAGING_MODE=true`:
- TronGrid USDT monitor (`tron-monitor.ts`) → skipped (would double-credit deposits)
- Crypto deposit watcher (`crypto-deposit/depositWatcher.ts`) → skipped
- Telegram poller (`telegram-poller.ts`) → skipped (Telegram returns 409 Conflict if two pollers share a token)
- All cron jobs (`cron.ts`) → skipped: daily profit distribution, monthly trading→profit sweep, hourly promo expiry, auto-signal engine tick + closer

API endpoints, auth, frontend serving — all still work normally on staging. Only background mutators are gated.

**Default OFF.** Production behavior is unchanged unless this env var is explicitly set on the staging deployment.

Helper: `lib/staging-mode.ts` exports `isStagingMode()` and `logStagingSkip(component)`.

## Production static asset serving (Express, not Replit static handler)

**Architecture change (Apr 2026):** In production the api-server (`artifacts/api-server/src/app.ts`) serves the qorix-markets SPA bundles directly via `express.static`, NOT Replit's built-in static handler.

**Why:** Replit's static handler returned `cache-control: private` with NO gzip/brotli on JS/CSS bundles. With ~3 MB of bundles, slow Indian mobile networks (3G/Edge) showed a 30+ second blank page on first load — users gave up before React rendered. Express + `compression` middleware + immutable cache headers cuts wire transfer ~4x and makes repeat visits instant.

**How it works:**
- `artifacts/api-server/.replit-artifact/artifact.toml`: `paths = ["/"]` (was `["/api"]`). Production build first runs `pnpm --filter @workspace/qorix-markets run build`, then `pnpm --filter @workspace/api-server run build`. Health check still on `/api/healthz`.
- `artifacts/qorix-markets/.replit-artifact/artifact.toml`: `[services.production]` block REMOVED. The qorix-markets artifact is now dev-only (vite dev server). Its build happens inside api-server's build step.
- `app.ts`:
  - `/assets/*` (Vite content-hashed) → `Cache-Control: public, max-age=31536000, immutable`
  - `index.html`, `sw.js`, `manifest.json`, `version.json` → `no-cache, no-store, must-revalidate`
  - SPA fallback: any non-`/api/*` GET returns `index.html` so wouter handles routing.
  - Compression threshold 1KB, level 6, skips images/video/audio.
  - Path resolution uses `import.meta.url` (NOT `process.cwd()`) so it works in both dev and prod regardless of working directory.

**Measured wins (post-deploy):**
| Asset | Raw | Gzipped |
|-------|-----|---------|
| index.js | 868 KB | 195 KB (4.4x) |
| vendor.js | 1.25 MB | 397 KB (3.1x) |
| vendor-react.js | 566 KB | 153 KB (3.7x) |
| index.css | 382 KB | 44 KB (8.7x) |
| **Total** | **3.1 MB** | **789 KB** |

**Express 5 gotcha:** `app.get("*", ...)` no longer works (path-to-regexp v8 requires named params). Use a generic middleware filtered to GET/HEAD instead.

**Vite manualChunks gotcha — DO NOT split React-using libs into separate chunks.** A previous split (vendor-radix, vendor-charts, vendor-icons, vendor-router, etc. separate from vendor-react) produced "Circular chunk: vendor-radix → vendor-react → vendor-radix" build warnings and crashed at runtime with `Cannot read properties of undefined (reading 'useLayoutEffect')` because the dependent chunk evaluated before React initialized. The current safe split keeps React + every React-using library (radix, recharts, framer-motion, react-hook-form, wouter, lucide-react, @tanstack/react-query) in a single `vendor` chunk; only purely-data libs without React imports (date-fns, dayjs, zod) get their own chunks. See `artifacts/qorix-markets/vite.config.ts`.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
