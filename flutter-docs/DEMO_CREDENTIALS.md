# Qorix Markets — Demo Account Credentials & Data Guide

> After running the seed script, log in with these credentials to see a fully-populated premium trading experience.

---

## Login Credentials

| Field | Value |
|---|---|
| **Email** | `demo@qorix.markets` |
| **Password** | `Demo@Qorix2026` |
| **API Base** | `https://qorix-api.fly.dev/api` |
| **Local API** | `http://localhost:8080/api` |

### Supporting Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| P2P Seller | `fasttrader99@qorix.markets` | `Seller@Qorix26` | P2P counterparty |
| Referral Sponsor | `sponsor@qorix.markets` | `Sponsor@Qorix26` | Demo's referral parent |

---

## What's Pre-Loaded

### User Profile
```
Name:           Arjun Mehta
Email:          demo@qorix.markets
KYC Status:     Approved (all 3 levels)
Referral Code:  ARJUN7X
TRC20 Address:  TAi8ZdK3mQpLnJvXcYdF7wBzEtA3sHoU9
Points:         2,450
2FA:            Disabled (for easy demo access)
Telegram:       Not linked
```

### Wallet Balances
```
Main Balance (INR):      ₹2,45,000.00
USDT Wallet:             $125.50
Trading Balance (Active): $5,000.00
Profit Balance:           $412.75
─────────────────────────────────────
Total (approx):          ₹5,23,572.50
```

### Active Investment
```
Amount:         $5,000.00 USDT
Risk Level:     Medium (5% drawdown limit)
Status:         ACTIVE (bot trading)
Daily Profit:   $25.48 (~0.48%)
Total Profit:   $412.75
Current Drawdown: 1.24% (comfortable)
Started:        ~40 days ago
Auto-Compound:  OFF
```

### Trading Statistics
```
Total Bot Trades:   150
Win Rate:           ~72%
Symbols:            XAUUSD, EURUSD, BTCUSD, USOIL
Equity History:     90 days of data
Max Drawdown:       ~2.1%
Avg Daily Return:   0.46%
```

### Transaction History
```
Deposits:        4 (2 USDT on-chain + 2 INR)
Withdrawals:     1 (pending — shows pending state)
Profit credits:  38 daily profit distributions
Transfers:       1 (main → trading)
Referral bonus:  2 credits
P2P trade:       1 completed buy
Signal trade:    1 profit credit
Total rows:      ~50
```

### Notifications
```
Total:    11
Unread:   3 (profit, drawdown alert, P2P update)
Read:     8 (deposit, referral, KYC, withdrawals, etc.)
```

### P2P Activity
```
Completed Order #88:   Bought 100 USDT from FastTrader99
  ├── fiatAmount: ₹9,650
  ├── Rate: ₹96.50/USDT
  ├── Payment: GPay
  ├── Chat: 7 messages
  └── Rating: 5★ both ways

LIVE Pending Order:    Buying 50 USDT from FastTrader99
  ├── fiatAmount: ₹4,825
  ├── Countdown: 12 minutes (from seed time)
  ├── Status: pending (pay + mark paid flow)
  └── Chat: 2 messages (seller greeted)
```

---

## How to Run the Seed Script

```bash
# From workspace root
pnpm --filter @workspace/api-server tsx src/scripts/seed-demo.ts
```

The script is **fully idempotent** — running it twice will not create duplicates.

---

## Flutter Testing Flows

### Flow 1 — Dashboard & Bot (Test first)
1. Login with demo credentials
2. `GET /api/dashboard/summary` → see $5,383 total, +$25.48 today
3. `GET /api/investment` → see active bot, 1.24% drawdown
4. `GET /api/equity-chart?days=30` → 30-day growth curve
5. `GET /api/bot-trading/quotes` → live price ticks (poll 1.5s)

### Flow 2 — Wallet & Balances
1. `GET /api/wallet` → 4 balance types
2. `GET /api/transactions?page=1&limit=20` → rich tx history
3. `GET /api/deposit/address` → TRC20 QR address

### Flow 3 — P2P Live Order
1. `GET /api/p2p/orders` → see pending order
2. `GET /api/p2p/orders/{id}/stream?token=...` → SSE connection
3. Test chat messages loading
4. Simulate "Mark as Paid" → watch SSE event

### Flow 4 — Trade History Terminal
1. `GET /api/investment/trades?limit=50` → recent 50 bot trades
2. Check win/loss distribution
3. `GET /api/bot-trading/state` → open positions

### Flow 5 — Notifications
1. `GET /api/notifications` → 11 notifications, 3 unread
2. `PATCH /api/notifications/read-all` → clear badge
3. Verify unreadCount drops to 0

### Flow 6 — Referral
1. `GET /api/referral` → code ARJUN7X, earnings
2. `GET /api/referral/referred-users` → referred users list

---

## Expected API Response Samples

### `GET /api/auth/me`
```json
{
  "id": 1,
  "email": "demo@qorix.markets",
  "fullName": "Arjun Mehta",
  "isAdmin": false,
  "kycStatus": "approved",
  "kycPersonalStatus": "approved",
  "referralCode": "ARJUN7X",
  "emailVerified": true,
  "twoFactorEnabled": false,
  "telegramLinkedAt": null,
  "points": 2450,
  "createdAt": "2026-04-01T10:00:00.000Z"
}
```

### `GET /api/wallet`
```json
{
  "mainBalance": "245000.00000000",
  "tradingBalance": "5000.00000000",
  "profitBalance": "412.75000000",
  "usdtBalance": "125.50000000",
  "points": 2450
}
```

### `GET /api/investment`
```json
{
  "id": 1,
  "amount": "5000.00000000",
  "riskLevel": "medium",
  "isActive": true,
  "isPaused": false,
  "autoCompound": false,
  "totalProfit": "412.75000000",
  "dailyProfit": "25.48000000",
  "drawdown": "1.24",
  "drawdownLimit": "5.00",
  "peakBalance": "5412.75000000"
}
```
