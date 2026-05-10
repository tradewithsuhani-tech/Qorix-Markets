# Qorix Markets — Complete System Architecture Analysis
> Flutter Rebuild Reference Document | Generated: May 2026

---

## TABLE OF CONTENTS

1. [Tech Stack](#1-tech-stack)
2. [All Pages / Screens](#2-all-pages--screens)
3. [Navigation Structure](#3-navigation-structure)
4. [User Flow — Login to Trading](#4-user-flow--login-to-trading)
5. [Features and Modules](#5-features-and-modules)
6. [User Roles and Permissions](#6-user-roles-and-permissions)
7. [Authentication System](#7-authentication-system)
8. [Wallet System](#8-wallet-system)
9. [Deposit Process](#9-deposit-process)
10. [Withdraw Process](#10-withdraw-process)
11. [Trading System](#11-trading-system)
12. [Referral System](#12-referral-system)
13. [Gamification Features](#13-gamification-features)
14. [Admin Panel Features](#14-admin-panel-features)
15. [Merchant Portal](#15-merchant-portal)
16. [Database Structure](#16-database-structure)
17. [All Backend APIs](#17-all-backend-apis)
18. [Notification System](#18-notification-system)
19. [AI Features](#19-ai-features)
20. [Real-time Features](#20-real-time-features)
21. [Charts and Market Data](#21-charts-and-market-data)
22. [Payment Methods](#22-payment-methods)
23. [Third-party Services](#23-third-party-services)
24. [Automation and Bots](#24-automation-and-bots)
25. [Anti-fraud and Security](#25-anti-fraud-and-security)
26. [Full App Map](#26-full-app-map)
27. [Screen Hierarchy](#27-screen-hierarchy)
28. [Feature Hierarchy](#28-feature-hierarchy)
29. [API Flow Structure](#29-api-flow-structure)

---

## 1. TECH STACK

### Frontend (Web — to be replaced with Flutter)
| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 7 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Routing | Wouter |
| State/Data | TanStack React Query v5 |
| Charts | Recharts |
| UI Components | Radix UI primitives (shadcn-style) |
| PWA | Service Worker + Web App Manifest |
| Theme | Dark (Deep Navy / Obsidian + Electric Blue) |

### Backend (API — stays unchanged in Flutter rebuild)
| Layer | Technology |
|---|---|
| Runtime | Node.js 24 |
| Framework | Express 5 |
| Language | TypeScript |
| ORM | Drizzle ORM |
| Validation | Zod v4 + Drizzle-Zod |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Queue | BullMQ (Redis-backed) |
| API Codegen | Orval (OpenAPI → React Query hooks) |
| Logging | Pino |

### Database & Infrastructure
| Layer | Technology |
|---|---|
| Primary DB | PostgreSQL (Neon.tech — managed) |
| Cache | Redis (Upstash) |
| Hosting | Fly.io (multi-region: Singapore, Mumbai) |
| CDN / Proxy | Cloudflare |
| Email | AWS SES |
| SMS / Voice OTP | 2Factor.in |
| CAPTCHA | Cloudflare Turnstile |
| Blockchain | TRON / TronGrid (TRC20 USDT) |
| AI | OpenAI GPT (gpt-5-mini) |
| Messaging | Telegram Bot API |
| Package Manager | pnpm workspaces (monorepo) |

### Flutter Equivalent Recommendations
| Web Tech | Flutter Equivalent |
|---|---|
| React Query | Riverpod + Dio / http |
| Wouter (routing) | GoRouter |
| Framer Motion | flutter_animate / AnimationController |
| Recharts | fl_chart |
| Tailwind dark theme | ThemeData (dark) |
| PWA | Native app install |
| localStorage | flutter_secure_storage |
| WebSocket / SSE | web_socket_channel |

---

## 2. ALL PAGES / SCREENS

### Public / Marketing Pages (Unauthenticated)
| # | Screen | Path | Purpose |
|---|---|---|---|
| 1 | Home / Landing | `/` | Marketing hero, features, CTA |
| 2 | About | `/about` | Company info |
| 3 | AI Trading | `/ai-trading` | Feature explanation page |
| 4 | Low Investment | `/low-investment` | Marketing page |
| 5 | Zero Fee | `/zero-fee` | Marketing page |
| 6 | Blog Index | `/blog` | Article list |
| 7 | Blog Post | `/blog/:slug` | Individual article |
| 8 | Contact | `/contact` | Contact form |
| 9 | Market Insights | `/market-insights` | Live market data (public) |

### Legal Pages
| # | Screen | Path |
|---|---|---|
| 10 | Terms & Conditions | `/legal/terms` |
| 11 | Privacy Policy | `/legal/privacy` |
| 12 | Risk Disclosure | `/legal/risk-disclosure` |
| 13 | AML / KYC Policy | `/legal/aml-kyc` |

### Auth Pages (Public only — redirects if logged in)
| # | Screen | Path | Purpose |
|---|---|---|---|
| 14 | Login | `/login` | Email + password login |
| 15 | Register | `/register` | New user signup |
| 16 | Forgot Password | `/forgot-password` | Password reset via OTP |
| 17 | Email Verify | `/verify` or `/verify/:hashId` | Email verification |
| 18 | Admin Login | `/admin-login` | Separate admin login portal |

### User Dashboard (Protected — must be logged in)
| # | Screen | Path | Purpose |
|---|---|---|---|
| 19 | Dashboard | `/dashboard` | Home overview, balances, equity |
| 20 | Wallet | `/wallet` | All three balances, quick actions |
| 21 | Portfolio | `/portfolio` | Investment breakdown, performance |
| 22 | Analytics | `/analytics` | Equity curve, drawdown charts |
| 23 | Transactions | `/transactions` | Full transaction history |
| 24 | Trade Activity | `/trade-activity` | Individual trade records |
| 25 | Trading Desk | `/trading-desk` | Signal trade live view |
| 26 | Signal History | `/signal-history` | Past signal trades |
| 27 | Invest | `/invest` | Start/stop auto-trading, risk selector |
| 28 | Self Trade | `/self-trade` | Manual single trade entry |
| 29 | Referral | `/referral` | Referral link, stats, team list |
| 30 | Rewards | `/rewards` | Reward redemption, VIP level |
| 31 | Tasks | `/tasks` | Daily/weekly/social tasks |
| 32 | Market Insights | `/market-insights` | Live indicators (authenticated view) |
| 33 | Settings | `/settings` | Profile, password, 2FA, Telegram |
| 34 | Devices | `/devices` | Trusted device management |
| 35 | KYC | `/kyc` | Identity verification wizard |

### Deposit Flow (Protected — multi-step)
| # | Screen | Path | Purpose |
|---|---|---|---|
| 36 | Deposit Hub | `/deposit` | Choose deposit method |
| 37 | UPI Deposit | `/deposit/upi` | Select UPI payment method |
| 38 | UPI Pay | `/deposit/upi/pay` | Show UPI QR + UTR input |
| 39 | Net Banking | `/deposit/netbanking` | Select bank account |
| 40 | Net Banking Details | `/deposit/netbanking/details` | Account details + UTR input |
| 41 | Deposit Verify | `/deposit/verify` | Awaiting admin approval |
| 42 | Crypto Deposit | `/deposit/crypto` | TRON USDT wallet address + QR |
| 43 | Deposit Success | `/deposit/success` | Confirmation screen |

### Withdraw Flow (Protected — multi-step)
| # | Screen | Path | Purpose |
|---|---|---|---|
| 44 | Withdraw Hub | `/withdraw` | Choose withdraw type |
| 45 | Withdraw USDT | `/withdraw/usdt` | On-chain USDT withdrawal |
| 46 | Withdraw INR | `/withdraw/inr` | INR bank transfer |
| 47 | User Transfer | `/withdraw/user-transfer` | Transfer USDT to another user |
| 48 | Review | `/withdraw/review` | Confirm withdrawal details |
| 49 | OTP Verify | `/withdraw/otp` | Email OTP confirmation |
| 50 | Success | `/withdraw/success` | Withdrawal submitted |

### Admin Panel (Admin only)
| # | Screen | Path |
|---|---|---|
| 51 | Admin Dashboard | `/admin` |
| 52 | Users Management | `/admin/users` |
| 53 | Deposits Review | `/admin/deposits` |
| 54 | Withdrawals Approval | `/admin/withdrawals` |
| 55 | Trading Control | `/admin/trading` |
| 56 | Wallet / Ledger | `/admin/wallet` |
| 57 | Analytics | `/admin/analytics` |
| 58 | System Settings | `/admin/system` |
| 59 | Server Logs | `/admin/logs` |
| 60 | Intelligence / AML | `/admin/intelligence` |
| 61 | Fraud Flags | `/admin/fraud` |
| 62 | KYC Queue | `/admin/kyc` |
| 63 | Signal Trades | `/admin/signal-trades` |
| 64 | Payment Methods | `/admin/payment-methods` |
| 65 | Subscriptions | `/admin/subscriptions` |
| 66 | Sub-Admins / RBAC | `/admin/sub-admins` |
| 67 | Merchants | `/admin/merchants` |
| 68 | Escalation Contacts | `/admin/escalation-contacts` |
| 69 | Task Proofs | `/admin/task-proofs` |
| 70 | Chats / Leads | `/admin/chats` |
| 71 | Communication | `/admin/communication` |
| 72 | Content / Blog | `/admin/content`, `/admin/blog` |
| 73 | Hidden Features | `/admin/hidden-features` |
| 74 | Test Mode | `/admin/test` |

### Merchant Portal (Separate login)
| # | Screen | Path |
|---|---|---|
| 75 | Merchant Login | `/merchant/login` |
| 76 | Merchant Dashboard | `/merchant` |
| 77 | Payment Methods | `/merchant/methods` |
| 78 | Deposits | `/merchant/deposits` |
| 79 | Withdrawals | `/merchant/withdrawals` |
| 80 | Settings | `/merchant/settings` |

**TOTAL: 80 screens**

---

## 3. NAVIGATION STRUCTURE

### Mobile Bottom Navigation (5 tabs)
```
[ Dashboard ] [ Wallet ] [ Invest ] [ Referral ] [ More ]
```

### Desktop Sidebar Navigation
```
Dashboard
Wallet
  ├── Deposit
  └── Withdraw
Invest
  ├── Portfolio
  ├── Analytics
  └── Trading Desk
Referral
  ├── Rewards
  └── Tasks
Market Insights
Settings
  ├── KYC
  ├── Devices
  └── Security
```

### Flutter Navigation Recommendation
- Use **GoRouter** with nested shell routes
- Bottom navigation bar (5 items): Dashboard, Wallet, Invest, Referral, Profile
- Multi-step flows (Deposit, Withdraw): use GoRouter push stack
- Admin panel: separate Navigator stack behind admin guard
- Merchant portal: completely separate MaterialApp or shell route

---

## 4. USER FLOW — LOGIN TO TRADING

```
STEP 1: LANDING
User visits app → sees marketing hero
→ clicks "Get Started" / "Login"

STEP 2: REGISTRATION
Fill form: Full Name, Email, Password
Honeypot + timing bot checks run server-side
Disposable email blocked
CAPTCHA (Cloudflare Turnstile) verified
→ Account created
→ Email verification OTP sent via AWS SES

STEP 3: EMAIL VERIFICATION
User enters 6-digit OTP from email
→ Email marked verified
→ Redirected to Dashboard

STEP 4: LOGIN (returning user)
Email + Password submitted
→ If 2FA enabled: TOTP code or email fallback OTP
→ If new device: Login approval request sent to existing device
→ JWT token issued (access + refresh)
→ Device fingerprint stored
→ New device alert email sent

STEP 5: DASHBOARD
Sees: Main Balance, Trading Balance, Profit Balance
Sees: Daily P&L, Total Equity, Equity Curve chart
Sees: Running signal trades, notifications bell

STEP 6: KYC (optional but required for some actions)
Level 1: Personal info (name, DOB, phone)
Level 2: Document upload (Aadhaar/Passport)
Level 3: Address verification
→ Admin reviews and approves

STEP 7: DEPOSIT
Choose method: UPI / Net Banking / TRON USDT
INR path: select merchant payment method → transfer money → upload UTR proof
→ Merchant/Admin approves → funds credited to Main Balance

USDT path: copy TRON wallet address → send USDT on-chain
→ On-chain monitor detects transaction → auto-credited to Main Balance

STEP 8: START TRADING (Invest page)
Select risk level: Conservative (4%/mo) | Balanced (6%/mo) | Aggressive (8%/mo)
Set drawdown limit: 3%, 5%, or 10%
Toggle auto-compounding (optional)
→ Funds moved from Main to Trading Balance
→ Investment record created

STEP 9: AUTO TRADING RUNS
100 signal trades per day (12:30–20:30 UTC window, Mon–Fri)
4 trading pairs: BTC/USD, XAU/USD, EUR/USD, US Oil
Daily profit target: 0.30%–0.50% auto-generated
~5% of trades are losers (realistic simulation)
Live entry/exit prices from Kraken / Stooq APIs

STEP 10: DAILY PROFIT CREDITED
Cron runs Mon–Fri at 00:00 UTC
Profit distributed to each active investor's Profit Balance
Referral sponsor gets 3% of first activation bonus

STEP 11: WITHDRAW PROFIT
Choose: USDT (on-chain) or INR (bank transfer)
Review withdrawal details
Email OTP verification required
24h cooldown enforced for new devices or recent password change
Admin approves large withdrawals
Funds sent to user's bank / USDT address

STEP 12: REFERRAL BONUS
User shares referral code/link
Friend registers with code
Friend activates investment → sponsor earns 3% one-time bonus
Monthly sponsor earnings from team profit
```

---

## 5. FEATURES AND MODULES

### Core Modules
| Module | Description |
|---|---|
| Auth | Registration, login, 2FA, device management, email verification |
| Wallet | Three-balance system (Main, Trading, Profit) |
| Investment | Auto-trading with risk levels and drawdown limits |
| Signal Trading | Admin/auto-opened trades proportionally distributed |
| Deposit | INR (UPI/NetBanking via merchants) + USDT (TRON on-chain) |
| Withdrawal | USDT on-chain + INR bank transfer + user-to-user transfer |
| Referral | Code-based referral with sponsor earnings |
| Rewards | Points → prize redemption, VIP levels |
| Tasks | Daily/weekly/social tasks for points |
| KYC | 3-level identity verification |
| Notifications | In-app real-time notifications |
| Analytics | Equity curves, drawdown charts, monthly performance |
| Market Insights | Live indicators from public APIs |
| AI Chat | GPT-powered lead conversion chatbot |
| Telegram Alerts | Opt-in personal trade/profit alerts |
| Promo / Offers | HMAC-derived rotating offers + holiday promotions |

### Admin Modules
| Module | Description |
|---|---|
| User Management | Freeze, disable, force logout, balance adjust |
| Profit Distribution | Manual % entry or auto cron (Mon–Fri) |
| Withdrawal Approval | Approve/reject USDT and INR withdrawals |
| Signal Trade Control | Open/close manual signal trades |
| Auto Engine | 100-trade daily plan auto-generated |
| KYC Queue | Review and approve KYC documents |
| Ledger / Reconcile | GL accounts, journal entries, reconciliation |
| Fraud Intelligence | Multi-account flags, device clusters, IP analysis |
| Payment Methods | Add/edit UPI/bank accounts for merchants |
| Broadcast | Send push notifications to all users |
| System Settings | Maintenance mode, registration toggle, auto-withdraw limits |
| Sub-Admins | Create sub-admins with role-based permissions |
| Merchants | Manage merchant accounts and INR balances |
| Subscriptions | Track service billing (Fly, Neon, domain, etc.) |
| Chat Leads | CRM view of AI chatbot leads, notes, follow-ups |
| Blog / Content | Manage blog posts and marketing content |
| Escalation Contacts | On-call escalation contact list |

---

## 6. USER ROLES AND PERMISSIONS

### Role Hierarchy
```
superadmin
    └── admin
         └── sub-admin (RBAC controlled)
              └── merchant
                   └── user
```

### Role Capabilities
| Role | Capabilities |
|---|---|
| user | Dashboard, wallet, deposit, withdraw, invest, referral, tasks, KYC, settings |
| merchant | Approve/reject INR deposits and withdrawals assigned to them |
| sub-admin | Subset of admin capabilities per RBAC permissions table |
| admin | All admin panel features |
| superadmin | All features + sub-admin management + dangerous system controls |

### RBAC Permission Flags (admin_permissions table)
Granular flags stored per sub-admin:
- canManageUsers, canManageWithdrawals, canManageDeposits
- canManageTrading, canManageSettings, canViewLogs
- canManageMerchants, canManageKyc, canManageSignalTrades
- canManageRBAC, canManageContent, canManageSubscriptions

---

## 7. AUTHENTICATION SYSTEM

### Registration Flow
```
POST /auth/register
Body: { fullName, email, password, referralCode?, _hp (honeypot), _plt (page load time) }

Server checks:
1. Honeypot field empty (bot detection)
2. Page load timing > 3 seconds (bot detection)
3. Disposable email blocked (large block-list)
4. IP rate limit: max 3 registrations/hour per IP
5. CAPTCHA verified (Cloudflare Turnstile or Slider puzzle)
6. Email uniqueness check
7. Password hashed with bcrypt
8. User created
9. Email OTP sent (6-digit, 10min expiry)
10. Referral code linked if provided
```

### Login Flow
```
POST /auth/login
Body: { email, password, captchaToken }

Server checks:
1. Rate limit: max 5 attempts per 15 min per IP
2. CAPTCHA verified
3. User found and not disabled/frozen
4. Email verified (gate)
5. Password bcrypt compare
6. Device fingerprint checked:
   a. Known device → JWT issued immediately
   b. New device → Login approval request created
      → Alert email sent to user (with approve/deny links)
      → Polling: GET /auth/login-attempts/:id/status
      → User approves on known device → JWT issued
      → Or: request OTP → verify OTP → JWT issued
7. 2FA check (if enabled):
   POST /auth/2fa/login-verify
   Body: { code } (TOTP) or email fallback
8. JWT issued: { accessToken, refreshToken }
9. Device + IP stored in login_events
10. Geolocation looked up (ip-api.com)
11. New-device alert email sent
```

### JWT Structure
```json
{
  "userId": 123,
  "email": "user@example.com",
  "isAdmin": false,
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 2FA (TOTP)
- Setup: `POST /security/2fa/setup` → returns QR code (otpauth URI)
- Verify setup: `POST /security/2fa/verify-setup`
- Login verify: `POST /auth/2fa/login-verify`
- Email fallback: `POST /auth/2fa/email-fallback/request`
- Disable: `POST /security/2fa/disable`
- Backup codes: `POST /security/2fa/regenerate-backup-codes`

### Password Reset
```
POST /auth/forgot-password  → sends OTP to email
POST /auth/verify-reset-otp → verifies OTP
POST /auth/reset-password   → sets new password
```

### Security Hardening
| Feature | Detail |
|---|---|
| CSRF | HMAC-derived nonces, validated on all state-changing requests |
| Cloudflare Pin | X-Origin-Auth header required (added by CF Transform Rule) |
| Helmet | Security headers (X-Frame-Options, CSP, etc.) |
| Origin Guard | Origin/Referer checked for POST/PUT/PATCH/DELETE |
| Admin IP Allowlist | ADMIN_IP_ALLOWLIST env restricts admin routes by IP |
| 24h Device Cooldown | New device cannot withdraw for 24h after first login |
| Password Change Cooldown | 24h withdrawal block after password change |

---

## 8. WALLET SYSTEM

### Three-Balance Architecture
```
┌─────────────────────────────────────────────────┐
│                   USER WALLET                    │
├──────────────────┬──────────────────┬────────────┤
│   MAIN BALANCE   │ TRADING BALANCE  │  PROFIT    │
│   (USDT)         │ (USDT)           │  BALANCE   │
│                  │                  │  (USDT)    │
│ Receives:        │ Receives:        │ Receives:  │
│ - Deposits       │ - Investment     │ - Daily    │
│ - Referral bonus │   start          │   profit   │
│                  │ - Signal trade   │ - Signal   │
│ Sends:           │   profit         │   sweep    │
│ - Investment     │                  │   (25th)   │
│   start          │ Sends:           │            │
│ - USDT withdraw  │ - Investment     │ Sends:     │
│ - User transfer  │   stop (return)  │ - USDT     │
│                  │                  │   withdraw │
│                  │                  │ - INR      │
│                  │                  │   withdraw │
└──────────────────┴──────────────────┴────────────┘
```

### Wallet API Endpoints
```
GET  /api/wallet                     → balances + recent transactions
POST /api/wallet/deposit             → internal credit (admin use)
POST /api/wallet/withdraw            → initiate withdrawal
POST /api/wallet/transfer            → internal wallet-to-wallet
GET  /api/wallet/lookup-user         → find user for transfer
POST /api/wallet/transfer-to-user    → user-to-user USDT transfer
```

### Display Boosts (synthetic, display-only)
The wallet also stores visual enhancement fields that only affect what users see on the dashboard — they never affect real accounting:
- `demoEquityBoost` — grows $100–$500 every 10 min (Total Equity display)
- `dailyPnlAmount` / `dailyPnlPct` — synthetic daily P&L ticker
- `tradingFundBoost` — grows $100–$1000 every 30 min (Active Trading Fund display)
- `totalProfitBoost` — cumulative profit display counter
- `synthWinRate`, `synthMaxDrawdown`, `synthAvgReturn`, `synthRiskScore` — performance metrics display

---

## 9. DEPOSIT PROCESS

### Method 1: INR via UPI / Net Banking
```
1. User opens Deposit → selects INR tab
2. System fetches available payment methods (UPI / bank accounts)
   GET /api/payment-methods
3. User selects a payment method
4. User sends money to shown account (outside app)
5. User enters UTR (Unique Transaction Reference) + uploads payment proof
   POST /api/inr-deposits
6. Merchant assigned to that payment method reviews:
   POST /merchant/inr-deposits/:id/approve or reject
   OR Admin reviews: POST /admin/inr-deposits/:id/approve
7. On approval: USDT credited to user's Main Balance at current INR/USDT rate
   Rate fetched from: GET /api/inr-rate (admin-set)
8. Escalation cron: if not reviewed in X minutes → escalate to merchant → then admin
```

### Method 2: TRON USDT (On-chain Crypto)
```
1. User opens Deposit → selects Crypto tab
2. System fetches or generates user's TRON deposit address
   GET /api/deposit/address
   POST /api/deposit/tron-address (generates if not exists)
3. User shown TRC20 address + QR code
4. User sends USDT on TRON blockchain to this address
5. Backend TRON monitor (TronGrid API) polls for incoming TXs
6. On detection: blockchain_deposits record created
7. Confirmation threshold met (configurable)
8. USDT credited to Main Balance automatically
9. Two-step sweep: user's deposit address → platform master wallet
   POST /admin/deposits/:id/reset-sweep (if sweep fails)
```

### Deposit History
```
GET /api/deposit/history → list of all deposits (INR + crypto)
```

---

## 10. WITHDRAW PROCESS

### Method 1: USDT On-chain
```
1. User selects Withdraw → USDT
2. Enters: TRON wallet address + amount
3. System checks:
   - Sufficient Profit Balance
   - Amount within auto-withdraw limit (system setting)
   - Device cooldown (24h for new device)
   - Password change cooldown (24h)
4. Review screen shown
5. Email OTP requested: POST /auth/send-otp
6. OTP verified: POST /auth/verify-email
7. Withdrawal record created: POST /api/wallet/withdraw
8. If amount > auto-limit → admin approval queue
   POST /admin/withdrawals/:id/approve or reject
9. On approval → USDT sent on-chain manually or automated
```

### Method 2: INR Bank Transfer
```
1. User selects Withdraw → INR
2. Enters: bank account details + amount
3. INR cap check: GET /withdrawal-limits
4. Email OTP for verification
5. INR withdrawal record: POST /api/inr-withdrawals
6. Merchant claims it: POST /merchant/inr-withdrawals/:id/claim
7. Merchant pays user → marks approved
8. OR Admin approves: POST /admin/inr-withdrawals/:id/approve
9. On approval → user's Profit Balance debited
```

### Method 3: User-to-User Transfer
```
1. User selects Withdraw → User Transfer
2. Lookup recipient: GET /api/wallet/lookup-user?email=...
3. Confirm transfer: POST /api/wallet/transfer-to-user
4. Instant — no approval needed
5. Both users notified
```

---

## 11. TRADING SYSTEM

### Auto Signal Engine (Primary)
```
Configuration:
- Window: 12:30 UTC → 20:30 UTC (8 hours), Mon–Fri
- 100 trade slots per day
- Gap between trades: 4–6 minutes (randomized)
- Daily profit target: 0.30%–0.50% (random per day)
- Loser slots: ~5% of 100 (4–6 losing trades)
- Loser loss: -0.05% to -0.15% per losing trade
- Winner profit: distributed across remaining slots to hit daily target

Trading Pairs:
- BTC/USD  (live price: Kraken API XBTUSD)
- XAU/USD  (live price: Stooq API)
- EUR/USD  (live price: Stooq API)
- US Oil   (live price: Stooq API cl.f)

Market Hours:
- Saturday: closed all day
- Friday after 22:00 UTC: closed
- Sunday before 22:00 UTC: closed
- Mon–Thu 21:00–22:00 UTC: CME maintenance break

Plan Storage:
- Daily plan persisted in Redis (key: auto:plan:YYYY-MM-DD, TTL 36h)
- Reloaded on server restart (no duplicate trades)

Cron tick: every minute → executes next due trade slot
```

### Signal Trade Distribution
```
When a signal trade closes:
1. All users with active investments receive proportional profit
2. Share = (user trading balance / total active capital) × trade profit %
3. Profit added to each user's Trading Balance
4. Monthly sweep (25th of month): Trading Balance → Profit Balance
5. Distribution recorded in signal_trade_distributions table
```

### Investment Start/Stop
```
POST /api/investment/start
Body: { amount, riskLevel, drawdownLimit }
- Moves 'amount' from Main → Trading Balance
- Creates/updates investment record
- Sets risk level: conservative | balanced | aggressive

POST /api/investment/stop
- Returns Trading Balance → Main Balance
- Marks investment inactive

Risk Levels:
- Conservative: 4%/month auto target
- Balanced:     6%/month auto target
- Aggressive:   8%/month auto target

Drawdown Limits:
- 3%, 5%, or 10%
- If drawdown exceeds limit → investment auto-paused
- Sticky banner shown on dashboard warning user
```

### Self Trade (Manual)
```
POST /api/investment/self-trade
User can open a manual trade (for display, linked to their portfolio)
```

### Auto-Compounding
```
PATCH /api/investment/compounding
Toggle: autoCompound = true/false
When true: Profit Balance automatically re-added to Trading Balance daily
```

---

## 12. REFERRAL SYSTEM

### How It Works
```
1. User gets unique referral code (shown on /referral page)
2. Shares link: qorixmarkets.com/register?ref=CODE
3. New user signs up with code → referral link stored
4. When referred user starts FIRST investment:
   → Sponsor earns 3% of investment amount (one-time)
   → Credited to sponsor's Main Balance
   → referral_bonus_paid flag set (prevents double-pay)
5. Monthly sponsor earnings based on team profit (admin-configured %)
```

### Referral API
```
GET  /api/referral              → my referral stats (code, earnings, team count)
GET  /api/referral/referred-users → list of users I referred + their status
GET  /api/leaderboard/referrals → top referrers leaderboard
```

---

## 13. GAMIFICATION FEATURES

### Points and Tasks
```
Task Categories:
- daily    → reset every 24h (e.g., "Login today", "Check portfolio")
- weekly   → reset every 7 days
- social   → (e.g., "Share on Twitter", "Follow on Telegram")
- referral → triggered by referral actions
- one_time → completed once forever

Task Completion:
POST /api/tasks/:slug/complete → instant completion (if no proof required)
POST /api/tasks/:slug/proof   → submit proof (screenshot, etc.)
→ Admin reviews proof: POST /admin/task-proofs/:id/approve or reject
→ Points awarded on approval

Points Balance:
GET /api/points → current points total + history
```

### Rewards / VIP System
```
Points redeemable for prizes (shown on /rewards page)
VIP levels unlock based on total investment / activity
Leaderboard: GET /api/leaderboard/rewards
```

### Promotions / Offers
```
Two-layer promo system:

Layer 1: Rotating HMAC Offers
- Offer derived from HMAC(userId + timestamp window)
- Changes every X hours automatically
- GET /api/promo/offer → personalized offer
- POST /api/promo/redeem → atomic claim (prevents double-redeem)
- 24h TTL: stale redemptions auto-expired by cron

Layer 2: Scheduled Holiday Promotions
- Admin creates promos: POST /admin/scheduled-promos
- Active during configured date range
- Users see on dashboard during active window
```

---

## 14. ADMIN PANEL FEATURES

### Dashboard (/admin)
- Total AUM (Assets Under Management)
- Active investors count
- Today's deposits / withdrawals
- System health status
- Recent activity log

### User Management (/admin/users)
```
GET  /admin/users                         → list with filters (search, status)
POST /admin/users/:id/action              → freeze | unfreeze | disable | force-logout
PATCH /admin/users/:id/profile            → edit user profile
GET  /admin/users/:id/investment-detail   → user's full investment breakdown
POST /admin/users/:id/send-email          → send custom email
POST /admin/users/:id/points              → award/deduct points manually
POST /admin/users/:id/balance-adjust      → adjust any wallet balance
```

### Profit Distribution
```
POST /admin/profit                   → set daily profit % and distribute
POST /admin/profit/auto-distribute   → trigger auto distribution now
GET  /admin/profit/history           → history of all distributions
```

### Withdrawal Management
```
GET  /admin/withdrawals              → list pending/all withdrawals
POST /admin/withdrawals/:id/approve  → approve and mark paid
POST /admin/withdrawals/:id/reject   → reject with reason
GET  /admin/inr-withdrawals          → INR-specific withdrawals
```

### Transaction Management
```
GET  /admin/transactions             → all transactions with filters
POST /admin/transactions/manual-credit → manually credit a user
```

### Signal Trades (/admin/signal-trades)
```
GET  /signal-trades/running          → currently open trades
GET  /signal-trades/recent           → recently closed
POST /admin/signal-trades/reanchor   → re-anchor planned trade prices
GET  /admin/auto-engine/state        → current engine state
POST /admin/auto-engine/tick         → force a cron tick
POST /admin/auto-engine/close-matured → close matured trades
```

### System Settings (/admin/system)
```
GET  /admin/settings     → all system settings
POST /admin/settings     → update settings

Key settings:
- maintenanceMode (true/false)
- registrationEnabled (true/false)
- autoWithdrawLimit (max auto-approve amount)
- dailyWithdrawCap (per-user daily limit)
- referralBonusPercent
- kycRequired (gate withdrawals behind KYC)
- captchaProvider (turnstile | slider | none)
- adminIpAllowlist
```

### Broadcast Notifications
```
POST /admin/broadcast → send notification to all users or filtered group
POST /admin/kyc-reminder → send KYC reminder emails to unverified users
```

### Ledger / Finance
```
GET /admin/ledger/reconcile → balance reconciliation report
GET /admin/ledger/accounts  → GL account list
GET /admin/ledger/journal   → transaction journal
```

### Intelligence / AML (/admin/intelligence)
```
GET /admin/intelligence → fraud analysis dashboard
- Multi-account clusters
- High-risk IPs
- Suspicious activity patterns
- Device cluster heatmap
```

### KYC Queue (/admin/kyc)
```
GET  /admin/kyc/queue           → pending KYC submissions
GET  /admin/kyc/document/:userId → download documents
POST /admin/kyc/review          → approve | reject with reason
```

### Audit Log
```
GET /admin/audit-log → all admin actions with actor, action, target, timestamp
```

### Blockchain Deposits
```
GET  /admin/blockchain-deposits/unmatched     → unmatched on-chain deposits
POST /admin/blockchain-deposits/:id/claim     → manually match to a user
POST /admin/deposits/:id/reset-sweep          → retry failed sweep
```

---

## 15. MERCHANT PORTAL

Merchants are third-party payment partners who handle INR deposits and withdrawals. They have a completely separate login portal.

### Merchant Capabilities
```
POST /merchant/auth/login          → merchant login
GET  /merchant/me                  → profile
GET  /merchant/dashboard           → stats: pending count, INR balance
GET  /merchant/payment-methods     → their UPI/bank accounts
POST /merchant/payment-methods     → add new payment method
PATCH /merchant/payment-methods/:id → edit method
GET  /merchant/inr-rate            → current INR/USDT rate
GET  /merchant/inr-deposits        → deposits assigned to their methods
POST /merchant/inr-deposits/:id/approve → approve with proof verification
POST /merchant/inr-deposits/:id/reject  → reject with reason
GET  /merchant/inr-withdrawals     → withdrawals to process
POST /merchant/inr-withdrawals/:id/claim   → claim to process
POST /merchant/inr-withdrawals/:id/approve → mark as paid
POST /merchant/inr-withdrawals/:id/reject  → reject
```

### Merchant Balance System
- Each merchant has an `inrBalance` (security deposit)
- Balance decremented when deposit approved (merchant owes this amount)
- Balance incremented when withdrawal they paid is approved
- Admin tops up merchant balance: `POST /admin/merchants/:id/topup`

---

## 16. DATABASE STRUCTURE

### Complete Table List (39 tables)

#### User & Auth Tables
```
users
  - id, email, passwordHash, fullName
  - isAdmin, adminRole
  - kycStatus, kycDocumentUrl, kycDocumentType
  - kycPersonalStatus, phoneNumber, dateOfBirth, phoneVerifiedAt
  - kycAddressStatus, addressLine1, addressCity, addressState, addressCountry
  - isDisabled, isFrozen, forceLogoutAfter
  - emailVerifiedAt, twoFactorSecret, twoFactorEnabled, backupCodes
  - telegramChatId, telegramOptIn, telegramLinkToken
  - referralCode, referredBy, referralEarnings
  - isSmokeTest
  - lastPasswordChangedAt, createdAt, updatedAt

login_attempts           → pending new-device login approvals
login_events (fraud.ts)  → IP, device fingerprint, user agent per login
email_otps               → OTP records for email verification / withdrawals
user_devices             → trusted device registry
```

#### Wallet & Finance Tables
```
wallets
  - mainBalance, tradingBalance, profitBalance
  - demoEquityBoost, dailyPnlAmount, tradingFundBoost (display-only)
  - synthWinRate, synthMaxDrawdown (display-only metrics)

transactions
  - userId, type (deposit|withdrawal|profit|transfer|referral_bonus)
  - amount, status (pending|completed|rejected)
  - walletAddress, txHash, idempotencyKey

investments
  - userId, amount, riskLevel (low|medium|high)
  - isActive, isPaused, autoCompound
  - totalProfit, dailyProfit, drawdown, drawdownLimit
  - peakBalance, referralBonusPaid
  - startedAt, stoppedAt, pausedAt

equity_history           → daily equity snapshots for charts
daily_profit_runs        → history of each profit distribution run
monthly_performance      → monthly P&L summaries
pnl_history              → granular P&L records
```

#### Trading Tables
```
trades
  - userId, symbol, direction (buy|sell)
  - entryPrice, exitPrice, profit, profitPercent
  - executedAt

signal_trades
  - pair, direction, entryPrice, exitPrice
  - tpPrice, slPrice, scheduledAt
  - expectedProfitPercent, realizedProfitPercent
  - status (running|closed|cancelled)
  - totalDistributed, affectedUsers
  - idempotencyKey, createdBy, closedAt

signal_trade_distributions
  - tradeId, userId, shareBasisAmount, profitAmount, sweptAt

signal_trade_audit
  - tradeId, action, actorUserId, details

trading_desk_traders     → trading desk public leaderboard entries
```

#### Deposit / Crypto Tables
```
deposit_addresses
  - userId, address (TRON), privateKeyEncrypted
  - balance, lastCheckedAt

blockchain_deposits
  - userId, depositAddressId, txHash
  - amount, status (pending|confirmed|credited|unmatched)
  - confirmations, detectedAt, creditedAt
```

#### INR / Merchant Tables
```
payment_methods
  - merchantId, type (upi|bank)
  - upiId, bankName, accountNumber, ifsc
  - accountHolderName, isActive, dailyLimit

merchants
  - email, passwordHash, fullName, phone
  - isActive, inrBalance, createdBy

inr_deposits
  - userId, paymentMethodId, amountInr, amountUsdt, rateUsed
  - utr, proofImageBase64, status (pending|approved|rejected)
  - reviewedBy, reviewedByKind (admin|merchant), reviewedAt
  - escalatedToMerchantAt, escalatedToAdminAt

inr_withdrawals
  - userId, amountUsdt, amountInr, rateUsed
  - bankDetails (JSONB), status, approvedBy
```

#### Notification & Communication Tables
```
notifications
  - userId, type, title, message, isRead, createdAt

chat_sessions
  - userId (nullable), visitorId (guest)
  - status (active|expert_requested|resolved)
  - detectedIntent, language, engagementScore
  - profile (JSONB), ctaShownCount, convertedAt
  - llmReplyCount, llmTokensUsed

chat_messages
  - sessionId, senderType (user|bot|admin)
  - content, createdAt

chat_leads               → CRM lead records from chat conversions
chat_settings            → AI chatbot configuration (JSONB)
chat_conversion_events   → funnel tracking events
```

#### Gamification Tables
```
tasks
  - slug, title, description, category (daily|weekly|social|referral|one_time)
  - pointReward, requiresProof, requiresKyc, requiresDeposit
  - isActive, iconName, sortOrder

task_completions (inferred from task routes)
  - userId, taskSlug, completedAt, proofUrl, approvedAt

promo_redemptions
  - userId, promoCode, status (redeemed|credited|expired)
  - redeemedAt, creditedAt

scheduled_promos
  - title, description, bonusPercent, startDate, endDate
  - maxRedemptions, redemptionCount
```

#### Admin & Security Tables
```
admin_permissions
  - userId (sub-admin), canManageUsers, canManageWithdrawals, etc.

admin_audit_log
  - actorUserId, action, targetUserId, details, createdAt

admin_escalation_contacts
  - name, email, phone, role, priority

fraud_flags
  - userId, flagType (multi_account|referral_abuse|device_cluster|self_referral)
  - severity (low|medium|high), resolvedAt

report_verifications     → email verification hash records

service_subscriptions    → admin billing tracker (Fly, Neon, domain, etc.)
```

#### Infrastructure Tables
```
system_settings          → key-value system configuration store
ledger / gl_accounts     → double-entry accounting (GL accounts, journal)
worker_heartbeats        → background job health tracking
```

---

## 17. ALL BACKEND APIS

### Base URL: `https://api.qorixmarkets.com/api`

### Auth APIs
```
POST   /auth/register
POST   /auth/login
POST   /auth/2fa/login-verify
POST   /auth/2fa/email-fallback/request
GET    /auth/me
GET    /auth/security-status
POST   /auth/send-otp
POST   /auth/verify-email
POST   /auth/verify-email-public
POST   /auth/resend-verification
POST   /auth/forgot-password
POST   /auth/verify-reset-otp
POST   /auth/reset-password
GET    /auth/login-attempts/pending
POST   /auth/login-attempts/:id/respond
GET    /auth/login-attempts/:id/status
POST   /auth/login-attempts/:id/request-otp
POST   /auth/login-attempts/:id/verify-otp
POST   /auth/change-password
```

### 2FA APIs
```
GET    /security/2fa/status
POST   /security/2fa/setup
POST   /security/2fa/verify-setup
POST   /security/2fa/disable
POST   /security/2fa/regenerate-backup-codes
```

### KYC APIs
```
GET    /kyc/status
POST   /kyc/personal
POST   /kyc/address
POST   /kyc/submit
GET    /admin/kyc/queue
GET    /admin/kyc/document/:userId
POST   /admin/kyc/review
```

### Wallet APIs
```
GET    /wallet
POST   /wallet/deposit
POST   /wallet/withdraw
POST   /wallet/transfer
GET    /wallet/lookup-user
POST   /wallet/transfer-to-user
```

### Dashboard APIs
```
GET    /dashboard/summary
GET    /dashboard/equity-chart
GET    /dashboard/pnl-history
GET    /dashboard/performance
GET    /dashboard/fund-stats
GET    /dashboard/monthly-performance
```

### Investment APIs
```
GET    /investment
POST   /investment/start
POST   /investment/stop
PATCH  /investment/protection
PATCH  /investment/compounding
GET    /investment/trades
POST   /investment/self-trade (and variants)
```

### Deposit APIs
```
GET    /deposit/address
POST   /deposit/tron-address
GET    /deposit/history
POST   /create-wallet
GET    /balance/:address
```

### INR Deposit APIs
```
GET    /inr-rate
GET    /payment-methods
GET    /inr-deposits/mine
POST   /inr-deposits
GET    /admin/inr-rate
POST   /admin/inr-rate
GET    /admin/payment-methods
POST   /admin/payment-methods
GET    /admin/inr-deposits
POST   /admin/inr-deposits/:id/approve
POST   /admin/inr-deposits/:id/reject
```

### Withdrawal APIs
```
GET    /withdrawal-limits
GET    /inr-withdrawals/mine
POST   /inr-withdrawals
GET    /admin/inr-withdrawals
POST   /admin/inr-withdrawals/:id/approve
POST   /admin/inr-withdrawals/:id/reject
```

### Transaction APIs
```
GET    /transactions
```

### Signal Trade APIs
```
GET    /signal-trades/running
GET    /signal-trades/recent
GET    /admin/signal-trades (implied)
POST   /admin/signal-trades/reanchor
GET    /admin/auto-engine/state
POST   /admin/auto-engine/tick
POST   /admin/auto-engine/close-matured
```

### Referral APIs
```
GET    /referral
GET    /referral/referred-users
```

### Notification APIs
```
GET    /notifications
PATCH  /notifications/:id/read
PATCH  /notifications/read-all
DELETE /notifications/:id
GET    /popup
```

### Task / Points APIs
```
GET    /tasks
POST   /tasks/:slug/complete
POST   /tasks/:slug/proof
GET    /points
GET    /admin/task-proofs
POST   /admin/task-proofs/:id/approve
POST   /admin/task-proofs/:id/reject
POST   /admin/users/:id/points
```

### Promo APIs
```
GET    /promo/offer
POST   /promo/redeem
GET    /admin/scheduled-promos
POST   /admin/scheduled-promos
```

### Telegram APIs
```
POST   /telegram/link/start
GET    /telegram/status
POST   /telegram/opt-in
```

### Leaderboard APIs
```
GET    /leaderboard/referrals
GET    /leaderboard/investors/weekly
GET    /leaderboard/rewards
```

### Public APIs
```
GET    /system/status
GET    /public/market-indicators
GET    /inr-rate
GET    /verify/:hashId
```

### Bot / Trading Desk APIs
```
GET    /bot-trading/quotes
GET    /trading-desk/stats
GET    /trading-desk/traders
```

### Chat / AI APIs
```
POST   /chat/session
POST   /chat/message
POST   /chat/bot-message
GET    /chat/session/:id/messages
POST   /chat/session/:id/end
POST   /chat/expert
POST   /chat/cta-click
POST   /chat/deposit-visit
POST   /chat/deposit-complete
GET    /chat/unsubscribe/:token
GET    /admin/chats
GET    /admin/chat-leads
POST   /admin/chat-leads/:id/contacted
POST   /admin/chat-leads/:id/notes
GET    /admin/chat-leads/analytics
POST   /admin/chats/:id/reply
```

### Admin APIs
```
GET    /admin/stats
POST   /admin/profit
POST   /admin/profit/auto-distribute
GET    /admin/profit/history
GET    /admin/users
POST   /admin/users/:id/action
PATCH  /admin/users/:id/profile
POST   /admin/users/:id/balance-adjust
POST   /admin/users/:id/send-email
GET    /admin/transactions
POST   /admin/transactions/manual-credit
GET    /admin/settings
POST   /admin/settings
POST   /admin/broadcast
POST   /admin/kyc-reminder
GET    /admin/logs
GET    /admin/withdrawals
POST   /admin/withdrawals/:id/approve
POST   /admin/withdrawals/:id/reject
GET    /admin/intelligence
GET    /admin/ledger/reconcile
GET    /admin/ledger/accounts
GET    /admin/ledger/journal
POST   /admin/slots
GET    /admin/system-health
GET    /admin/dashboard
GET    /admin/activity-logs
GET    /admin/audit-log
POST   /admin/broadcast
```

### RBAC / Sub-Admin APIs
```
GET    /admin/sub-admins
POST   /admin/sub-admins
PATCH  /admin/sub-admins/:id
DELETE /admin/sub-admins/:id
GET    /admin/me/permissions
```

### Merchant APIs
```
POST   /merchant/auth/login
GET    /merchant/me
GET    /merchant/dashboard
GET    /merchant/payment-methods
POST   /merchant/payment-methods
PATCH  /merchant/payment-methods/:id
GET    /merchant/inr-deposits
POST   /merchant/inr-deposits/:id/approve
POST   /merchant/inr-deposits/:id/reject
GET    /merchant/inr-withdrawals
POST   /merchant/inr-withdrawals/:id/claim
POST   /merchant/inr-withdrawals/:id/approve
POST   /merchant/inr-withdrawals/:id/reject
```

### Device APIs
```
GET    /devices
DELETE /devices/:id (implied)
```

### Phone Verification APIs
```
POST   /phone-otp/send
POST   /phone-otp/verify
GET    /phone-otp/status
```

### Google OAuth APIs
```
GET    /auth/google (implied OAuth flow)
GET    /auth/google/callback
```

### Reports API
```
POST   /reports/generate
```

### CAPTCHA APIs
```
POST   /captcha/slider/challenge
POST   /captcha/slider/verify
```

### Health API
```
GET    /health
```

---

## 18. NOTIFICATION SYSTEM

### In-App Notifications
```
Types: system | profit | trade | referral | deposit | withdrawal | kyc | security

Storage: notifications table
Delivery: REST polling (GET /api/notifications)
Badge: unread count shown in header bell icon
Actions: mark read (single), mark all read, delete
```

### Email Notifications (AWS SES)
```
Triggers:
- Welcome email on registration
- Email OTP for verification
- Email OTP for withdrawal
- Email OTP for 2FA fallback
- New device login alert (with approve/deny buttons)
- Password change confirmation
- Profit distribution notification
- KYC status change (approved/rejected)
- KYC reminder broadcast
- Withdrawal approved/rejected
- Admin custom email to user
- Chat follow-up sequences (automated)
```

### Telegram Alerts
```
Setup:
1. User enables Telegram alerts in Settings
2. POST /api/telegram/link/start → returns deeplink token
3. User opens Telegram, sends /start <token> to Qorix bot
4. Bot links chat_id to user account

Alert types (opt-in):
- Daily profit credited
- Signal trade opened / closed
- Deposit confirmed
- Withdrawal approved
- Account security events

API:
GET  /api/telegram/status  → linked status + chat ID
POST /api/telegram/opt-in  → enable/disable specific alert types
```

### Push Notifications
- In Flutter: use **Firebase Cloud Messaging (FCM)** or **APNs**
- Backend: admin broadcast endpoint maps to FCM topic push
- Currently web-only via service worker (PWA)

---

## 19. AI FEATURES

### AI Chatbot (Qorix Assistant)
```
Model: OpenAI GPT (gpt-5-mini)
Purpose: Lead conversion — engage visitors, explain platform, push to signup/deposit

Features:
- Works for unauthenticated visitors (guest session via visitorId)
- Works for authenticated users (linked to userId)
- Detects user intent: beginner | advanced | skeptic | price_sensitive | ready_to_invest | support
- Detects engagement level: low | medium | high
- Detects language (multilingual support)
- Maintains session profile (JSONB) for personalization
- CTA prompts based on intent (e.g., "Start with $100")
- Tracks CTA clicks and deposit conversions
- Budget cap: max LLM tokens per session per day
- Expert escalation: human admin can take over chat session

API Flow:
POST /chat/session  → create session (auto guest or user)
POST /chat/message  → user message → LLM response
POST /chat/bot-message → scripted bot messages
GET  /chat/session/:id/messages → load history
POST /chat/expert  → escalate to human expert
POST /chat/session/:id/end → close session

Admin CRM:
GET  /admin/chat-leads → all leads with conversion status
GET  /admin/chat-leads/analytics → funnel metrics
POST /admin/chat-leads/:id/notes → add CRM notes
POST /admin/chats/:id/reply → admin reply in chat
GET  /admin/chat-leads/export.csv → export lead list
```

### AI Quiz (Qorixplay — separate app)
```
Separate web app: artifacts/qorix-mobile (Expo) or separate web app
OAuth SSO: Authorization Code + PKCE flow with Qorix Markets
Quizzes: KYC-gated, timed MCQ
Questions: AI-generated by OpenAI
Leaderboard: Live, Redis pub/sub powered
Prizes: Distributed to top scorers
```

### Auto Signal Engine (AI-assisted parameters)
```
Daily profit target and loser distribution are algorithmically computed
Live prices fetched from Kraken / Stooq APIs as entry anchors
Exit prices engineered from entry + planned profit %
Win rate: ~95% (realistic broker simulation)
```

---

## 20. REAL-TIME FEATURES

### Currently Implemented (Web)
| Feature | Mechanism |
|---|---|
| Notification badge count | Polling (React Query refetch interval) |
| Signal trades live | Polling every 30s |
| Dashboard equity | Polling every 60s |
| Market indicators | Polling every 5min |
| Chat messages | Polling |
| Merchant pending beacon | Polling |
| Site activity toaster | Fake real-time (simulated) |
| Live users pill | Simulated / cached count |

### Flutter Implementation Recommendations
| Feature | Recommended Approach |
|---|---|
| Notifications | WebSocket or FCM push |
| Trade updates | WebSocket subscription |
| Chat messages | WebSocket or long polling |
| Market data | WebSocket (Kraken/Binance WS) |
| Dashboard stats | 60s auto-refresh timer |

### Redis Event Bus
```
Used internally for:
- Profit distribution events (BullMQ queue)
- Quiz leaderboard updates (pub/sub)
- Auto-signal engine state (Redis keys)
- Rate limiting (Redis counters)
- Session caching (Redis TTL keys)
```

---

## 21. CHARTS AND MARKET DATA

### Dashboard Charts
| Chart | Data Source | API |
|---|---|---|
| Equity Curve | equity_history table | GET /dashboard/equity-chart |
| P&L History | pnl_history table | GET /dashboard/pnl-history |
| Drawdown Chart | investments table | Derived from equity data |
| Monthly Performance | monthly_performance table | GET /dashboard/monthly-performance |
| Daily P&L ticker | wallets.dailyPnlAmount | GET /dashboard/summary |

### Market Indicators (Public)
```
GET /api/public/market-indicators
Returns:
- BTC/USD price (Kraken API)
- XAU/USD price (Stooq)
- EUR/USD price (Stooq)
- US Oil price (Stooq)
- Market sentiment
- Fear & Greed index (simulated or external)

Cached in Redis (5min TTL) to avoid hitting external APIs per request
```

### Analytics Page Charts
- Equity curve (line chart, multiple time periods)
- Rolling returns (bar chart)
- Profit distribution (pie chart)
- Drawdown analysis (area chart)
- Win/loss ratio (donut chart)

### Flutter Chart Library Recommendation
- **fl_chart** — line, bar, pie, area charts
- **syncfusion_flutter_charts** — advanced financial charts

---

## 22. PAYMENT METHODS

### Crypto Deposits
| Method | Network | Token | Direction |
|---|---|---|---|
| TRON USDT | TRC20 | USDT | Deposit only |

### INR Deposits (via Merchants)
| Method | Details |
|---|---|
| UPI | UPI ID shown to user, user transfers money |
| Net Banking | Bank account + IFSC shown, user transfers money |

User uploads UTR (Unique Transaction Reference) as proof.

### INR Withdrawals
| Method | Details |
|---|---|
| Bank Transfer | User provides account number, IFSC, bank name |
| Merchant processes | Merchant physically transfers money to user |

### USDT Withdrawals
| Method | Details |
|---|---|
| On-chain TRON | User provides TRC20 wallet address |
| Manual processing | Admin/automated sends from platform wallet |

### Future Payment Methods (planned)
- Stripe (credentials present in secrets)
- Twilio for SMS OTP (credentials present, not yet active)

---

## 23. THIRD-PARTY SERVICES

| Service | Purpose | Config |
|---|---|---|
| **Neon.tech** | PostgreSQL hosting | DATABASE_URL secret |
| **Upstash Redis** | Cache, rate limiting, queues, pub/sub | REDIS_URL secret |
| **Fly.io** | App hosting (API + frontend) | fly.toml configs |
| **Cloudflare** | CDN, DDoS, Transform Rules, CAPTCHA | CLOUDFLARE_ORIGIN_SECRET |
| **AWS SES** | Transactional email delivery | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM_EMAIL |
| **Cloudflare Turnstile** | Bot-protection CAPTCHA | TURNSTILE_SECRET_KEY |
| **TronGrid** | TRON blockchain TRC20 monitoring | TRONGRID_API_KEY |
| **OpenAI** | AI chatbot (gpt-5-mini) | OPENAI_API_KEY |
| **Telegram Bot API** | User trade/profit alerts | TELEGRAM_BOT_TOKEN |
| **2Factor.in** | Voice OTP for phone verification | TWO_FACTOR_API_KEY |
| **Twilio** | SMS (configured, not yet active) | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN |
| **ip-api.com** | IP geolocation for new-device alerts | Free API, no key |
| **Kraken API** | Live BTC/USD price for trades | Public REST API |
| **Stooq** | Live XAU, EUR/USD, Oil prices | Public RSS/API |
| **Google OAuth** | SSO option | GOOGLE_CLIENT_SECRET |

---

## 24. AUTOMATION AND BOTS

### 1. Auto Signal Engine (Trading Bot)
```
Location: artifacts/api-server/src/lib/auto-signal-engine.ts
Type: Cron-driven (every 1 minute)
Function:
- Generates daily 100-trade plan at 12:30 UTC
- Plan stored in Redis (TTL 36h)
- Each cron tick fires one pending trade if due
- Fetches live prices from Kraken / Stooq
- Creates signal_trades records
- Distributes profit proportionally to all active investors
```

### 2. Profit Distribution Worker (BullMQ)
```
Location: artifacts/api-server/src/workers/profit-distribution-worker.ts
Type: BullMQ job queue (Redis-backed)
Triggers:
- Cron: Mon–Fri at 00:00 UTC (auto daily profit)
- Admin manual trigger: POST /admin/profit
Function:
- Calculates each active investor's share
- Credits Profit Balance
- Pays referral sponsor bonus (3% of first activation)
- Emits profit event to event bus
```

### 3. TRON Deposit Monitor
```
Location: artifacts/api-server/src/lib/tron-monitor.ts
Type: Polling watcher (every 60s or block-based)
Function:
- Polls TronGrid API for all user deposit addresses
- Detects incoming TRC20 USDT transactions
- Creates blockchain_deposits records
- Triggers automatic credit to Main Balance
- Initiates two-step sweep to platform master wallet
```

### 4. Telegram Bot Poller
```
Location: artifacts/api-server/src/lib/telegram.ts (poller)
Type: Long-polling (getUpdates)
Function:
- Listens for /start <token> messages from users
- Links Telegram chat_id to user account
- Sends personal alerts: profit credited, trade closed, deposit confirmed
```

### 5. Cron Jobs (node-cron)
```
Location: artifacts/api-server/src/lib/cron.ts

Schedule summary:
- Every minute:     Auto-signal engine tick + escalation check
- Mon–Fri 00:00 UTC: Daily profit distribution
- 25th of month:    Monthly trading→profit wallet sweep
- Hourly:           Expire stale promo redemptions (>24h)
- Periodic:         Chat follow-up worker (chatFollowupTick)
- Periodic:         Second-stage chat follow-up (chatFollowup2Tick)
```

### 6. Deposit Worker (BullMQ)
```
Location: artifacts/api-server/src/workers/deposit-worker.ts
Type: BullMQ job queue
Function: Process deposit credit jobs asynchronously
```

### 7. Profit Event Worker (BullMQ)
```
Location: artifacts/api-server/src/workers/profit-event-worker.ts
Type: BullMQ job queue
Function: Handle profit distribution event side effects (notifications, etc.)
```

### 8. Chat Follow-up Workers
```
Location: artifacts/api-server/src/workers/chat-followup-worker.ts
         artifacts/api-server/src/workers/chat-followup2-worker.ts
Type: Cron-triggered
Function:
- Identify leads that went cold (no response)
- Send automated follow-up emails
- Stage 1: soft follow-up (X hours after last message)
- Stage 2: harder CTA follow-up (Y hours later)
```

### 9. Escalation Cron
```
Location: artifacts/api-server/src/lib/escalation-cron.ts
Type: Every-minute cron tick
Function:
- Monitors pending INR deposits
- If not reviewed in threshold time → alert merchant
- If still not reviewed → alert admin
- Escalation contacts table used for on-call routing
```

---

## 25. ANTI-FRAUD AND SECURITY

### Registration Anti-Fraud
| Check | Detail |
|---|---|
| Honeypot field | Hidden `_hp` field — bots fill it, humans don't |
| Timing detection | `_plt` (page load time) — submission under 3s = bot |
| Disposable email block | Large domain blocklist (thousands of temp-mail providers) |
| IP rate limit | Max 3 new accounts per IP per hour |
| CAPTCHA | Cloudflare Turnstile or custom slider puzzle |
| Email verification gate | Must verify email before first login |

### Login Anti-Fraud
| Check | Detail |
|---|---|
| Rate limiting | Max 5 attempts per 15 min per IP (Redis-backed) |
| Device fingerprinting | SHA-256 hash of User-Agent stored per login |
| New device gate | Login approval required from existing trusted device |
| New device email alert | Geolocation-based alert with approve/deny links |
| 2FA | TOTP (authenticator app) or email OTP fallback |

### Withdrawal Anti-Fraud
| Check | Detail |
|---|---|
| Email OTP | Required for every withdrawal |
| New device cooldown | 24h wait after first login from new device |
| Password change cooldown | 24h wait after password change |
| Daily cap | Per-user daily withdrawal limit (admin-configured) |
| INR cap | Per-withdrawal INR fraud cap |
| Admin approval | Large withdrawals queued for manual approval |

### Multi-Account Detection
```
System tracks:
- Same IP across multiple user logins
- Same device fingerprint across accounts
- Device cluster detection (multiple accounts, same device)
Flags stored in: fraud_flags table
Types: multi_account | referral_abuse | device_cluster | self_referral
Severity: low | medium | high
Admin reviews: GET /admin/intelligence, GET /admin/fraud
```

### API Security
| Feature | Detail |
|---|---|
| CSRF HMAC nonces | All state-changing requests require HMAC token |
| Cloudflare Origin Pin | X-Origin-Auth header required (CF Transform Rule injects it) |
| Admin IP allowlist | Admin routes restricted to specific IPs |
| Helmet | Security HTTP headers (CSP, X-Frame-Options, etc.) |
| Origin/Referer guard | POST/PUT/PATCH/DELETE check Origin header |
| HTTP method allowlist | Only allowed HTTP methods accepted |
| Global rate limit | Per-IP limit on all endpoints |

---

## 26. FULL APP MAP

```
QORIX MARKETS APP
│
├── PUBLIC ZONE (no auth)
│   ├── Marketing Site
│   │   ├── Home / Landing
│   │   ├── About
│   │   ├── AI Trading
│   │   ├── Low Investment
│   │   ├── Zero Fee
│   │   ├── Blog (index + posts)
│   │   └── Contact
│   ├── Legal Pages (Terms, Privacy, Risk, AML)
│   ├── Auth Pages
│   │   ├── Login
│   │   ├── Register
│   │   ├── Forgot Password
│   │   └── Email Verify
│   └── Market Insights (public view)
│
├── USER ZONE (auth required)
│   ├── Dashboard (home)
│   ├── Wallet
│   │   ├── Balances (Main, Trading, Profit)
│   │   ├── Deposit Hub
│   │   │   ├── INR → UPI → Pay → Verify
│   │   │   ├── INR → Net Banking → Details → Verify
│   │   │   └── Crypto → TRON Address → Success
│   │   └── Withdraw Hub
│   │       ├── USDT → Review → OTP → Success
│   │       ├── INR → Review → OTP → Success
│   │       └── User Transfer → Confirm
│   ├── Invest
│   │   ├── Start/Stop Auto-Trading
│   │   ├── Risk Level Selector
│   │   ├── Drawdown Limit Config
│   │   └── Auto-Compound Toggle
│   ├── Portfolio
│   │   ├── Investment Breakdown
│   │   ├── Performance Metrics
│   │   └── Risk Analytics
│   ├── Analytics
│   │   ├── Equity Curve Chart
│   │   ├── Drawdown Chart
│   │   ├── Monthly Performance
│   │   └── Rolling Returns
│   ├── Trading
│   │   ├── Trading Desk (live signals)
│   │   ├── Trade Activity (individual trades)
│   │   └── Signal History (closed signals)
│   ├── Referral
│   │   ├── My Referral Code / Link
│   │   ├── Team List
│   │   └── Earnings History
│   ├── Rewards
│   │   ├── Points Balance
│   │   ├── Prize Catalog
│   │   └── VIP Level
│   ├── Tasks
│   │   ├── Daily Tasks
│   │   ├── Weekly Tasks
│   │   ├── Social Tasks
│   │   └── One-time Tasks
│   ├── Market Insights
│   ├── Transactions (full history)
│   ├── Settings
│   │   ├── Profile (name, phone)
│   │   ├── Password Change
│   │   ├── 2FA Setup / Disable
│   │   ├── Telegram Alerts
│   │   └── Phone Verification
│   ├── KYC (3 levels)
│   │   ├── Level 1: Personal Info
│   │   ├── Level 2: Document Upload
│   │   └── Level 3: Address Verification
│   └── Devices (trusted device management)
│
├── ADMIN ZONE (admin role required)
│   ├── Dashboard (AUM, stats, health)
│   ├── Users (list, freeze, edit, balance)
│   ├── Deposits (INR + Crypto review)
│   ├── Withdrawals (approve/reject queue)
│   ├── Trading (profit dist, signal control)
│   ├── Signal Trades (open/close manual + auto engine)
│   ├── KYC Queue (document review)
│   ├── Wallet / Ledger (GL, reconcile, journal)
│   ├── Analytics (platform-wide)
│   ├── Intelligence / AML (fraud dashboard)
│   ├── Fraud Flags
│   ├── Payment Methods (UPI/bank management)
│   ├── Merchants (accounts + topup)
│   ├── Sub-Admins (RBAC management)
│   ├── Subscriptions (billing tracker)
│   ├── Escalation Contacts
│   ├── Task Proofs (manual review)
│   ├── Chats / AI Leads (CRM)
│   ├── Communication (broadcast)
│   ├── Content / Blog
│   ├── System Settings
│   ├── Logs (server logs)
│   └── Test / Hidden Features
│
└── MERCHANT ZONE (merchant login)
    ├── Dashboard
    ├── Payment Methods
    ├── INR Deposits (approve/reject)
    ├── INR Withdrawals (claim/pay)
    └── Settings
```

---

## 27. SCREEN HIERARCHY

### Flutter Widget Tree Structure (Recommended)

```
MaterialApp (root)
├── GoRouter
│   ├── ShellRoute (MainShell — bottom nav)
│   │   ├── /dashboard → DashboardScreen
│   │   ├── /wallet → WalletScreen
│   │   │   ├── /deposit → DepositHubScreen
│   │   │   │   ├── /deposit/upi → UpiSelectScreen
│   │   │   │   │   └── /deposit/upi/pay → UpiPayScreen
│   │   │   │   ├── /deposit/netbanking → NetBankingScreen
│   │   │   │   │   └── /deposit/netbanking/details → NetBankingDetailsScreen
│   │   │   │   └── /deposit/crypto → CryptoDepositScreen
│   │   │   └── /withdraw → WithdrawHubScreen
│   │   │       ├── /withdraw/usdt → WithdrawUsdtScreen
│   │   │       ├── /withdraw/inr → WithdrawInrScreen
│   │   │       ├── /withdraw/user-transfer → UserTransferScreen
│   │   │       ├── /withdraw/review → WithdrawReviewScreen
│   │   │       ├── /withdraw/otp → WithdrawOtpScreen
│   │   │       └── /withdraw/success → WithdrawSuccessScreen
│   │   ├── /invest → InvestScreen
│   │   │   ├── /portfolio → PortfolioScreen
│   │   │   ├── /analytics → AnalyticsScreen
│   │   │   ├── /trading-desk → TradingDeskScreen
│   │   │   ├── /trade-activity → TradeActivityScreen
│   │   │   └── /signal-history → SignalHistoryScreen
│   │   ├── /referral → ReferralScreen
│   │   │   ├── /rewards → RewardsScreen
│   │   │   └── /tasks → TasksScreen
│   │   └── /more → ProfileMenuScreen
│   │       ├── /settings → SettingsScreen
│   │       │   ├── /devices → DevicesScreen
│   │       │   └── /kyc → KycScreen
│   │       ├── /market-insights → MarketInsightsScreen
│   │       └── /transactions → TransactionsScreen
│   │
│   ├── PublicRoutes (no shell, no bottom nav)
│   │   ├── / → LandingScreen or DashboardRedirect
│   │   ├── /login → LoginScreen
│   │   ├── /register → RegisterScreen
│   │   ├── /forgot-password → ForgotPasswordScreen
│   │   ├── /verify → EmailVerifyScreen
│   │   └── /legal/* → LegalScreens
│   │
│   ├── AdminShellRoute (separate nav)
│   │   ├── /admin → AdminDashboardScreen
│   │   ├── /admin/users → AdminUsersScreen
│   │   └── ... (all admin routes)
│   │
│   └── MerchantShellRoute
│       ├── /merchant/login → MerchantLoginScreen
│       ├── /merchant → MerchantDashboardScreen
│       └── ... (all merchant routes)
│
└── Overlays
    ├── NotificationBadge
    ├── MaintenanceBanner
    ├── DrawdownWarningBanner
    ├── PromoPopup
    ├── QorixAssistant (AI Chat FAB)
    └── SplashScreen
```

---

## 28. FEATURE HIERARCHY

```
QORIX MARKETS FEATURES
│
├── IDENTITY & AUTH
│   ├── Email registration with OTP verification
│   ├── JWT-based session management
│   ├── TOTP 2FA (Google Authenticator compatible)
│   ├── Email fallback OTP for 2FA
│   ├── New-device login approval workflow
│   ├── Password reset via email OTP
│   ├── Google OAuth SSO
│   ├── Phone verification (Voice OTP via 2Factor.in)
│   └── KYC (3-level: Personal → Document → Address)
│
├── SECURITY
│   ├── Honeypot + timing bot detection
│   ├── Disposable email blocking
│   ├── IP-based signup rate limiting
│   ├── Device fingerprinting
│   ├── CSRF HMAC nonces
│   ├── Cloudflare origin pin
│   ├── Admin IP allowlist
│   ├── Multi-account detection
│   ├── 24h new-device withdrawal cooldown
│   ├── 24h password-change withdrawal cooldown
│   └── Email OTP for every withdrawal
│
├── FINANCE
│   ├── Three-balance wallet (Main / Trading / Profit)
│   ├── USDT deposits (TRON on-chain, auto-credited)
│   ├── INR deposits (UPI/NetBanking via merchants)
│   ├── USDT withdrawals (on-chain, admin approval for large amounts)
│   ├── INR withdrawals (bank transfer via merchants)
│   ├── User-to-user USDT transfer
│   ├── Internal wallet-to-wallet transfers
│   ├── Transaction history with filters
│   └── Double-entry ledger / reconciliation
│
├── INVESTMENT & TRADING
│   ├── Auto-trading (start/stop with risk level)
│   ├── Three risk levels (Conservative / Balanced / Aggressive)
│   ├── Drawdown protection (auto-pause at 3%/5%/10%)
│   ├── Auto-compounding toggle
│   ├── Auto Signal Engine (100 trades/day, Mon–Fri)
│   ├── 4 trading pairs (BTC, Gold, EUR/USD, Oil)
│   ├── Live price anchors (Kraken, Stooq)
│   ├── Manual signal trades (admin-opened)
│   ├── Self-trade (user-initiated single trade)
│   ├── Monthly trading→profit sweep (25th)
│   └── Proportional profit distribution
│
├── ANALYTICS & REPORTING
│   ├── Equity curve (time-series chart)
│   ├── Drawdown chart
│   ├── P&L history
│   ├── Monthly performance
│   ├── Rolling returns
│   ├── Win/loss ratio display
│   ├── Performance metrics (win rate, avg return, risk score)
│   ├── Fund stats
│   └── PDF/CSV report generation
│
├── REFERRAL & REWARDS
│   ├── Unique referral code per user
│   ├── 3% first-investment sponsor bonus
│   ├── Monthly team profit bonus
│   ├── Points & tasks system (daily/weekly/social)
│   ├── Task proof submission + admin review
│   ├── Reward catalog (points → prizes)
│   ├── VIP levels
│   └── Leaderboards (referrals, investors, rewards)
│
├── PROMOTIONS
│   ├── Rotating HMAC-derived personalized offers
│   ├── Scheduled holiday promotions (admin-created)
│   ├── Atomic redemption with cap management
│   └── 24h TTL auto-expiry of stale redemptions
│
├── ENGAGEMENT
│   ├── AI chatbot (GPT, lead conversion)
│   ├── Guest chat sessions (no login required)
│   ├── Chat-to-lead CRM pipeline
│   ├── Automated chat follow-up sequences
│   ├── Telegram personal alerts (opt-in)
│   ├── In-app notifications
│   ├── Email notifications
│   ├── Market insights page
│   ├── Bot trading terminal (visual)
│   └── Demo equity boost (visual engagement)
│
├── ADMIN OPERATIONS
│   ├── User management (freeze/disable/edit)
│   ├── Balance adjustment
│   ├── Profit distribution (manual + auto cron)
│   ├── Withdrawal approval workflow
│   ├── INR deposit/withdrawal approval
│   ├── KYC document review
│   ├── Signal trade management
│   ├── Auto-engine control
│   ├── Fraud intelligence dashboard
│   ├── Broadcast notifications + email campaigns
│   ├── System settings management
│   ├── Ledger & reconciliation
│   ├── Audit log
│   ├── Server log viewer
│   ├── Sub-admin RBAC management
│   ├── Merchant account management
│   ├── Service subscription billing tracker
│   ├── Blog / content management
│   ├── Chat leads CRM
│   └── Escalation contacts + auto-escalation
│
└── MERCHANT OPERATIONS
    ├── INR deposit approval/rejection
    ├── INR withdrawal claim + payment
    ├── Payment method management (UPI/bank)
    ├── Merchant INR balance tracking
    └── Separate merchant portal (own login)
```

---

## 29. API FLOW STRUCTURE

### Flow 1: User Registration → First Trade

```
Client                          API Server                    DB / Services
  │                                │                               │
  ├─POST /auth/register ──────────►│                               │
  │  {name, email, pass, captcha}  │── verify captcha (Turnstile) ►│
  │                                │── check honeypot              │
  │                                │── check timing                │
  │                                │── check disposable email      │
  │                                │── check IP rate limit ────────►Redis
  │                                │── INSERT user ────────────────►Postgres
  │                                │── INSERT wallet ──────────────►Postgres
  │                                │── send OTP email ─────────────►AWS SES
  │◄──────────────── 201 {message} │                               │
  │                                │                               │
  ├─POST /auth/verify-email ───────►│                               │
  │  {otp}                         │── verify OTP ─────────────────►Postgres
  │                                │── mark email_verified_at ─────►Postgres
  │◄──────────────── 200 {ok}      │                               │
  │                                │                               │
  ├─POST /auth/login ──────────────►│                               │
  │  {email, password}             │── rate limit ─────────────────►Redis
  │                                │── bcrypt compare ─────────────►Postgres
  │                                │── check device fingerprint    │
  │                                │── store login_event ──────────►Postgres
  │                                │── geolocate IP ───────────────►ip-api.com
  │                                │── send new-device email ───────►AWS SES
  │◄── 200 {accessToken, user}     │                               │
  │                                │                               │
  ├─POST /investment/start ────────►│ (JWT in Authorization header) │
  │  {amount, riskLevel}           │── verify JWT                  │
  │                                │── check wallet balance ────────►Postgres
  │                                │── UPDATE wallet (main↓, trading↑)►Postgres
  │                                │── UPSERT investment ──────────►Postgres
  │                                │── INSERT transaction ─────────►Postgres
  │◄── 200 {investment}            │                               │
```

### Flow 2: Auto Signal Trade → Profit Distribution

```
Cron (every 1 min)              API Server                    DB / Redis
  │                                │                               │
  ├─tick() ───────────────────────►│                               │
  │                                │── load daily plan ────────────►Redis
  │                                │── find next due slot          │
  │                                │── fetch live price ───────────►Kraken API
  │                                │── INSERT signal_trade ─────────►Postgres
  │                                │── compute exit price          │
  │◄── trade opened                │                               │
  │                                │                               │
  │  (4–6 min later)               │                               │
  │                                │                               │
  ├─tick() ───────────────────────►│                               │
  │                                │── mark trade closed ──────────►Postgres
  │                                │── get all active investors ───►Postgres
  │                                │── compute each user share     │
  │                                │── INSERT distributions ────────►Postgres
  │                                │── UPDATE trading balances ─────►Postgres
  │                                │── enqueue profit events ───────►BullMQ/Redis
  │◄── trade closed + distributed  │                               │
  │                                │                               │
  │                          Profit Worker                         │
  │                                │── process event ──────────────►Redis
  │                                │── INSERT notifications ────────►Postgres
  │                                │── send Telegram alerts ────────►Telegram API
```

### Flow 3: INR Deposit via Merchant

```
User          App              API Server         Merchant App        DB
  │             │                  │                   │               │
  ├─select UPI ►│                  │                   │               │
  │             ├─GET /payment-methods►               │               │
  │             │◄──── methods ────│                   │               │
  ├─transfers   │                  │                   │               │
  │  money      │                  │                   │               │
  │  (external) │                  │                   │               │
  │             │                  │                   │               │
  ├─enter UTR  ►│                  │                   │               │
  │ + upload   │─POST /inr-deposits►                  │               │
  │  proof      │                  │── INSERT inr_deposit►            │
  │             │◄── 201 pending   │                   │               │
  │             │                  │                   │               │
  │             │           (Escalation cron fires)    │               │
  │             │                  │── alert merchant ─►               │
  │             │                  │                   │               │
  │             │                  │                   ├─POST /merchant/
  │             │                  │                   │  inr-deposits/:id/approve
  │             │                  │◄─── approve ──────│               │
  │             │                  │── UPDATE status ──────────────────►
  │             │                  │── credit USDT to wallet ──────────►
  │             │                  │── INSERT transaction ─────────────►
  │             │                  │── notify user ────────────────────►
  ├─sees balance│                  │                   │               │
  │  updated   ◄│─GET /wallet ─────│                   │               │
```

### Flutter API Integration Pattern

```dart
// Recommended pattern for each API call in Flutter

class AuthRepository {
  final Dio _dio;
  
  Future<LoginResponse> login(LoginRequest req) async {
    try {
      final resp = await _dio.post('/auth/login', data: req.toJson());
      return LoginResponse.fromJson(resp.data);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

// State management with Riverpod
final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);

// HTTP client setup
final dio = Dio(BaseOptions(
  baseUrl: 'https://api.qorixmarkets.com/api',
  headers: {
    'Content-Type': 'application/json',
    // CSRF token added via interceptor
  },
))
..interceptors.add(AuthInterceptor()); // adds JWT to all requests

// Token storage
const storage = FlutterSecureStorage();
await storage.write(key: 'accessToken', value: token);
```

---

*Document generated from full codebase analysis — May 2026*
*Use this as the primary reference for Flutter rebuild*
*API base URL: https://api.qorixmarkets.com/api*
*All endpoints accept/return JSON*
*JWT passed as: Authorization: Bearer <token>*
