# Qorix Markets

## Overview

A premium fintech PWA for automated USDT investment and trading. Users deposit USDT, select a risk level, and the platform simulates daily trading with profit distribution. Includes wallet management, referral system, and an admin panel.

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
      routes/          # auth, wallet, investment, referral, dashboard, admin, transactions
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
    src/schema/        # users, wallets, transactions, investments, trades, equity, settings
```

## Features

1. **Auth**: JWT login/register with bcrypt password hashing
2. **Wallet**: main_balance, trading_balance, profit_balance; deposit/withdraw/transfer
3. **Investment**: Start/stop auto trading, Low/Medium/High risk (3%/5%/10% drawdown limits)
4. **Trading Simulation**: Admin sets daily profit %, distributed across all active investors
5. **Auto Compounding**: Optional — compounds profit back into trading balance
6. **Referral System**: Unique referral codes, sponsor earns 0.5% monthly on active investment
7. **Dashboard**: Animated balances, equity area chart, recent trades, P&L display
8. **Admin Panel**: Set daily profit %, view AUM, approve/reject withdrawals, user management
9. **PWA**: manifest.json, service worker, mobile bottom navigation

## Demo Accounts

- Admin: `admin@qorix.com` / `Admin123!`
- Demo Investor: `demo@qorix.com` / (password hash seeded directly)

## API Routes

All routes prefixed with `/api`:
- POST `/auth/register`, POST `/auth/login`, GET `/auth/me`
- GET/POST `/wallet`, POST `/wallet/deposit`, POST `/wallet/withdraw`, POST `/wallet/transfer`
- GET `/transactions`
- GET/POST `/investment`, POST `/investment/start`, POST `/investment/stop`, PATCH `/investment/compounding`
- GET `/trades`
- GET `/referral`, GET `/referral/referred-users`
- GET `/dashboard/summary`, GET `/dashboard/equity-chart`
- GET `/admin/stats`, POST `/admin/profit`, GET `/admin/users`
- GET `/admin/withdrawals`, POST `/admin/withdrawals/:id/approve`, POST `/admin/withdrawals/:id/reject`

## Design

- Dark theme: deep navy/obsidian (HSL 224 71% 4%) + electric blue (#3b82f6)
- Glassmorphism cards (bg-white/5 + backdrop-blur)
- Framer Motion animations
- Mobile bottom navigation + desktop sidebar
- Recharts equity area chart
- PWA installable

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
