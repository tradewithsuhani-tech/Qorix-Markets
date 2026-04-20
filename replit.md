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
9. **Advanced Analytics**: Equity curve, drawdown chart, profit distribution, risk/return scatter, rolling returns (Chart.js)
10. **Notification System**: Real-time bell icon with badge, dropdown panel, per-event types (deposit, withdrawal, daily_profit, monthly_payout, drawdown_alert, system), mark-read/delete
11. **Admin Panel**: Set daily profit %, view AUM, approve/reject withdrawals, user management
12. **PWA**: manifest.json, service worker, mobile bottom navigation
13. **Qorix Assistant Chatbot**: Floating chat button (bottom-right), predefined flows (How to Start, Investment Guide, Returns, Risk), quick reply buttons, typing animation, "Talk to Expert" escalation, admin chat panel with real-time replies and session resolution
14. **Separate Admin Portal**: Admins use `/admin-login` for a dedicated admin login flow. Admin-only pages use an admin navigation layout with no investor/user menu items.
15. **Upgraded Admin System**: Admin modules include Dashboard, Users, Deposits, Withdrawals, Trading, Wallet, Analytics, System, Logs, Intelligence, Fraud Monitor, and Support Chats. User security controls include freeze/unfreeze, enable/disable, and force logout. System controls include maintenance mode, registration toggle, auto-withdraw limit, and in-app broadcast notifications.

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

## Shared Profit Service

`artifacts/api-server/src/lib/profit-service.ts` exposes:
- `distributeDailyProfit(profitPercent)` — full distribution logic (drawdown check, compounding, equity snapshot, trade simulation, referral bonus, run log)
- `transferProfitToMain()` — monthly sweep of profit_balance → main_balance
- `getLastDailyProfitPercent()` — reads persisted rate from system_settings

## Design

- Dark theme: deep navy/obsidian (HSL 224 71% 4%) + electric blue (#3b82f6)
- Glassmorphism cards (bg-white/5 + backdrop-blur)
- Framer Motion animations
- Mobile bottom navigation + desktop sidebar
- Recharts equity area chart
- PWA installable

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
