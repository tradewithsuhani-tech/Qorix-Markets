# Qorix Markets — Flutter Architecture Analysis

> Generated: May 2026 | Backend: Express 5 + PostgreSQL + Redis | API: REST + SSE

---

## 1. System Overview

Qorix Markets is a **premium fintech PWA/mobile app** for automated USDT investment and trading. The Flutter app connects to a production-deployed Express API on Fly.io backed by Neon PostgreSQL and Upstash Redis.

```
Flutter App
    │
    ├── REST API  →  https://qorix-api.fly.dev/api
    ├── SSE       →  GET /api/p2p/orders/:id/stream
    └── Polling   →  GET /api/bot-trading/quotes  (1.5s)
                     GET /api/notifications        (30s)
```

---

## 2. Navigation Map

### Bottom Navigation (5 tabs)
```
Tab 1: Dashboard (Home)    →  /dashboard
Tab 2: Trades / Terminal   →  /trades
Tab 3: Wallet              →  /wallet
Tab 4: P2P                 →  /p2p
Tab 5: Profile             →  /profile
```

### Full Screen Map

```
(Public — No Auth)
├── /splash
├── /onboarding
├── /login
├── /signup
├── /forgot-password
├── /reset-password
└── /verify-email

(Auth Required)
├── Dashboard Tab
│   ├── /dashboard                    ← Main home
│   ├── /notifications                ← Notification list
│   └── /risk-select                  ← Risk tier selection modal
│
├── Trades Tab
│   ├── /trades                       ← Trade history list
│   └── /terminal                     ← Live bot trading terminal
│
├── Wallet Tab
│   ├── /wallet                       ← Balance overview + transactions
│   ├── /deposit                      ← Deposit method selector
│   │   ├── /deposit-crypto           ← USDT TRC20 QR address
│   │   ├── /deposit-upi              ← UPI payment flow
│   │   │   └── /deposit-upi-pay      ← UPI deep-link pay screen
│   │   ├── /deposit-netbanking       ← Net Banking form
│   │   │   ├── /deposit-netbanking-details
│   │   │   └── /deposit-netbanking-verify
│   │   └── /deposit-success          ← Confirmation screen
│   ├── /withdraw                     ← Withdraw method + amount
│   │   ├── /withdraw-crypto          ← USDT on-chain withdrawal
│   │   ├── /withdraw-upi             ← UPI payout
│   │   ├── /withdraw-bank            ← IMPS/NEFT bank payout
│   │   └── /withdraw-success         ← Confirmation screen
│   ├── /transfer                     ← Main ↔ Trading balance transfer
│   └── /transaction-history          ← Full paginated TX history
│
├── P2P Tab
│   ├── /p2p                          ← Ad board (Buy/Sell)
│   ├── /p2p/create-ad                ← Post new ad (KYC required)
│   └── /p2p/order/:id                ← Order detail + chat + SSE
│
├── Profile Tab
│   ├── /profile                      ← User info + stats
│   ├── /kyc                          ← KYC status page
│   │   └── /kyc-submit               ← KYC document upload form
│   ├── /income                       ← Referral income + rewards
│   ├── /devices                      ← Trusted devices list
│   ├── /two-factor                   ← 2FA setup/disable
│   ├── /change-password              ← Password change
│   ├── /add-bank                     ← Add bank account
│   └── /deploy                       ← Start/configure auto-trading
│
└── Modals / Overlays
    ├── DrawdownWarningBanner          ← Sticky top banner (auto-triggered)
    ├── MaintenanceModeScreen          ← Full-screen block
    ├── PromoPopup                     ← Welcome/promo popup (delayed)
    └── StopTradingDialog             ← Confirm stop strategy
```

### Protected Route Rules
| Route Category | Requirement |
|---|---|
| All `/wallet/*`, `/trades`, `/terminal` | JWT authenticated |
| `/p2p/create-ad`, `/p2p/order/*` | JWT + KYC approved |
| `/kyc-submit` | JWT + kycStatus == "not_submitted" or "rejected" |
| `/deploy`, `/risk-select` | JWT + has trading balance |
| `/withdraw-crypto` | JWT + no new-device cooldown (24h) |

---

## 3. Auth System

### JWT Flow
```
1. POST /api/auth/login  →  { token, user }
2. Store token in Flutter SecureStorage (flutter_secure_storage)
3. Attach to every request:  Authorization: Bearer <token>
4. Token expires (check 401 responses) → redirect to /login
```

**No refresh token** — tokens are long-lived (30 days). On 401, clear storage and send user to login.

### Email Verification Gate
- After register, user must verify email before login is allowed
- Backend sends OTP to email
- `POST /api/auth/verify-email-public` with `{ email, otp }`
- **Login is blocked** until email is verified (`emailVerified: true`)

### 2FA Flow (TOTP)
```
Login → if response.requires2FA == true:
  Show TOTP input screen
  POST /api/auth/2fa/login-verify  →  { twoFactorToken, code }
  →  { token, user }  on success
```

### Device Binding & Withdrawal Cooldown
- Backend fingerprints device on every request via `X-Device-Fingerprint` header
- New device → email alert sent to user
- **24-hour withdrawal cooldown** on new devices
- Check `GET /api/devices` for `currentSession.withdrawalAllowed`

### Session Headers Required
```http
Authorization: Bearer <jwt>
X-Device-Fingerprint: <sha256_of_device_id>   ← important for security
Content-Type: application/json
```

---

## 4. Trading System Architecture

### Bot Auto-Trading
- User deposits USDT → transfers to Trading balance → starts investment
- Admin sets daily profit % via admin panel
- Profit distributed once/day to all active investors proportionally
- Simulated trades shown in UI (not real exchange trades)

### Trading Pairs (Bot Terminal)
```
XAUUSD  — Gold / USD
EURUSD  — Euro / USD
BTCUSD  — Bitcoin / USD
USOIL   — Crude Oil
```
Live prices via `GET /api/bot-trading/quotes` — poll every **1500ms**

### Investment States
```
not_started → active → paused (drawdown limit hit) → stopped
                ↓
           auto_compounding (optional)
```

### PnL Calculation
```
dailyProfit = investmentAmount × (adminDailyProfitPct / 100)
totalProfit += dailyProfit each day
drawdown = (peakBalance - currentBalance) / peakBalance × 100
Auto-pause if drawdown > drawdownLimit (3% / 5% / 10%)
```

### Risk Levels
| Level | Drawdown Limit | Label |
|---|---|---|
| `low` | 3% | Conservative |
| `medium` | 5% | Moderate |
| `high` | 10% | Aggressive |

---

## 5. Wallet Architecture

### Balance Types
```
mainBalance    — INR deposits (stored as raw INR amount)
usdtBalance    — TRC20 USDT deposits (stored in USD)
tradingBalance — Capital deployed in auto-trading
profitBalance  — Accumulated trading profits
```

### Display Convention
```dart
// INR display rate (hardcoded, admin-configurable in future)
const double INR_DISPLAY_RATE = 98.0;

double totalUsd = (mainBalance / INR_DISPLAY_RATE)
                + usdtBalance
                + tradingBalance
                + profitBalance;

// Show INR:  mainBalance  (already in INR)
// Show USDT: usdtBalance  (in USD)
// Show total: totalUsd * INR_DISPLAY_RATE  (approx INR)
```

### Deposit Flows
```
USDT (TRC20):
  1. GET /api/deposit/address  →  unique TRC20 address per user
  2. User sends USDT on-chain
  3. Backend watcher auto-detects → credits usdtBalance
  4. No manual confirmation needed

INR (UPI/Net Banking):
  1. User selects method + amount
  2. User makes payment to platform UPI/bank
  3. User submits UTR + proof screenshot
  4. Admin approves → credits mainBalance (raw INR)
```

### Withdrawal Flows
```
USDT (on-chain):
  source: "usdt"  →  debits usdtBalance
  POST /api/wallet/withdraw { amount, walletAddress, source: "usdt" }
  Admin approves → on-chain sweep

INR (UPI/Bank):
  POST /api/withdrawals/inr { amountInr, payoutMethod, upiId/bankDetails }
  Admin/Merchant approves → manual payout

Profit withdrawal:
  source: "profit"  →  debits profitBalance
```

### Transfer (Internal)
```
POST /api/wallet/transfer
{ amount: number, direction: "to_trading" | "to_main" }

to_trading:  mainBalance - amount,  tradingBalance + amount
to_main:     tradingBalance - amount, mainBalance + amount
```

---

## 6. P2P System

### Order Lifecycle
```
pending → paid → completed
        ↓         ↓
    cancelled   disputed → resolved
```

### Flow
```
Seller posts SELL ad → USDT locked from usdtBalance into escrow
Buyer creates order → pays fiat (UPI/bank)
Buyer clicks "Mark Paid" → seller gets SSE event
Seller confirms receipt → releases USDT → buyer's usdtBalance credited
```

### SSE Stream (Order Updates)
```
GET /api/p2p/orders/:id/stream?token=<scoped_jwt>

Events:
  order.updated   — status change
  order.paid      — buyer marked paid
  order.completed — USDT released
  order.cancelled — cancelled
  order.disputed  — dispute opened
  chat.message    — new chat message
```

---

## 7. Security Architecture

| Feature | Implementation |
|---|---|
| Rate limiting | Redis-backed, per-IP global + per-route stricter |
| Device fingerprint | SHA-256 of device ID in `X-Device-Fingerprint` header |
| New device alert | Email sent on first login from new device |
| Withdrawal cooldown | 24h lock on new device |
| Honeypot fields | Registration form anti-bot |
| Bot timing detection | Too-fast form fill rejected |
| Multi-account detection | Same device fingerprint → flag |
| Disposable email block | Registration rejects temp-mail domains |
| Email OTP | Required for signup + withdrawals |
| 2FA (TOTP) | Optional Google Authenticator support |
| Maintenance mode | Admin can block all non-admin traffic |
| IP allowlist | Admin panel can be IP-restricted |
| HMAC CSRF | Optional nonce-based CSRF protection |

### Flutter Secure Storage Requirements
```dart
// Store these securely (flutter_secure_storage, not SharedPreferences)
auth_token          — JWT
device_fingerprint  — Persistent device ID (generate once, never change)
biometric_enabled   — User preference
```

---

## 8. Feature Flags — Production Readiness

| Feature | Status | Notes |
|---|---|---|
| Auth (JWT login/register) | ✅ Production | Full email OTP verification |
| USDT TRC20 Deposit | ✅ Production | Auto-detect blockchain watcher |
| Auto-Trading Bot | ✅ Production | Admin-set daily profit |
| Wallet (balances + TX) | ✅ Production | 4 balance types |
| P2P Trading | ✅ Production | Full escrow + SSE |
| Withdrawal (USDT) | ✅ Production | Manual admin approval |
| INR Deposit (UPI/Bank) | ✅ Backend Ready | Admin approval flow |
| INR Withdrawal | ✅ Backend Ready | Merchant/admin payout |
| 2FA (TOTP) | ✅ Production | Optional for users |
| KYC | ⚠️ Partial | Submit works, review is manual |
| Referral system | ✅ Production | Code-based, sponsor tracking |
| Tasks & Points | ✅ Production | Daily/weekly/social tasks |
| Quiz/Giveaways | 🚧 Beta | OpenAPI defined, not fully mounted |
| Telegram Alerts | ✅ Production | User opt-in personal alerts |
| Push Notifications | ⚠️ Not Implemented | In-app polling only (30s) |
| Google OAuth | ✅ Production | `POST /api/auth/google` |
| Promotions/Promo Codes | ✅ Production | HMAC-derived + holiday promos |
| Signal Trades | ✅ Production | Admin-opened, proportional payout |
| Maintenance Mode | ✅ Production | Admin toggle, real-time via PG NOTIFY |

---

## 9. Admin-Controlled Dynamic Features

| Feature | API / Mechanism |
|---|---|
| Daily profit % | Admin sets via `POST /api/admin/profit` |
| Maintenance mode | `system_settings` key `maintenance_mode` |
| Registration toggle | `system_settings` key `registration_enabled` |
| Auto-withdraw limit | `system_settings` key `auto_withdraw_limit` |
| Broadcast notification | `POST /api/admin/broadcast` |
| INR exchange rate | Hardcoded `98` (future: `system_settings`) |
| Promo banners | Hardcoded in frontend (future: API-driven) |

---

## 10. Flutter Architecture Recommendations

### State Management
Use **Riverpod** (recommended) or **BLoC**:
- `AuthNotifier` — login/logout/token state
- `WalletNotifier` — balances, auto-refresh every 30s
- `InvestmentNotifier` — bot status, PnL
- `P2POrderNotifier` — order state + SSE subscription
- `NotificationNotifier` — unread count, list

### HTTP Client
```dart
// Use Dio with interceptors
dio.interceptors.add(AuthInterceptor());  // injects Bearer token
dio.interceptors.add(RetryInterceptor()); // retry on 5xx
dio.interceptors.add(LoggingInterceptor());

// Base options
baseUrl: "https://qorix-api.fly.dev/api"
connectTimeout: Duration(seconds: 10)
receiveTimeout: Duration(seconds: 30)
```

### SSE (P2P Order Stream)
```dart
// Use http package with stream
final client = http.Client();
final request = http.Request('GET', uri);
request.headers['Authorization'] = 'Bearer $scopedToken';
final response = await client.send(request);
response.stream
  .transform(utf8.decoder)
  .transform(LineSplitter())
  .listen(handleSSELine);
```

### Polling Strategy
```
Bot quotes:      Timer.periodic(Duration(milliseconds: 1500), fetchQuotes)
Wallet balance:  Timer.periodic(Duration(seconds: 30), fetchWallet)
Notifications:   Timer.periodic(Duration(seconds: 30), fetchNotifications)
Dashboard:       Timer.periodic(Duration(seconds: 60), fetchDashboard)
```

### Recommended Packages
```yaml
dependencies:
  dio: ^5.x                      # HTTP client
  flutter_secure_storage: ^9.x   # Token/key storage
  riverpod / flutter_riverpod    # State management
  go_router: ^13.x               # Navigation
  qr_flutter: ^4.x               # QR code display (deposit)
  image_picker: ^1.x             # KYC document upload
  local_auth: ^2.x               # Biometric auth (optional)
  cached_network_image: ^3.x     # Image caching
  shimmer: ^3.x                  # Skeleton loading
  fl_chart: ^0.68.x              # Equity/PnL charts
  crypto: ^3.x                   # Device fingerprint SHA-256
```

### Folder Structure
```
lib/
├── core/
│   ├── api/
│   │   ├── dio_client.dart
│   │   ├── auth_interceptor.dart
│   │   └── endpoints.dart
│   ├── auth/
│   │   ├── auth_notifier.dart
│   │   └── secure_storage.dart
│   └── theme/
│       ├── colors.dart
│       └── text_styles.dart
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── wallet/
│   │   ├── deposit/
│   │   └── withdraw/
│   ├── trading/
│   ├── p2p/
│   ├── profile/
│   └── notifications/
├── shared/
│   ├── widgets/
│   │   ├── glass_card.dart
│   │   ├── balance_card.dart
│   │   └── loading_shimmer.dart
│   └── models/
└── main.dart
```

### Environment Configs
```dart
// lib/core/config.dart
class AppConfig {
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://qorix-api.fly.dev/api',
  );
  static const bool isDev = bool.fromEnvironment('IS_DEV', defaultValue: false);
}
```

---

## 11. Mobile Optimization Requirements

| Concern | Strategy |
|---|---|
| Skeleton loaders | Show on every API fetch before data arrives |
| Pull-to-refresh | All list screens |
| Offline caching | Cache wallet + last transactions in Hive/SQLite |
| Token expiry | Catch 401 → clear storage → navigate to login |
| Network errors | Retry up to 3× with exponential backoff |
| Image uploads | Compress before upload (KYC docs) |
| Deep linking | `qorix://` scheme + HTTPS App Links |
| App backgrounding | Pause polling timers, resume on foreground |
| Large lists | Use `ListView.builder` with pagination |
| P2P SSE reconnect | Auto-reconnect with 3s delay on disconnect |
