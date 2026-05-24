# Qorix Markets — Enums, Status Values & Type Mappings

> Complete reference for all string enumerations and status codes.
> Use these exact values for equality checks and switch statements.

---

## Transaction Types

```dart
enum TransactionType {
  deposit,         // "deposit"       — USDT added to main balance
  withdrawal,      // "withdrawal"    — USDT sent to external wallet (pending → completed)
  profit,          // "profit"        — Daily AI trading profit credit
  referralBonus,   // "referral_bonus" — Partner activation bonus (3% of referee's first deposit)
  investment,      // "investment"    — Capital deployed to trading strategy
  topup,           // "topup"         — Additional capital added to active strategy
  transfer,        // "transfer"      — Internal move between main ↔ trading balance
  fee,             // "fee"           — Withdrawal fee charged
  compounding,     // "compounding"   — Profit auto-compounded into trading balance
}
```

API string value is the comment value. Use `TransactionType.values.byName(json['type'])` or a switch.

---

## Transaction Statuses

```dart
enum TransactionStatus {
  pending,    // "pending"    — Awaiting admin approval (withdrawals) or on-chain confirmation
  completed,  // "completed"  — Settled, balance updated
  failed,     // "failed"     — Rejected or on-chain failure
  cancelled,  // "cancelled"  — Cancelled by user or admin
}
```

**UI Mapping:**

| Status | Color | Icon | Label |
|---|---|---|---|
| `pending` | Amber | `schedule` | "Processing" |
| `completed` | Green | `check_circle` | "Completed" |
| `failed` | Red | `cancel` | "Failed" |
| `cancelled` | Grey | `block` | "Cancelled" |

---

## Notification Types

```dart
enum NotificationType {
  profit,        // "profit"         — Daily profit credited
  deposit,       // "deposit"        — Deposit confirmed
  withdrawal,    // "withdrawal"     — Withdrawal status update
  referralBonus, // "referral_bonus" — New partner activated
  drawdownAlert, // "drawdown_alert" — Capital protection triggered
  system,        // "system"         — Platform announcements
  p2pUpdate,     // "p2p_update"     — P2P order/chat update
}
```

**Icon Mapping:**

| Type | Icon | Color |
|---|---|---|
| `profit` | `trending_up` | Electric Blue |
| `deposit` | `arrow_downward` | Green |
| `withdrawal` | `arrow_upward` | Amber |
| `referral_bonus` | `people` | Purple |
| `drawdown_alert` | `warning` | Red |
| `system` | `campaign` | Blue |
| `p2p_update` | `swap_horiz` | Cyan |

---

## Investment Risk Levels

```dart
enum RiskLevel {
  low,    // "low"    — 3% drawdown limit
  medium, // "medium" — 5% drawdown limit
  high,   // "high"   — 10% drawdown limit
}
```

**Display mapping:**

| Value | Label | Drawdown | Color |
|---|---|---|---|
| `low` | "Conservative" | 3% | Green |
| `medium` | "Balanced" | 5% | Amber |
| `high` | "Aggressive" | 10% | Red |

---

## KYC Status

```dart
enum KycStatus {
  none,      // "none"      — Never submitted
  pending,   // "pending"   — Documents uploaded, awaiting review
  approved,  // "approved"  — Verified — all features unlocked
  rejected,  // "rejected"  — Rejected — must resubmit
}
```

**Feature gates by KYC status:**

| Feature | none | pending | approved | rejected |
|---|---|---|---|---|
| Deposit | ✅ | ✅ | ✅ | ✅ |
| View dashboard | ✅ | ✅ | ✅ | ✅ |
| Start trading | ❌ | ❌ | ✅ | ❌ |
| Withdraw | ❌ | ❌ | ✅ | ❌ |
| P2P trading | ❌ | ❌ | ✅ | ❌ |

---

## VIP Tiers

```dart
enum VipTier {
  none,      // "none"     — $0+
  bronze,    // "bronze"   — $1,000+
  silver,    // "silver"   — $5,000+
  gold,      // "gold"     — $25,000+
  platinum,  // "platinum" — $100,000+
}
```

**Full tier table:**

| Tier | Min | Fee | Bonus | Label | Badge Color |
|---|---|---|---|---|---|
| `none` | $0 | 2.5% | +0% | "Standard" | Grey |
| `bronze` | $1,000 | 2.0% | +1% | "Bronze" | `#CD7F32` |
| `silver` | $5,000 | 1.5% | +2% | "Silver" | `#C0C0C0` |
| `gold` | $25,000 | 1.0% | +3% | "Gold" | `#FFD700` |
| `platinum` | $100,000 | 0.5% | +5% | "Platinum" | `#E5E4E2` |

---

## Trade Direction

```dart
enum TradeDirection {
  buy,  // "buy"
  sell, // "sell"
}
```

**Display:**

| Value | Label | Color | Icon |
|---|---|---|---|
| `buy` | "LONG" | Green | `arrow_upward` |
| `sell` | "SHORT" | Red | `arrow_downward` |

---

## Trading Symbols

All symbols traded by the AI bot:

```dart
const kTradingSymbols = [
  'XAUUSD',  // Gold/USD
  'EURUSD',  // Euro/USD
  'BTCUSD',  // Bitcoin/USD
  'USOIL',   // WTI Crude Oil
  'GBPUSD',  // GBP/USD
  'USDJPY',  // USD/JPY
];
```

---

## Withdrawal Source

```dart
enum WithdrawalSource {
  main,   // "main"   — Main balance (INR-denominated)
  profit, // "profit" — Profit balance (default)
  usdt,   // "usdt"   — USDT balance
}
```

---

## P2P Order Status

```dart
enum P2pOrderStatus {
  pending,    // "pending"    — Order created, awaiting payment
  paid,       // "paid"       — Buyer marked as paid, awaiting seller confirmation
  completed,  // "completed"  — Trade settled
  cancelled,  // "cancelled"  — Cancelled by either party
  disputed,   // "disputed"   — In dispute resolution
}
```

**UI Flow (Buy order):**
`pending` → buyer pays → `paid` → seller confirms → `completed`

---

## P2P Ad Type

```dart
enum P2pAdType {
  buy,  // "buy"  — Seller wants to buy USDT for INR
  sell, // "sell" — Seller wants to sell USDT for INR
}
```

---

## Admin Role

```dart
enum AdminRole {
  superAdmin,   // "super_admin"  — Full access
  support,      // "support"      — View users, resolve disputes
  finance,      // "finance"      — Approve withdrawals
  operations,   // "operations"   — Trigger profit distribution
}
```

---

## Withdrawal Error Codes (machine-readable)

| Code | Trigger | User Action |
|---|---|---|
| `withdrawal_otp_required` | No OTP provided | Request OTP via `/auth/withdrawal-otp` |
| `invalid_otp` | OTP expired or wrong | Re-request OTP |
| `kyc_required` | KYC not approved | Complete KYC |
| `withdrawal_locked_new_account` | Account < 24h old | Wait (hours shown in `message`) |
| `withdrawal_locked_password_change` | Password changed < 24h ago | Wait (`hoursLeft` + `lockedUntil` in response) |
| `account_restricted` | Account frozen/disabled | Contact support |
| `inr_channel_cap_exceeded` | INR-deposited funds must exit via INR | Use INR withdrawal tab; `maxUsdtWithdrawable` in response |
| `smoke_test_account_blocked` | Test account — no real money flows | N/A (dev only) |
| `invalid_idempotency_key` | Key > 80 chars or not a string | Fix key format |
| `INSUFFICIENT_BALANCE` | Balance too low | Reduce amount |

---

## Auth Error Codes

| Code | HTTP | Trigger |
|---|---|---|
| `DISPOSABLE_EMAIL` | 400 | Throwaway email domain |
| (generic) | 401 | Invalid credentials |
| (generic) | 401 | Expired/invalid JWT |
| (generic) | 403 | Account frozen or disabled |
| `ORIGIN_REQUIRED` | 403 | Direct API access without Origin header |
| (generic) | 409 | Email already registered |

---

## Investment Error Codes

| Error | HTTP | Trigger |
|---|---|---|
| `NO_ACTIVE_INVESTMENT` | 400 | Top-up with no active investment |
| `Insufficient trading balance` | 400 | Not enough in trading wallet to start |
| `Invalid risk level. Use low, medium, or high` | 400 | Bad riskLevel value |
| `drawdownLimit must be a number between 1 and 50` | 400 | Protection patch out of range |

---

## SSE Event Types (P2P Order Stream)

```dart
// EventSource received on /api/p2p/orders/:id/stream?token=<jwt>

const kSseEvents = {
  'ready':         'connection established',
  'order_updated': 'order status changed',
  'chat_message':  'new chat message',
  'payment_proof': 'buyer uploaded payment screenshot',
  'dispute_opened':'dispute raised',
};
```

Event data is JSON. Parse with `jsonDecode(event.data)`.
