# Qorix Markets — Frozen API Stability Contract

> **Status: FROZEN as of 2026-05-24**
> All response shapes, field names, and error codes in this document are production-stable.
> Flutter clients should depend on exactly these shapes. Any future additions will be additive-only (no removals, no renames).

---

## 1. Universal Envelope Rules

### All Successful Responses

There are three envelope patterns used across the API. Each endpoint uses exactly one.

#### A. Single-Object Envelope
Used by: `/wallet`, `/investment`, `/auth/me`, `/dashboard/summary`, etc.
```json
{ /* flat object with named fields */ }
```

#### B. Paginated List Envelope
Used by: `/transactions`, `/investment/trades`, `/admin/users`, etc.
```json
{
  "data": [ /* array of items */ ],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```
Query params: `?page=1&limit=20` (limit caps vary per endpoint, see below)

#### C. Named-List Envelope (notifications only — legacy, do not replicate)
Used by: `/notifications`
```json
{
  "notifications": [ /* array */ ],
  "unreadCount": 3
}
```

#### D. Raw Array
Used by: `/dashboard/equity-chart`, `/dashboard/pnl-history`, `/referral/referred-users`
```json
[ /* array of items */ ]
```

### All Error Responses

Every error response is one of these two shapes:

**Simple error (most common):**
```json
{ "error": "Short human-readable message" }
```

**Rich error (for actionable errors with machine codes):**
```json
{
  "error": "Short human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "message": "Longer explanation for display"
}
```

**Special state responses (not errors — 200 status):**
```json
{ "requiresVerification": true, "email": "...", "message": "..." }
{ "requires2FA": true, "twoFactorToken": "...", "ttlSeconds": 300 }
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created (register) |
| `400` | Bad request / validation failure |
| `401` | Missing or invalid JWT |
| `403` | Forbidden (KYC, frozen account, origin guard) |
| `404` | Resource not found |
| `409` | Conflict (duplicate email) |
| `429` | Rate limit hit (check `Retry-After` header) |
| `503` | Service unavailable (maintenance mode, demo disabled) |
| `500` | Internal server error |

---

## 2. Authentication Endpoints

### `POST /api/auth/register`
**Request:**
```json
{
  "email": "user@example.com",
  "password": "MinLength8",
  "fullName": "Jane Smith",
  "referralCode": "QX1A2B3C",
  "captchaToken": "<turnstile-token>",
  "_hp": "",
  "_plt": 1748000000000
}
```
**Success 201:**
```json
{
  "requiresVerification": true,
  "email": "user@example.com",
  "message": "Account created. Please verify your email with the OTP we just sent."
}
```
**Errors:**
- `400` `DISPOSABLE_EMAIL` — throwaway email service blocked
- `400` Captcha required
- `409` Email already registered
- `429` Too many accounts from this IP today

---

### `POST /api/auth/login`
**Request:**
```json
{
  "email": "user@example.com",
  "password": "password",
  "captchaToken": "<turnstile-token>"
}
```
**Success (standard):**
```json
{
  "token": "<jwt>",
  "user": { /* UserProfile — see §7 */ }
}
```
**Success (email not verified — 200, not an error):**
```json
{
  "requiresVerification": true,
  "email": "user@example.com",
  "message": "Please verify your email first..."
}
```
**Success (2FA enabled — 200, not an error):**
```json
{
  "requires2FA": true,
  "twoFactorToken": "<short-lived-challenge-jwt>",
  "ttlSeconds": 300
}
```
**Success (new device, single-active-session — 200, not an error):**
```json
{
  "requiresApproval": true,
  "pollToken": "<hex-token>",
  "expiresAt": "2026-05-24T10:30:00.000Z",
  "message": "A new device is requesting access..."
}
```
**Errors:** `401` Invalid credentials · `403` Account restricted · `429` Rate limited (5/min)

---

### `POST /api/auth/verify-email-public`
**Request:** `{ "email": "...", "otp": "123456" }`
**Success:** `{ "token": "<jwt>", "user": { ... } }`
**Errors:** `400` Invalid or expired code · `403` Account restricted

---

### `POST /api/auth/resend-verification`
**Request:** `{ "email": "..." }`
**Success (always 200, enum-safe):** `{ "success": true, "message": "..." }`

---

### `GET /api/auth/me` *(requires Bearer JWT)*
**Success:**
```json
{
  "id": 42,
  "email": "user@example.com",
  "fullName": "Jane Smith",
  "isAdmin": false,
  "adminRole": null,
  "kycStatus": "approved",
  "isDisabled": false,
  "isFrozen": false,
  "referralCode": "QX1A2B3C",
  "emailVerified": true,
  "points": 250,
  "createdAt": "2026-01-15T08:00:00.000Z"
}
```

---

## 3. Wallet Endpoints

### `GET /api/wallet` *(requires Bearer JWT)*
**Success:**
```json
{
  "id": 1,
  "userId": 42,
  "mainBalance": 245000.00,
  "tradingBalance": 5000.00,
  "profitBalance": 412.75,
  "usdtBalance": 125.50,
  "points": 250,
  "updatedAt": "2026-05-24T10:00:00.000Z"
}
```

### `POST /api/wallet/deposit`
**Request:** `{ "amount": 100.00 }`
**Success:** Same shape as `GET /api/wallet` (includes `points`)

### `POST /api/wallet/withdraw`
**Request:**
```json
{
  "amount": 50.00,
  "walletAddress": "TRx...",
  "otp": "123456",
  "source": "profit",
  "usePoints": 100,
  "idempotencyKey": "<uuid>"
}
```
`source` values: `"main"` | `"profit"` | `"usdt"` (default: `"profit"`)
**Success:**
```json
{
  "id": 501,
  "userId": 42,
  "type": "withdrawal",
  "amount": 48.50,
  "status": "pending",
  "description": "Withdrawal from profit to TRx...",
  "createdAt": "2026-05-24T10:00:00.000Z"
}
```
**Errors:**
- `400` `withdrawal_otp_required` — OTP must be sent first via `/auth/withdrawal-otp`
- `400` `invalid_otp` — expired or wrong OTP
- `400` `invalid_idempotency_key`
- `400` `Insufficient profit balance`
- `400` `inr_channel_cap_exceeded` — includes `inrChannelOwed`, `totalBalance`, `maxUsdtWithdrawable`
- `403` `kyc_required`
- `403` `withdrawal_locked_new_account` — includes `message` with hours remaining
- `403` `withdrawal_locked_password_change` — includes `hoursLeft`, `lockedUntil`
- `403` `account_restricted`

### `POST /api/wallet/transfer-to-trading`
**Request:** `{ "amount": 500.00 }`
**Success:** Same shape as `GET /api/wallet`

### `POST /api/wallet/transfer-to-main`
**Request:** `{ "amount": 100.00 }`
**Success:** Same shape as `GET /api/wallet`

---

## 4. Investment Endpoints

### `GET /api/investment` *(requires Bearer JWT)*
**Success:**
```json
{
  "id": 1,
  "userId": 42,
  "amount": 5000.00,
  "riskLevel": "medium",
  "isActive": true,
  "isPaused": false,
  "autoCompound": false,
  "totalProfit": 412.75,
  "dailyProfit": 0.00,
  "drawdown": 0.00,
  "drawdownLimit": 5.00,
  "peakBalance": 5000.00,
  "drawdownFromPeak": 0.0000,
  "recoveryPct": 0.0000,
  "startedAt": "2026-04-14T08:00:00.000Z",
  "stoppedAt": null,
  "pausedAt": null
}
```

### `POST /api/investment/start`
**Request:** `{ "amount": 5000, "riskLevel": "medium" }`
`riskLevel` values: `"low"` | `"medium"` | `"high"`
**Success:** Same shape as `GET /api/investment`

### `POST /api/investment/stop`
**Success:** Same shape as `GET /api/investment` (with `isActive: false`)

### `POST /api/investment/topup`
**Request:** `{ "amount": 500 }`
**Success:** Same shape as `GET /api/investment`
**Errors:** `400` `NO_ACTIVE_INVESTMENT` · `400` Insufficient available trading balance

### `PATCH /api/investment/protection`
**Request:** `{ "drawdownLimit": 5 }` (range: 1–50)
**Success:** Same shape as `GET /api/investment`

### `PATCH /api/investment/compounding`
**Request:** `{ "autoCompound": true }`
**Success:** Same shape as `GET /api/investment`

### `GET /api/investment/trades`
**Query params:** `?page=1&limit=10` (max limit: 100)
**Success:**
```json
{
  "data": [
    {
      "id": 1001,
      "symbol": "XAUUSD",
      "direction": "buy",
      "entryPrice": 2350.50,
      "exitPrice": 2362.75,
      "profit": 12.25,
      "profitPercent": 0.5213,
      "executedAt": "2026-05-24T09:30:00.000Z"
    }
  ],
  "total": 150,
  "page": 1,
  "totalPages": 15
}
```
`direction` values: `"buy"` | `"sell"`

---

## 5. Dashboard Endpoints

### `GET /api/dashboard/summary` *(5s Redis cache, per-user)*
**Success:**
```json
{
  "totalBalance": 125847.25,
  "dailyProfitLoss": 52.50,
  "dailyProfitPercent": 0.4200,
  "dailyPnl": {
    "amount": 52.50,
    "percent": 0.4200,
    "targetPercent": 0.4850,
    "incrementsDone": 2,
    "incrementsTotal": 4,
    "nextChunkAt": 1748260800000,
    "marketClosed": false,
    "marketOpensAt": null
  },
  "activeInvestment": 103500.00,
  "totalProfit": 5847.25,
  "profitBalance": 412.75,
  "tradingBalance": 5000.00,
  "nextPayoutDate": "2026-06-25",
  "daysUntilPayout": 32,
  "riskLevel": "medium",
  "isTrading": true,
  "vip": {
    "tier": "silver",
    "label": "Silver",
    "profitBonus": 0.05,
    "withdrawalFee": 0.015,
    "minAmount": 5000,
    "nextTier": {
      "tier": "gold",
      "label": "Gold",
      "minAmount": 25000,
      "amountNeeded": 20000
    }
  }
}
```
**Header:** `X-Cache: HIT | MISS`

`riskLevel` values: `"low"` | `"medium"` | `"high"` | `null`
`vip.tier` values: `"none"` | `"bronze"` | `"silver"` | `"gold"` | `"platinum"`
`nextChunkAt` — Unix epoch ms for the next P&L chunk; `null` if all 4 done for today
`marketOpensAt` — Unix epoch ms for next Monday 00:00 UTC; `null` on weekdays
`marketClosed` — `true` on Saturday/Sunday UTC

### `GET /api/dashboard/equity-chart`
**Query params:** `?days=30` (1 = intraday hourly; 2–3650 = daily)
**Success — raw array:**
```json
[
  { "date": "2026-04-25", "equity": 118200.00, "profit": 0.00 },
  { "date": "2026-04-26", "equity": 118672.80, "profit": 472.80 }
]
```
Intraday (`days=1`): `date` is a full ISO timestamp. Multi-day: `date` is `"YYYY-MM-DD"`.

### `GET /api/dashboard/pnl-history`
**Query params:** `?days=30` (1–3650)
**Success — raw array:**
```json
[
  { "date": "2026-04-25", "percent": 0.4200, "amount": 52.50 },
  { "date": "2026-04-26", "percent": 0.0000, "amount": 0.00 }
]
```
Weekend days always have `percent: 0, amount: 0`.

### `GET /api/dashboard/performance`
**Success:**
```json
{
  "totalTrades": 150,
  "winRate": 72.00,
  "maxDrawdown": 4.50,
  "avgProfitPerTrade": 1.28,
  "bestTrade": 12.50,
  "worstTrade": -3.20
}
```

---

## 6. Transaction Endpoints

### `GET /api/transactions`
**Query params:** `?page=1&limit=20`
**Success:**
```json
{
  "data": [
    {
      "id": 501,
      "userId": 42,
      "type": "profit",
      "amount": 52.50,
      "status": "completed",
      "description": "Daily profit credit",
      "walletAddress": null,
      "createdAt": "2026-05-24T00:00:00.000Z"
    }
  ],
  "total": 48,
  "page": 1,
  "totalPages": 3
}
```
`type` values: `"deposit"` | `"withdrawal"` | `"profit"` | `"referral_bonus"` | `"investment"` | `"topup"` | `"transfer"` | `"fee"` | `"compounding"`
`status` values: `"pending"` | `"completed"` | `"failed"` | `"cancelled"`

---

## 7. Notification Endpoints

### `GET /api/notifications`
**Query params:** `?limit=20&unread=true`
Note: uses `notifications` key (legacy shape — use `data` for new code)
**Success:**
```json
{
  "notifications": [
    {
      "id": 1,
      "userId": 42,
      "type": "profit",
      "title": "Daily Profit",
      "message": "$52.50 profit credited",
      "isRead": false,
      "createdAt": "2026-05-24T00:00:00.000Z"
    }
  ],
  "unreadCount": 3
}
```
`type` values: `"profit"` | `"deposit"` | `"withdrawal"` | `"referral_bonus"` | `"drawdown_alert"` | `"system"` | `"p2p_update"`

### `PATCH /api/notifications/:id/read`
**Success:** Single notification object (same shape as above)

### `PATCH /api/notifications/read-all`
**Success:** `{ "success": true }`

### `DELETE /api/notifications/:id`
**Success:** `{ "success": true }`

---

## 8. Referral Endpoints

### `GET /api/referral`
**Success:**
```json
{
  "referralCode": "QX1A2B3C",
  "totalReferred": 5,
  "activeReferrals": 3,
  "totalEarned": 0,
  "monthlyEarnings": 0
}
```

### `GET /api/referral/referred-users`
**Success — raw array:**
```json
[
  {
    "id": 100,
    "fullName": "John Doe",
    "email": "john@example.com",
    "investmentAmount": 2000.00,
    "isActive": true,
    "joinedAt": "2026-03-10T08:00:00.000Z"
  }
]
```

---

## 9. Public Endpoints (no auth)

### `GET /api/public/market-indicators`
**Success:**
```json
{
  "activeInvestors": 12847,
  "totalProfitPaid": 2847562.50,
  "avgDailyReturn": 0.42,
  "uptime": 99.97
}
```

---

## 10. VIP Tier Reference

| Tier | Min Investment | Withdrawal Fee | Profit Bonus |
|---|---|---|---|
| `none` | $0 | 2.5% | 0% |
| `bronze` | $1,000 | 2.0% | 1% |
| `silver` | $5,000 | 1.5% | 2% |
| `gold` | $25,000 | 1.0% | 3% |
| `platinum` | $100,000 | 0.5% | 5% |

---

## 11. Auth Header

All authenticated endpoints require:
```
Authorization: Bearer <jwt>
```
JWT payload:
```json
{ "userId": 42, "isAdmin": false, "aud": "markets", "iat": 1748000000, "exp": 1748604800 }
```
Token expiry: **7 days**. No refresh token — re-login on expiry.

---

## 12. Idempotency Pattern (Withdrawals)

Generate a UUID4 per submission attempt. On network retry, reuse the same key.
The server returns the original response without double-debiting.
```dart
final key = const Uuid().v4();
// Use same key on retry
```

---

## 13. Pagination Defaults

| Endpoint | Default limit | Max limit |
|---|---|---|
| `/transactions` | 20 | unlimited (use reasonably) |
| `/investment/trades` | 10 | 100 |
| `/notifications` | 20 | 50 |
| `/admin/users` | 20 | 100 |
