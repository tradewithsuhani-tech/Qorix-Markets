# Qorix Markets — Mobile API Reference

> Base URL: `https://qorix-api.fly.dev/api`
> All private endpoints require: `Authorization: Bearer <jwt>`
> Content-Type: `application/json`

---

## Auth & Identity

### POST `/auth/register`
Register a new user account.

**Auth:** None  
**Rate Limit:** 5 per IP per hour

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Min8chars1!",
  "fullName": "Rahul Sharma",
  "referralCode": "ABC123"   // optional
}
```

**Response 200:**
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": 42,
    "email": "user@example.com",
    "fullName": "Rahul Sharma",
    "isAdmin": false,
    "referralCode": "XYZ789",
    "emailVerified": false
  },
  "requiresEmailVerification": true
}
```

**Errors:**
- `400` — `"Email already registered"` / validation error
- `403` — `"Registration is currently disabled"`
- `429` — Rate limit exceeded

---

### POST `/auth/verify-email-public`
Verify email with OTP (required before login).

**Auth:** None

**Request:**
```json
{ "email": "user@example.com", "otp": "123456" }
```

**Response 200:**
```json
{
  "token": "eyJhbG...",
  "user": { ...userObject }
}
```

---

### POST `/auth/resend-verification`
Resend email OTP.

**Auth:** None  
**Request:** `{ "email": "user@example.com" }`  
**Response:** `{ "success": true }`

---

### POST `/auth/login`
Login with email + password.

**Auth:** None  
**Rate Limit:** 10 per IP per 15 min

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Min8chars1!",
  "captchaToken": "cf-turnstile-token"  // required in production
}
```

**Response 200 (success):**
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": 42,
    "email": "user@example.com",
    "fullName": "Rahul Sharma",
    "isAdmin": false,
    "referralCode": "XYZ789",
    "emailVerified": true
  }
}
```

**Response 200 (2FA required):**
```json
{
  "requires2FA": true,
  "twoFactorToken": "temp_token_for_2fa_step"
}
```

**Errors:**
- `401` — `"Invalid email or password"`
- `403` — `"Account is disabled"` / `"Account is frozen"`
- `403` — `"Email not verified"` (with `requiresVerification: true`)

---

### POST `/auth/2fa/login-verify`
Complete 2FA login step.

**Auth:** None

**Request:**
```json
{
  "twoFactorToken": "temp_token_from_login",
  "code": "123456"
}
```

**Response 200:** Same as login success `{ token, user }`

---

### POST `/auth/forgot-password`
Request password reset OTP.

**Auth:** None  
**Request:** `{ "email": "user@example.com" }`  
**Response:** `{ "success": true }`

---

### POST `/auth/verify-reset-otp`
Verify OTP for password reset.

**Auth:** None  
**Request:** `{ "email": "user@example.com", "otp": "123456" }`  
**Response:** `{ "resetCode": "one_time_code" }`

---

### POST `/auth/reset-password`
Set new password.

**Auth:** None  
**Request:** `{ "email": "...", "otp": "...", "password": "NewPass1!" }`  
**Response:** `{ "success": true }`

---

### GET `/auth/me`
Get current authenticated user.

**Auth:** Required  
**Response 200:**
```json
{
  "id": 42,
  "email": "user@example.com",
  "fullName": "Rahul Sharma",
  "isAdmin": false,
  "kycStatus": "approved",
  "referralCode": "XYZ789",
  "emailVerified": true,
  "twoFactorEnabled": false,
  "telegramLinkedAt": null,
  "createdAt": "2026-01-15T10:00:00Z"
}
```

---

### POST `/auth/change-password`
Change password (logged in).

**Auth:** Required

**Request:**
```json
{ "currentPassword": "OldPass1!", "newPassword": "NewPass1!" }
```

**Response 200:**
```json
{
  "success": true,
  "message": "Password changed",
  "passwordChangedAt": "2026-05-24T10:00:00Z",
  "withdrawalLockedUntil": "2026-05-25T10:00:00Z",
  "withdrawalLockHours": 24
}
```

---

### POST `/auth/google`
Google OAuth login.

**Auth:** None  
**Request:** `{ "idToken": "google_id_token" }`  
**Response 200:** `{ token, user }`

---

## KYC

### GET `/kyc/status`
Get user KYC status.

**Auth:** Required  
**Response:**
```json
{
  "kycStatus": "approved",
  "kycPersonalStatus": "approved",
  "kycAddressStatus": "not_submitted",
  "submittedAt": "2026-03-10T10:00:00Z",
  "reviewedAt": "2026-03-11T10:00:00Z",
  "rejectionReason": null
}
```

**kycStatus values:** `not_submitted` | `pending` | `approved` | `rejected`

---

### POST `/kyc/submit`
Submit KYC documents.

**Auth:** Required  
**Content-Type:** `multipart/form-data` or JSON with base64

**Request:**
```json
{
  "fullName": "Rahul Sharma",
  "documentType": "aadhaar",
  "documentNumber": "1234-5678-9012",
  "documentImage": "data:image/jpeg;base64,..."
}
```

**Response:** `{ "success": true, "status": "pending" }`

---

## Wallet

### GET `/wallet`
Get all wallet balances.

**Auth:** Required

**Response 200:**
```json
{
  "mainBalance": "12500.00000000",
  "tradingBalance": "5000.00000000",
  "profitBalance": "380.50000000",
  "usdtBalance": "150.25000000",
  "points": 250
}
```

> `mainBalance` = raw INR amount  
> `usdtBalance` = USD amount  
> `tradingBalance` / `profitBalance` = USD amount

---

### GET `/deposit/address`
Get user's personal TRC20 USDT deposit address.

**Auth:** Required  
**Response 200:**
```json
{
  "address": "TRx9K8mQ2pLnJ4vXcYdF7wBzEtA3sHoU1",
  "network": "TRC20",
  "asset": "USDT",
  "minimumDeposit": 1,
  "confirmationsRequired": 1
}
```

---

### POST `/wallet/withdraw`
Request USDT withdrawal.

**Auth:** Required

**Request:**
```json
{
  "amount": 50.0,
  "walletAddress": "TRx9K8mQ2pLnJ4vXcYdF7wBzEtA3sHoU1",
  "otp": "123456",
  "source": "usdt",
  "usePoints": false
}
```

> `source` values: `"usdt"` | `"profit"` | `"main"`  
> `otp` = email OTP (requested separately)

**Response 200:**
```json
{
  "success": true,
  "transactionId": 1234,
  "amount": "50.00000000",
  "status": "pending"
}
```

**Errors:**
- `400` — `"Insufficient balance"`
- `403` — `"Withdrawal locked — new device cooldown (22h remaining)"`
- `403` — `"Withdrawal locked — password changed recently"`

---

### POST `/wallet/transfer`
Transfer between main and trading balance.

**Auth:** Required

**Request:**
```json
{
  "amount": 100.0,
  "direction": "to_trading"
}
```

> `direction`: `"to_trading"` | `"to_main"`

**Response 200:**
```json
{
  "success": true,
  "mainBalance": "12400.00",
  "tradingBalance": "5100.00"
}
```

---

### POST `/wallet/deposit`
Manual deposit (legacy/admin use).

**Auth:** Required  
**Request:** `{ "amount": 100.0 }`  
**Response:** `{ "success": true }`

---

## Transactions

### GET `/transactions`
Paginated transaction history.

**Auth:** Required  
**Query:** `?page=1&limit=20&type=deposit`

> `type` filter: `deposit` | `withdrawal` | `profit` | `transfer` | `referral_bonus` | all

**Response 200:**
```json
{
  "data": [
    {
      "id": 501,
      "type": "deposit",
      "amount": "150.25000000",
      "status": "completed",
      "description": "USDT TRC20 deposit",
      "walletAddress": null,
      "txHash": "abc123def456...",
      "createdAt": "2026-05-20T14:30:00Z"
    }
  ],
  "total": 48,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

## Investments (Auto-Trading)

### GET `/investment`
Get current investment status.

**Auth:** Required  
**Response 200:**
```json
{
  "id": 7,
  "amount": "5000.00000000",
  "riskLevel": "medium",
  "isActive": true,
  "isPaused": false,
  "autoCompound": false,
  "totalProfit": "380.50000000",
  "dailyProfit": "25.00000000",
  "drawdown": "1.20",
  "drawdownLimit": "5.00",
  "peakBalance": "5380.50000000",
  "startedAt": "2026-04-15T10:00:00Z",
  "stoppedAt": null
}
```

---

### POST `/investment/start`
Start auto-trading.

**Auth:** Required

**Request:**
```json
{
  "amount": 5000.0,
  "riskLevel": "medium"
}
```

> `riskLevel`: `"low"` (3% drawdown) | `"medium"` (5%) | `"high"` (10%)

**Response 200:**
```json
{ "success": true, "investment": { ...investmentObject } }
```

**Errors:**
- `400` — `"Insufficient trading balance"`
- `400` — `"Investment already active"`

---

### POST `/investment/stop`
Stop auto-trading and return capital to main balance.

**Auth:** Required  
**Request:** `{}`  
**Response:** `{ "success": true, "capitalReturned": 5380.50 }`

---

### POST `/investment/topup`
Add more capital to active investment.

**Auth:** Required  
**Request:** `{ "amount": 500.0 }`  
**Response:** `{ "success": true, "newAmount": 5500.0 }`

---

### PATCH `/investment/protection`
Update drawdown limit.

**Auth:** Required  
**Request:** `{ "drawdownLimit": 3.0 }`  
**Response:** `{ "success": true }`

---

### PATCH `/investment/compounding`
Toggle auto-compounding.

**Auth:** Required  
**Request:** `{ "autoCompound": true }`  
**Response:** `{ "success": true }`

---

### GET `/investment/trades`
Recent simulated bot trades.

**Auth:** Required  
**Query:** `?limit=50`

**Response 200:**
```json
[
  {
    "id": 101,
    "symbol": "XAUUSD",
    "direction": "buy",
    "entryPrice": "2341.50",
    "exitPrice": "2356.80",
    "profit": "15.30",
    "profitPercent": "0.6537",
    "executedAt": "2026-05-24T09:15:00Z"
  }
]
```

---

## Dashboard

### GET `/dashboard/summary`
Main dashboard stats.

**Auth:** Required  
**Response 200:**
```json
{
  "totalBalance": 17880.75,
  "dailyProfitLoss": 25.50,
  "dailyProfitPercent": 0.483,
  "activeInvestment": true,
  "riskLevel": "medium",
  "tradingBalance": 5000.0,
  "profitBalance": 380.50
}
```

---

### GET `/dashboard/performance`
Detailed analytics.

**Auth:** Required  
**Response 200:**
```json
{
  "winRate": 73.2,
  "totalTrades": 41,
  "maxDrawdown": 1.8,
  "sharpeRatio": 2.14,
  "avgDailyReturn": 0.48
}
```

---

### GET `/equity-chart`
Equity curve data points.

**Auth:** Required  
**Query:** `?days=30`

**Response 200:**
```json
[
  { "date": "2026-04-24", "equity": 5000.0, "profit": 0.0 },
  { "date": "2026-04-25", "equity": 5024.0, "profit": 24.0 }
]
```

---

## Bot Trading Terminal

### GET `/bot-trading/quotes`
Live price feed for terminal.

**Auth:** None  
**Cache:** `no-store` — poll every **1500ms**

**Response 200:**
```json
{
  "quotes": [
    {
      "symbol": "XAUUSD",
      "bid": 2341.48,
      "ask": 2341.62,
      "change": 0.34,
      "changePct": 0.0145
    },
    { "symbol": "EURUSD", "bid": 1.0854, "ask": 1.0856, "change": -0.0012, "changePct": -0.0011 },
    { "symbol": "BTCUSD", "bid": 67240.0, "ask": 67260.0, "change": 840.0, "changePct": 0.0126 },
    { "symbol": "USOIL", "bid": 78.42, "ask": 78.46, "change": -0.18, "changePct": -0.0023 }
  ],
  "updatedAt": "2026-05-24T10:30:01.234Z"
}
```

---

### GET `/bot-trading/state`
Bot engine state + open positions.

**Auth:** Required  
**Cache:** `no-store`

**Response 200:**
```json
{
  "planProgress": 68,
  "dailyTargetPct": 0.5,
  "dailyEarnedPct": 0.34,
  "openPositions": [
    {
      "id": "pos_001",
      "symbol": "XAUUSD",
      "direction": "buy",
      "size": 0.1,
      "entryPrice": 2338.40,
      "currentPrice": 2341.48,
      "unrealizedPnl": 30.80,
      "openedAt": "2026-05-24T09:00:00Z"
    }
  ],
  "distributionShares": [
    { "userId": 42, "sharePct": 2.3, "amountUsd": 5.75 }
  ]
}
```

---

## Signal Trades

### GET `/signal-trades`
Admin-opened signal trade history.

**Auth:** Required  
**Response 200:**
```json
[
  {
    "id": 5,
    "symbol": "BTCUSD",
    "direction": "buy",
    "entryPrice": "65000.0",
    "exitPrice": "67200.0",
    "profitPct": "3.38",
    "userProfit": "16.92",
    "closedAt": "2026-05-20T15:00:00Z"
  }
]
```

---

## P2P Trading

### GET `/p2p/ads`
List active P2P ads.

**Auth:** Required  
**Query:** `?type=SELL&paymentMethod=upi`

**Response 200:**
```json
{
  "ads": [
    {
      "id": 15,
      "userId": 8,
      "merchantName": "Raj Traders",
      "type": "SELL",
      "asset": "USDT",
      "fiatCurrency": "INR",
      "price": "96.50",
      "quantity": "500.0",
      "filledQuantity": "120.0",
      "minLimit": "500.0",
      "maxLimit": "50000.0",
      "paymentMethods": ["upi", "bank_transfer"],
      "timeLimit": 15,
      "status": "active"
    }
  ]
}
```

---

### POST `/p2p/ads`
Create a P2P ad.

**Auth:** Required + KYC approved

**Request:**
```json
{
  "type": "SELL",
  "price": 96.50,
  "quantity": 500.0,
  "minLimit": 500.0,
  "maxLimit": 50000.0,
  "paymentMethods": ["upi", "bank_transfer"],
  "terms": "Payment within 15 minutes only",
  "timeLimit": 15
}
```

**Response 201:** `{ "ad": { ...adObject } }`

---

### POST `/p2p/orders`
Create a P2P order (buy from/sell to an ad).

**Auth:** Required + KYC

**Request:**
```json
{
  "adId": 15,
  "fiatAmount": 9650.0,
  "paymentMethod": "upi"
}
```

**Response 201:**
```json
{
  "order": {
    "id": 88,
    "adId": 15,
    "buyerId": 42,
    "sellerId": 8,
    "fiatAmount": "9650.00",
    "usdtAmount": "100.00000000",
    "price": "96.50",
    "paymentMethod": "upi",
    "status": "pending",
    "paymentDeadline": "2026-05-24T10:45:00Z",
    "streamToken": "scoped_jwt_for_sse"
  }
}
```

---

### GET `/p2p/orders/:id`
Order detail + chat messages.

**Auth:** Required (buyer or seller)

**Response 200:**
```json
{
  "order": { ...orderObject },
  "chatMessages": [
    {
      "id": 1,
      "senderId": 42,
      "senderRole": "buyer",
      "message": "Payment sent via GPay",
      "sentAt": "2026-05-24T10:32:00Z"
    }
  ]
}
```

---

### POST `/p2p/orders/:id/pay`
Mark payment sent (buyer action).

**Auth:** Required (buyer only)  
**Request:** `{ "paymentRef": "GPay ref 123456", "paymentProofUrl": "..." }`  
**Response:** `{ "success": true, "status": "paid" }`

---

### POST `/p2p/orders/:id/release`
Release USDT to buyer (seller action).

**Auth:** Required (seller only)  
**Request:** `{}`  
**Response:** `{ "success": true, "status": "completed" }`

---

## Notifications

### GET `/notifications`
User notification list. Poll every 30s.

**Auth:** Required  
**Query:** `?page=1&limit=20`

**Response 200:**
```json
{
  "notifications": [
    {
      "id": 200,
      "type": "deposit",
      "title": "USDT Deposit Received",
      "message": "150.25 USDT has been credited to your wallet.",
      "isRead": false,
      "createdAt": "2026-05-24T09:15:00Z"
    }
  ],
  "unreadCount": 3
}
```

**Notification types:** `deposit` | `withdrawal` | `trade` | `kyc` | `system` | `promo` | `p2p`

---

### PATCH `/notifications/read-all`
Mark all notifications as read.

**Auth:** Required  
**Response:** `{ "success": true }`

---

### PATCH `/notifications/:id/read`
Mark one notification as read.

**Auth:** Required  
**Response:** `{ "success": true }`

---

## Referrals

### GET `/referral`
Get referral stats.

**Auth:** Required  
**Response 200:**
```json
{
  "referralCode": "XYZ789",
  "totalReferrals": 5,
  "totalEarnings": "125.50",
  "pendingEarnings": "25.00",
  "referralLink": "https://qorix.markets/signup?ref=XYZ789"
}
```

---

### GET `/referral/referred-users`
List users referred by current user.

**Auth:** Required  
**Response 200:**
```json
{
  "users": [
    {
      "id": 55,
      "fullName": "Priya K",
      "joinedAt": "2026-03-15T10:00:00Z",
      "kycApproved": true,
      "hasDeposited": true
    }
  ]
}
```

---

## Tasks & Points

### GET `/tasks`
Available reward tasks.

**Auth:** Required  
**Response 200:**
```json
{
  "tasks": [
    {
      "id": 1,
      "slug": "daily_login",
      "title": "Daily Login",
      "description": "Log in every day",
      "category": "daily",
      "pointReward": 10,
      "isCompleted": true,
      "completedAt": "2026-05-24T08:00:00Z",
      "requiresKyc": false
    }
  ],
  "totalPoints": 250
}
```

---

### POST `/tasks/:id/claim`
Claim a task reward.

**Auth:** Required  
**Request:** `{ "proof": "optional_proof_url_or_text" }`  
**Response:** `{ "success": true, "pointsAwarded": 10, "newTotal": 260 }`

---

## Promotions

### POST `/promo/redeem`
Apply a promo code.

**Auth:** Required  
**Request:** `{ "code": "WELCOME50" }`  
**Response 200:**
```json
{
  "success": true,
  "type": "bonus_usdt",
  "value": 50.0,
  "message": "50 USDT bonus credited!"
}
```

---

## Security / Devices

### GET `/devices`
List trusted devices.

**Auth:** Required  
**Response 200:**
```json
{
  "devices": [
    {
      "id": "dev_001",
      "browser": "Chrome Mobile",
      "os": "Android 14",
      "firstSeenAt": "2026-05-01T10:00:00Z",
      "lastSeenAt": "2026-05-24T09:00:00Z",
      "city": "Mumbai",
      "country": "India",
      "isCurrent": true,
      "withdrawalLocked": false,
      "withdrawalUnlockAt": null,
      "withdrawalUnlockHoursLeft": 0
    }
  ],
  "cooldownHours": 24,
  "currentDeviceTracked": true,
  "currentSession": {
    "withdrawalAllowed": true
  }
}
```

---

## 2FA (TOTP)

### GET `/security/2fa/status`
**Auth:** Required  
**Response:** `{ "enabled": false, "backupCodesRemaining": 0, "enabledAt": null }`

---

### POST `/security/2fa/setup`
Generate TOTP QR code.

**Auth:** Required  
**Response:**
```json
{
  "qrDataUrl": "data:image/png;base64,...",
  "manualCode": "JBSWY3DPEHPK3PXP",
  "issuer": "QorixMarkets",
  "accountName": "user@example.com"
}
```

---

### POST `/security/2fa/verify-setup`
Confirm TOTP code to enable 2FA.

**Auth:** Required  
**Request:** `{ "code": "123456" }`  
**Response:**
```json
{
  "enabled": true,
  "backupCodes": ["AAAA-BBBB", "CCCC-DDDD", "..."]
}
```

---

### POST `/security/2fa/disable`
Disable 2FA.

**Auth:** Required  
**Request:** `{ "password": "MyPass1!", "code": "123456" }`  
**Response:** `{ "enabled": false }`

---

## Error Response Format

All errors follow this shape:
```json
{
  "error": "Human-readable error message",
  "code": "OPTIONAL_ERROR_CODE",
  "field": "optional_field_name"
}
```

### Common HTTP Status Codes
| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Bad request / validation error |
| `401` | Unauthorized (token missing/expired) |
| `403` | Forbidden (account frozen/disabled, cooldown active) |
| `404` | Resource not found |
| `409` | Conflict (duplicate, already exists) |
| `429` | Rate limit exceeded |
| `500` | Server error |
| `503` | Maintenance mode active |

### Maintenance Mode Response
```json
HTTP 503
{
  "error": "Platform is under scheduled maintenance. Back soon.",
  "maintenance": true,
  "estimatedEnd": "2026-05-24T12:00:00Z"
}
```

---

## Pagination Pattern

All list endpoints return:
```json
{
  "data": [...],
  "total": 48,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

Query params: `?page=1&limit=20`

---

## Rate Limits Summary

| Endpoint | Limit |
|---|---|
| `POST /auth/login` | 10 req / 15 min per IP |
| `POST /auth/register` | 5 req / hour per IP |
| `POST /auth/forgot-password` | 3 req / hour per IP |
| `POST /security/2fa/*` | 10 req / 15 min |
| All other `/api/*` | 200 req / min per IP |
