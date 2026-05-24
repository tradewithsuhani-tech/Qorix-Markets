# Qorix Markets — Flutter Production Pack
> Complete asset reference for Flutter UI development. May 2026.

---

## SECTION 1 — SCREENSHOT GUIDE (Per Screen)

> Note: The web app requires authentication for all inner screens. Screenshots of public screens (landing, login, signup) are captured. For authenticated screens, detailed UI descriptions are provided based on source code analysis.

### Screen Index

| # | Screen | Route | Auth | Status |
|---|---|---|---|---|
| 01 | Landing / Home | `/` | No | ✅ Captured |
| 02 | Login | `/login` | No | ✅ Captured |
| 03 | Signup / Register | `/signup` | No | ✅ Captured |
| 04 | Dashboard | `/dashboard` | Yes | 📝 Described |
| 05 | Wallet | `/wallet` | Yes | 📝 Described |
| 06 | Deposit | `/deposit` | Yes | 📝 Described |
| 07 | Withdraw | `/withdraw` | Yes | 📝 Described |
| 08 | P2P Board | `/p2p` | Yes | 📝 Described |
| 09 | Trade History | `/trades` | Yes | 📝 Described |
| 10 | Bot Terminal | `/terminal` | Yes | 📝 Described |
| 11 | Profile | `/profile` | Yes | 📝 Described |
| 12 | Referral | `/referral` | Yes | 📝 Described |
| 13 | Notifications | `/notifications` | Yes | 📝 Described |
| 14 | Analytics | `/analytics` | Yes | 📝 Described |
| 15 | KYC | `/kyc` | Yes | 📝 Described |

---

### Screen UI Descriptions (for Flutter reference)

#### Dashboard (Home Tab)
```
Layout: ScrollView, dark background
─ Header row: Avatar (blue/purple gradient circle) + name + greeting + search icon + bell icon
─ [If trading active]: DeployedStrategyCard — shows bot name, PnL%, drawdown bar
─ 2×2 Stats grid:
    [TOTAL EQUITY] $12,847  [DAILY P&L] +$102.78
    [ACTIVE FUND]  $5,000   [TOTAL PROFIT] +$380.50
─ Promo banner carousel (horizontal scroll, gradient cards)
─ VIP Tier badge (Gold/Platinum progress bar)
─ Bot Intelligence card (purple glow, live pulse dot)
─ AI Bot Status card (strategy name + risk tier)
─ "Best bot result" section (horizontal scroll of BotStrategyCards)
─ Modals: PromoPopup on load (dismissible), DrawdownBanner if limit hit
```

#### Wallet Tab
```
Layout: FlatList with header component
─ Title "Wallet"
─ BalanceCardPro (large card):
    - Total balance (large number, hide/show toggle)
    - +/- daily PnL in green/red
    - 3 action buttons: [Deposit] [Withdraw] [Transfer]
─ "Transaction History" section header + "See more" link
─ List of TransactionItems:
    - Icon circle (colored by type) + title + date
    - Amount (green = credit, red = debit)
    - Status badge (completed/pending/failed)
```

#### Deposit Screen
```
Layout: KeyboardAvoiding ScrollView
─ Back button (←)
─ Title "Add Funds"
─ Current Balance card
─ Currency switcher: [₹ INR] [₮ USDT] (pill toggle)
─ Amount input (large, 64px height)
─ Quick amount buttons: ₹5K / ₹10K / ₹25K / ₹50K (for INR)
                        $60 / $120 / $300 / $600 (for USDT)
─ Payment method list:
    INR:  UPI (→) | Net Banking (→) | IMPS/NEFT (selectable)
    USDT: USDT TRC20 (→) | BTC (→) | ETH (→) | SOL (→) | XRP (→)
─ Deposit button (purple, full-width)
```

#### USDT Deposit (Crypto QR Screen)
```
Layout: ScrollView
─ Back button (←)
─ Title "Deposit USDT"
─ QR Card (glass card):
    - Crypto icon + network badge (LIVE green dot)
    - Amount summary: "Send 100 USDT → ₹9,800"
    - QR code (white background, 172px)
    - Wallet address (copyable, truncated middle)
    - Warning box (red, "Send only USDT via TRC20")
─ Security note
─ "I've Sent the Transfer" button (purple)
```

#### Withdraw Screen
```
Layout: KeyboardAvoiding ScrollView
─ Back button (←)
─ Title "Withdraw Funds"
─ Available balance card (shows INR + USD equivalent)
─ Compliance rules box (amber/orange)
─ Currency switcher: [₹ INR] [₮ USDT]
─ Amount input (large) + FX hint below
─ Quick % shortcuts: 25% / 50% / 75% / MAX
─ Method list:
    INR:  UPI (→) | Bank Transfer (→)
    USDT: USDT TRC20 (→) | BTC (→) | ETH (→)
─ Security note
```

#### P2P Board
```
Layout: ScrollView/FlatList
─ Header: "P2P Trading" + "Post Ad" button
─ Tab bar: [BUY] [SELL]
─ Filter row: All / UPI / Bank Transfer / IMPS
─ Ad cards (list):
    - Merchant name + verification badge
    - Price (₹96.50/USDT) — prominent
    - Available: 380 USDT | Limits: ₹500 – ₹50,000
    - Payment method pills
    - [Buy USDT] / [Sell USDT] button (green/red)
```

#### P2P Order Detail
```
Layout: ScrollView + SSE-connected
─ Order header: Order ID + status badge + countdown timer
─ Trade summary: fiatAmount ↔ usdtAmount at price
─ Buyer/Seller info cards
─ Action section (changes based on role + status):
    Buyer: [Mark as Paid] → [Wait for release]
    Seller: [Confirm Receipt] → [Release USDT]
─ Chat section (message bubbles, bottom input)
─ Dispute button (danger, small)
```

#### Profile Tab
```
Layout: ScrollView
─ Header: Large avatar + name + email + KYC badge
─ Stats row: Total profit | Total trades | Days active
─ Menu sections:
    Account: KYC Verification | Referral Program | VIP Status
    Security: 2FA | Change Password | Trusted Devices
    Preferences: Notifications | Telegram Alerts
    Support: Help Center | Chat Support
    [Logout] (red)
```

#### Bot Terminal
```
Layout: Complex ScrollView
─ 4 live price tickers (XAUUSD / EURUSD / BTCUSD / USOIL)
    - Each: symbol + bid/ask + change% + micro sparkline
    - Ticking every 1.5s with color flash
─ Open Positions card:
    - Position rows: symbol + direction + size + live PnL
    - Total unrealized PnL (updates live)
─ Bot Plan Progress: progress bar 0-100% (daily plan)
─ Distribution preview (user's share of today's profit)
─ Settings: [Stop Bot] button
```

#### Analytics / Portfolio
```
Layout: ScrollView
─ Period selector: 1D | 1W | 1M | 3M | ALL
─ Equity curve (area chart, green filled, touchable)
─ Stats row: Win Rate | Sharpe Ratio | Max Drawdown
─ Daily P&L bar chart (green positive, red negative)
─ Trade distribution: equity / fno / crypto (donut or bars)
─ Top Gainers + Top Losers sections
```

---

## SECTION 2 — COMPLETE DESIGN TOKENS

### Color Tokens (All Production Values)

```
BACKGROUNDS
background:     #0B1014   rgb(11,16,20)
card:           #11161E   rgb(17,22,30)
cardElevated:   #161D28   rgb(22,29,40)
input:          #0F1823   rgb(15,24,35)
secondary:      #1A2332   rgb(26,35,50)
overlay:        rgba(0,0,0,0.7)

BORDERS
border:         rgba(148,163,184,0.10)   #94A3B81A
borderBright:   rgba(255,255,255,0.15)   #FFFFFF26
borderFocus:    #8B5CF6 (1.5px width on active inputs)

TEXT
foreground:     #F9FAFB   rgb(249,250,251)
textSecondary:  #94A3B8   rgb(148,163,184)
textMuted:      #475569   rgb(71,85,105)

BRAND
blue:           #3B82F6   rgb(59,130,246)   — web primary
purple:         #8B5CF6   rgb(139,92,246)   — mobile primary
purpleLight:    #A78BFA   rgb(167,139,250)
purpleDark:     #7C3AED   rgb(124,58,237)
pink:           #EC4899   rgb(236,72,153)

SEMANTIC
green:          #22C55E   rgb(34,197,94)    — profit/success
greenDark:      #16A34A   rgb(22,163,74)
red:            #EF4444   rgb(239,68,68)    — loss/error
orange:         #F59E0B   rgb(245,158,11)   — warning/VIP
gold:           #EAB308   rgb(234,179,8)    — premium tier
amber:          #F59E0B   rgb(245,158,11)   — USDT accent
teal:           #0EA5E9   rgb(14,165,233)   — info
```

### Gradient Tokens

```
BRAND GRADIENT (header text, CTAs)
direction: left → right
stops: #3B82F6 0% → #8B5CF6 50% → #EC4899 100%

BUTTON GRADIENT (primary button)
direction: 135deg
stops: #7C3AED 0% → #8B5CF6 100%

PROFIT GRADIENT (profit cards)
direction: top-left → bottom-right
stops: #22C55E 0% → #16A34A 100%

GLASS SURFACE (glassmorphism cards)
direction: 135deg
stops: rgba(255,255,255,0.06) 0% → rgba(255,255,255,0.02) 100%
+ backdrop-filter: blur(20px) saturate(180%)

DARK CARD GRADIENT (deep surfaces)
direction: top-left → bottom-right
stops: #0F1823 0% → #0B1219 100%

GREEN GLOW GRADIENT (equity chart fill)
direction: top → bottom
stops: rgba(34,197,94,0.3) 0% → rgba(34,197,94,0.0) 100%

AVATAR GRADIENT (user initials circle)
direction: top-left → bottom-right
stops: #3B82F6 0% → #8B5CF6 100%

VIP GOLD GRADIENT
stops: #F59E0B 0% → #EAB308 50% → #D97706 100%
```

### Shadow / Glow Tokens

```
STANDARD CARD SHADOW
box-shadow: 0 4px 12px rgba(0,0,0,0.30)
Flutter: BoxShadow(color: Color(0x4D000000), blurRadius: 12, offset: Offset(0,4))

BLUE GLOW (primary interaction)
box-shadow: 0 0 30px rgba(59,130,246,0.12)
Flutter: BoxShadow(color: Color(0x1F3B82F6), blurRadius: 30, spreadRadius: 0)

GREEN GLOW (profit/success)
box-shadow: 0 0 14px rgba(16,185,129,0.55), 0 0 4px rgba(16,185,129,0.3)
Flutter: BoxShadow(color: Color(0x8C10B981), blurRadius: 14, spreadRadius: -2)

PURPLE GLOW (brand/hover)
box-shadow: 0 0 20px rgba(139,92,246,0.20), 0 0 6px rgba(139,92,246,0.10)
Flutter: BoxShadow(color: Color(0x338B5CF6), blurRadius: 20, spreadRadius: -4)

BUTTON ACTIVE GLOW
box-shadow: 0 4px 16px rgba(139,92,246,0.40)
Flutter: BoxShadow(color: Color(0x668B5CF6), blurRadius: 16, offset: Offset(0,4))

GOLD GLOW (VIP tier cards)
box-shadow: 0 0 24px rgba(234,179,8,0.25)
Flutter: BoxShadow(color: Color(0x40EAB308), blurRadius: 24)

RED GLOW (error/loss)
box-shadow: 0 0 12px rgba(239,68,68,0.20)
Flutter: BoxShadow(color: Color(0x33EF4444), blurRadius: 12)
```

### Border Radius Tokens

```
xs:    4px    — tags, tiny badges
sm:    8px    — small buttons, pills interior
md:    10px   — icon buttons, small cards
base:  12px   — standard cards, inputs, buttons (DEFAULT)
lg:    16px   — hero cards, main balance card
xl:    20px   — bottom sheets
xxl:   24px   — large modals, onboarding cards
pill:  9999px — status badges, tag pills, toggles
```

### Typography Scale

```
DISPLAY     36px  weight:800  letterSpacing:-0.5  — hero numbers, big balance
H1          24px  weight:700  letterSpacing:-0.3  — screen titles
H2          20px  weight:700  letterSpacing:0     — section headers
H3          16px  weight:600  — card titles
BODY_LARGE  15px  weight:500  height:1.5          — primary content
BODY        14px  weight:400  height:1.5          — standard text
BODY_SMALL  13px  weight:400  height:1.5  color:textSecondary
LABEL       12px  weight:500  letterSpacing:0.3   — form labels
LABEL_SM    10px  weight:700  letterSpacing:1.2   — uppercase badges
CAPTION     11px  weight:400  — hints, footnotes

PRICE_XL    32px  font:SpaceMono  weight:700  — main balance display
PRICE_LG    22px  font:SpaceMono  weight:700  — card balances
PRICE       16px  font:SpaceMono  weight:600  — price ticks
PRICE_SM    13px  font:SpaceMono  weight:600  — small price data
```

### Spacing System

```
Base unit: 4px

xs:    4px
sm:    8px
md:    12px
base:  16px  ← screen horizontal padding
lg:    20px
xl:    24px
xxl:   32px
xxxl:  48px

Screen padding:  horizontal 16px, vertical 16px + safe area
Card padding:    16px all sides
Card padding sm: 12px all sides
Section gap:     14px between major sections
List item gap:   0 (divider lines) or 8px
Icon button:     36×36px (md radius) or 40×40px (md radius)
Button height:   56px (primary) | 48px (secondary) | 40px (small)
Tab bar height:  72px + bottom safe area
Input height:    52px (standard) | 64px (amount input)
```

### Animation Timing

```
DURATIONS
fast:     150ms   — micro-interactions, button press
normal:   200ms   — hover states, icon transitions  
medium:   300ms   — panel transitions, small slides
page:     400ms   — screen entry animations
slow:     500ms   — content reveal
verySlow: 800ms   — number counter animations

CURVES
easeOut:       Cubic(0.0, 0.0, 0.2, 1.0) — elements entering
easeIn:        Cubic(0.4, 0.0, 1.0, 1.0) — elements leaving
easeInOut:     Cubic(0.4, 0.0, 0.2, 1.0) — repositioning
spring:        SpringSimulation(mass:1, stiffness:200, damping:20)
bounceIn:      ElasticIn — success confirmations only

SPECIFIC ANIMATIONS
Screen entry:        FadeInDown 20px, 400ms, easeOut
List item stagger:   50ms delay per item, max 10 items
Price tick flash:    0ms→700ms: foreground→green/red→foreground
Balance counter:     800ms, easeOutCubic, old→new value
Skeleton shimmer:    1600ms infinite linear
Float animation:     8000ms infinite sinusoidal ±10px
Modal slide-up:      350ms, easeOutCubic, from 100% bottom
Bot pulse ring:      2000ms infinite scale 1.0→1.5, opacity 1→0
```

---

## SECTION 3 — UX PRIORITY RANKING (Retention Impact)

### Priority Tier 1 — CRITICAL (Build First, Perfect These)

#### 1. Deposit Flow — #1 Priority
```
Why: Zero deposits = zero revenue. This is the money-in gate.
Key screens: Deposit → USDT QR (most used) | UPI flow
Must-haves:
  - QR code must render instantly
  - Real TRC20 address from API (not static)
  - Copy address with haptic feedback
  - Clear min deposit (1 USDT)
  - "Deposit detected" push notification (even if delayed)
  - Status: pending → confirmed animation
Friction to eliminate: Any loading state on QR screen
```

#### 2. Dashboard — #2 Priority
```
Why: First screen after login. Sets the emotional tone of the product.
Must-haves:
  - Animated number counter for total balance
  - Green glowing equity curve (30-day)
  - Live win rate + active trade count
  - Bot "breathing" pulse animation
  - Pull-to-refresh with satisfying haptic
  - Balance should update within 30s automatically
Friction to eliminate: Empty state (show demo data until first deposit)
```

#### 3. Start Trading / Deploy Capital — #3 Priority
```
Why: This is the core action — capital deployment = active engagement.
Key flow: Wallet → Transfer → Deploy → Risk Select → Confirm
Must-haves:
  - Animated risk level selector (3 cards: Conservative/Moderate/Aggressive)
  - Show projected daily return for each tier
  - Clear drawdown limit explanation
  - Satisfying "Bot Activated" success animation (confetti/pulse)
  - Immediate feedback (bot starts "scanning" immediately)
Friction to eliminate: Confusing balance types (main vs trading)
```

### Priority Tier 2 — HIGH (Build Second)

#### 4. Wallet / Balance Screen — #4 Priority
```
Why: Users check this multiple times daily. Trust is built here.
Must-haves:
  - 4 balance tiles clearly separated (INR / USDT / Trading / Profit)
  - Transaction history loading fast (skeleton → data)
  - Pull-to-refresh
  - Balance hide/show toggle (privacy mode)
  - Pagination for transaction history
```

#### 5. Withdrawal Flow — #5 Priority
```
Why: If users can't withdraw, they lose trust and churn.
Key screens: Withdraw → USDT address entry OR UPI ID
Must-haves:
  - Clear compliance rules upfront
  - Real-time balance check
  - Address validation (TRC20 must start with T, 34 chars)
  - Device cooldown warning shown prominently
  - Expected time: "within 24 hours"
  - Email OTP step
```

#### 6. P2P Trading — #6 Priority
```
Why: Differentiator feature, drives USDT liquidity.
Must-haves:
  - Ad list with real-time price display
  - Order chat with SSE real-time messages
  - Countdown timer (payment deadline)
  - Clear BUY/SELL flow with escrow explanation
  - Status progression visualization
```

### Priority Tier 3 — MEDIUM (Build Third)

#### 7. Referral Program — #7 Priority
```
Why: Viral growth engine. Every referral = free user acquisition.
Must-haves:
  - Big referral code display (copy + share)
  - Share button with pre-filled message
  - Referred user list with their deposit status
  - Earnings breakdown (pending / paid)
  - Referral link with UTM params
```

#### 8. Notifications — #8 Priority
```
Why: Keeps users returning to the app.
Must-haves:
  - Unread badge on bottom nav
  - Type-specific icons (deposit=green, withdrawal=orange, trade=blue)
  - Mark all as read
  - Tap to navigate to relevant screen
```

#### 9. Bot Terminal — #9 Priority  
```
Why: Creates "trading dopamine" — users feel the bot is working for them.
Must-haves:
  - Live price ticks (1.5s updates) with color flash
  - Open positions with live unrealized PnL
  - Bot plan progress bar
  - "Trading is working for you" feeling
```

### Priority Tier 4 — LOWER (Build Last)

| Feature | Why Lower Priority |
|---|---|
| KYC | Gating feature, not daily-use |
| 2FA setup | Security, not onboarding |
| Analytics deep-dive | Nice-to-have, not first-week need |
| Tasks & Points | Engagement, but not core flow |
| Leaderboard | Not yet in production backend |
| VIP tiers | Aspirational, needs actual users first |
| Quiz/Giveaways | Beta feature |

---

## SECTION 4 — PRODUCTION JSON EXAMPLES

### 4.1 Wallet Response — `GET /api/wallet`
```json
{
  "mainBalance": "24500.00000000",
  "tradingBalance": "5000.00000000",
  "profitBalance": "382.75000000",
  "usdtBalance": "150.25000000",
  "points": 310
}
```
> Flutter display math:
> - Main INR: ₹24,500
> - USDT Wallet: $150.25
> - Trading: $5,000.00
> - Profit: $382.75
> - Total USD: (24500/98) + 150.25 + 5000 + 382.75 = $5,783.02
> - Total INR: $5,783.02 × 98 = ₹5,66,736

---

### 4.2 Dashboard Summary — `GET /api/dashboard/summary`
```json
{
  "totalBalance": 5783.02,
  "dailyProfitLoss": 25.48,
  "dailyProfitPercent": 0.4823,
  "activeInvestment": true,
  "riskLevel": "medium",
  "tradingBalance": 5000.0,
  "profitBalance": 382.75
}
```

---

### 4.3 Investment Status — `GET /api/investment`
```json
{
  "id": 14,
  "amount": "5000.00000000",
  "riskLevel": "medium",
  "isActive": true,
  "isPaused": false,
  "autoCompound": false,
  "totalProfit": "382.75000000",
  "dailyProfit": "25.48000000",
  "drawdown": "0.84",
  "drawdownLimit": "5.00",
  "peakBalance": "5382.75000000",
  "startedAt": "2026-04-15T10:00:00.000Z",
  "stoppedAt": null
}
```

---

### 4.4 Trades List — `GET /api/investment/trades`
```json
[
  {
    "id": 2841,
    "symbol": "XAUUSD",
    "direction": "buy",
    "entryPrice": "2338.40",
    "exitPrice": "2349.85",
    "profit": "11.45",
    "profitPercent": "0.4896",
    "executedAt": "2026-05-24T09:15:22.000Z"
  },
  {
    "id": 2840,
    "symbol": "EURUSD",
    "direction": "sell",
    "entryPrice": "1.0870",
    "exitPrice": "1.0852",
    "profit": "9.00",
    "profitPercent": "0.1656",
    "executedAt": "2026-05-24T08:47:11.000Z"
  },
  {
    "id": 2839,
    "symbol": "BTCUSD",
    "direction": "buy",
    "entryPrice": "66840.00",
    "exitPrice": "67185.00",
    "profit": "3.45",
    "profitPercent": "0.5162",
    "executedAt": "2026-05-24T08:22:05.000Z"
  },
  {
    "id": 2838,
    "symbol": "XAUUSD",
    "direction": "sell",
    "entryPrice": "2352.10",
    "exitPrice": "2344.80",
    "profit": "7.30",
    "profitPercent": "0.3103",
    "executedAt": "2026-05-23T15:55:40.000Z"
  },
  {
    "id": 2837,
    "symbol": "USOIL",
    "direction": "buy",
    "entryPrice": "78.24",
    "exitPrice": "78.65",
    "profit": "-2.05",
    "profitPercent": "-0.5240",
    "executedAt": "2026-05-23T14:30:18.000Z"
  }
]
```

---

### 4.5 Transaction History — `GET /api/transactions?page=1&limit=20`
```json
{
  "data": [
    {
      "id": 1084,
      "type": "profit",
      "amount": "25.48000000",
      "status": "completed",
      "description": "Daily profit distribution — 2026-05-24",
      "walletAddress": null,
      "txHash": null,
      "createdAt": "2026-05-24T23:59:00.000Z"
    },
    {
      "id": 1083,
      "type": "profit",
      "amount": "24.92000000",
      "status": "completed",
      "description": "Daily profit distribution — 2026-05-23",
      "walletAddress": null,
      "txHash": null,
      "createdAt": "2026-05-23T23:59:00.000Z"
    },
    {
      "id": 1071,
      "type": "deposit",
      "amount": "150.25000000",
      "status": "completed",
      "description": "USDT TRC20 deposit confirmed",
      "walletAddress": "TRx9K8mQ2pLnJ4vXcYdF7wBzEtA3sHoU1",
      "txHash": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd",
      "createdAt": "2026-05-20T14:32:10.000Z"
    },
    {
      "id": 1052,
      "type": "transfer",
      "amount": "5000.00000000",
      "status": "completed",
      "description": "Transfer to trading balance",
      "walletAddress": null,
      "txHash": null,
      "createdAt": "2026-05-15T11:20:00.000Z"
    },
    {
      "id": 1048,
      "type": "withdrawal",
      "amount": "50.00000000",
      "status": "pending",
      "description": "USDT withdrawal to TRx9K8...",
      "walletAddress": "TRx9K8mQ2pLnJ4vXcYdF7wBzEtA3sHoU1",
      "txHash": null,
      "createdAt": "2026-05-14T09:15:00.000Z"
    }
  ],
  "total": 47,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

### 4.6 Notifications — `GET /api/notifications?page=1&limit=20`
```json
{
  "notifications": [
    {
      "id": 512,
      "type": "deposit",
      "title": "USDT Deposit Confirmed",
      "message": "150.25 USDT has been credited to your USDT wallet. Your balance is now $150.25.",
      "isRead": false,
      "createdAt": "2026-05-20T14:32:15.000Z"
    },
    {
      "id": 511,
      "type": "trade",
      "title": "Daily Profit Distributed",
      "message": "Your bot earned $25.48 today (+0.48%). Profit added to your balance.",
      "isRead": false,
      "createdAt": "2026-05-24T23:59:05.000Z"
    },
    {
      "id": 510,
      "type": "system",
      "title": "Drawdown Alert",
      "message": "Your portfolio drawdown reached 2.4% of the 5% limit. Bot is continuing with caution.",
      "isRead": true,
      "createdAt": "2026-05-22T13:45:00.000Z"
    },
    {
      "id": 509,
      "type": "withdrawal",
      "title": "Withdrawal Approved",
      "message": "Your withdrawal of 50 USDT has been approved and will be processed within 24 hours.",
      "isRead": true,
      "createdAt": "2026-05-14T11:00:00.000Z"
    },
    {
      "id": 508,
      "type": "kyc",
      "title": "KYC Approved",
      "message": "Your identity verification is complete. You now have full access to all platform features.",
      "isRead": true,
      "createdAt": "2026-05-10T09:30:00.000Z"
    }
  ],
  "unreadCount": 2
}
```

---

### 4.7 P2P Ads — `GET /api/p2p/ads?type=SELL`
```json
{
  "ads": [
    {
      "id": 42,
      "userId": 18,
      "merchantName": "FastTrader99",
      "merchantKycVerified": true,
      "merchantTrades": 284,
      "merchantCompletionRate": 99.2,
      "type": "SELL",
      "asset": "USDT",
      "fiatCurrency": "INR",
      "price": "96.50",
      "quantity": "500.00000000",
      "filledQuantity": "120.00000000",
      "availableQuantity": "380.00000000",
      "minLimit": "500.00",
      "maxLimit": "48130.00",
      "paymentMethods": ["upi", "bank_transfer"],
      "terms": "Payment within 15 minutes. GPay/PhonePe preferred.",
      "timeLimit": 15,
      "status": "active",
      "createdAt": "2026-05-24T08:00:00.000Z"
    },
    {
      "id": 41,
      "userId": 31,
      "merchantName": "CryptoKing_IN",
      "merchantKycVerified": true,
      "merchantTrades": 156,
      "merchantCompletionRate": 97.4,
      "type": "SELL",
      "asset": "USDT",
      "fiatCurrency": "INR",
      "price": "96.80",
      "quantity": "1000.00000000",
      "filledQuantity": "340.00000000",
      "availableQuantity": "660.00000000",
      "minLimit": "1000.00",
      "maxLimit": "63888.00",
      "paymentMethods": ["bank_transfer", "imps"],
      "terms": "NEFT/IMPS only. No UPI for orders above ₹20K.",
      "timeLimit": 20,
      "status": "active",
      "createdAt": "2026-05-23T18:30:00.000Z"
    }
  ]
}
```

---

### 4.8 User Profile — `GET /api/auth/me`
```json
{
  "id": 42,
  "email": "rahul.sharma@gmail.com",
  "fullName": "Rahul Sharma",
  "isAdmin": false,
  "kycStatus": "approved",
  "kycPersonalStatus": "approved",
  "kycAddressStatus": "not_submitted",
  "referralCode": "RAHUL7X",
  "emailVerified": true,
  "twoFactorEnabled": false,
  "telegramLinkedAt": null,
  "telegramOptIn": true,
  "points": 310,
  "sponsorId": 7,
  "tronAddress": "TRx9K8mQ2pLnJ4vXcYdF7wBzEtA3sHoU1",
  "createdAt": "2026-04-01T10:00:00.000Z"
}
```

---

### 4.9 Bot Quotes — `GET /api/bot-trading/quotes`
```json
{
  "quotes": [
    {
      "symbol": "XAUUSD",
      "bid": 2341.48,
      "ask": 2341.62,
      "change": 8.34,
      "changePct": 0.357
    },
    {
      "symbol": "EURUSD",
      "bid": 1.08542,
      "ask": 1.08558,
      "change": -0.00128,
      "changePct": -0.118
    },
    {
      "symbol": "BTCUSD",
      "bid": 67240.0,
      "ask": 67260.0,
      "change": 840.0,
      "changePct": 1.264
    },
    {
      "symbol": "USOIL",
      "bid": 78.42,
      "ask": 78.46,
      "change": -0.18,
      "changePct": -0.229
    }
  ],
  "updatedAt": "2026-05-24T10:30:01.234Z"
}
```

---

### 4.10 Equity Chart — `GET /api/equity-chart?days=30`
```json
[
  { "date": "2026-04-24", "equity": 5000.0, "profit": 0.0 },
  { "date": "2026-04-25", "equity": 5024.0, "profit": 24.0 },
  { "date": "2026-04-26", "equity": 5048.5, "profit": 48.5 },
  { "date": "2026-04-27", "equity": 5048.5, "profit": 48.5 },
  { "date": "2026-04-28", "equity": 5073.2, "profit": 73.2 },
  { "date": "2026-04-29", "equity": 5098.1, "profit": 98.1 },
  { "date": "2026-04-30", "equity": 5123.4, "profit": 123.4 },
  { "date": "2026-05-01", "equity": 5148.9, "profit": 148.9 },
  { "date": "2026-05-02", "equity": 5174.7, "profit": 174.7 },
  { "date": "2026-05-03", "equity": 5174.7, "profit": 174.7 },
  { "date": "2026-05-05", "equity": 5200.8, "profit": 200.8 },
  { "date": "2026-05-10", "equity": 5265.3, "profit": 265.3 },
  { "date": "2026-05-15", "equity": 5312.0, "profit": 312.0 },
  { "date": "2026-05-20", "equity": 5358.6, "profit": 358.6 },
  { "date": "2026-05-24", "equity": 5382.75, "profit": 382.75 }
]
```

---

### 4.11 Referral Stats — `GET /api/referral`
```json
{
  "referralCode": "RAHUL7X",
  "totalReferrals": 8,
  "activeReferrals": 5,
  "totalEarnings": "187.50",
  "pendingEarnings": "25.00",
  "paidEarnings": "162.50",
  "referralLink": "https://qorix.markets/signup?ref=RAHUL7X",
  "shareMessage": "Join Qorix Markets and earn passive income with AI trading! Use my referral code RAHUL7X and get a welcome bonus. 🚀"
}
```

---

## SECTION 5 — MOBILE DESIGN DIRECTION

### Overall Feeling

**"Professional Trading Platform meets Premium Consumer App"**

The app should feel like you're holding something serious in your hands — not a game, not a toy — but also not cold and corporate. Think: **Bloomberg Terminal aesthetics with Revolut's user warmth**.

---

### App Personality by Section

| Section | Feeling | Inspiration | Design Treatment |
|---|---|---|---|
| **Login / Signup** | Trustworthy, premium, calm | Revolut, N26 | Deep dark, centered card, green glow on CTA |
| **Dashboard** | Confident, energetic, alive | Bybit, Trading212 | Live numbers, ambient glow, bot "breathing" |
| **Bot Terminal** | Professional, intense, focused | Bloomberg, Bybit | Tight data density, green/red flashes, monospace |
| **Wallet / Deposit** | Secure, clear, reassuring | Binance, Coinbase | Clean cards, clear balance hierarchy |
| **P2P Trading** | Marketplace, transactional | LocalBitcoins, Binance P2P | Merchant cards, timer pressure, chat-like |
| **Profile / Settings** | Clean, minimal, organized | Revolut, Robinhood | Simple list UI, no visual noise |
| **Referral** | Exciting, social, rewarding | Cash App, Robinhood | Big share button, viral mechanics front-center |
| **Profit moments** | Celebratory, dopamine | Any game reward screen | Green confetti, scale animation, sound (optional) |

---

### Reference Apps Breakdown

#### Binance (primary reference)
- Take: Dark obsidian palette, compact data cards, green/red price coloring, tab navigation structure
- Avoid: Over-cluttered information density for casual investors

#### Bybit
- Take: Live bot terminal aesthetic, purple accent usage, smooth price ticker animations
- Avoid: Too many charts on a single screen

#### Revolut
- Take: Premium card design, clean typography, onboarding warmth, glassmorphism balance cards
- Avoid: Too minimal for a trading product

#### Robinhood
- Take: Emotional profit moments (green confetti), simple equity curves, "you're up X%" framing
- Avoid: US-only features, too casual for USDT trading

#### Coinbase
- Take: Trust signals everywhere, clear deposit/withdraw flows, QR code cleanliness
- Avoid: Too much blue, feels like corporate banking

#### Trading212
- Take: Portfolio pie charts, allocation visualization, multiple balance breakdowns
- Avoid: Complex options trading UI

---

### Key Design Decisions for Flutter

```
1. DARK ONLY — No light mode. The product is trading. Dark = serious.

2. PURPLE is primary on mobile, BLUE/GREEN are secondary.
   The brand gradient (blue→purple→pink) is for marketing/CTAs only.
   Everyday UI uses purple as the action color.

3. NUMBERS ANIMATE. All balance changes must visually transition.
   A static balance feels broken to traders. Use AnimatedSwitcher or
   custom tweening for every monetary value that can change.

4. GREEN = MONEY. Every positive PnL, every successful deposit,
   every profit notification uses #22C55E with a subtle glow.
   This trains users to associate green with reward.

5. HAPTICS ARE MANDATORY.
   - Light: navigation tap, toggle
   - Medium: button press, card select
   - Heavy: deposit/withdraw submit, bot activate
   - Success: deposit confirmed, profit received

6. GLASSMORPHISM for premium cards, solid fills for functional UI.
   Balance cards, summary tiles = glass.
   Transaction items, list rows = solid card background.

7. EMPTY STATES should show demo/simulated data with a subtle
   "Demo" watermark. Never show a blank screen to a new user.
   The product's value must be visible even before first deposit.

8. BOTTOM SHEET for confirmations and secondary flows.
   Do not use full-screen navigation for: deposit amount confirm,
   risk level selection, promo code entry, amount quick-select.

9. MICRO-ANIMATIONS on every interaction:
   - Card press: scale 0.97 + shadow reduce (50ms)
   - Button press: scale 0.95 (100ms)
   - Success icon: scale from 0 with spring + green glow pulse
   - Error shake: horizontal shake animation (300ms)

10. LOADING STATES must match the exact layout they replace.
    A skeleton for a 3-line transaction item must be 3 lines.
    Never show a spinner where a skeleton can go.
```

---

### Color Usage by Screen Zone

```
HEADER AREAS
  - Screen titles: foreground (#F9FAFB) weight:700
  - Background: background (#0B1014), no elevation
  - Back button: card bg + border, foreground icon

BALANCE DISPLAY
  - Total balance: foreground, weight:800, SpaceMono
  - Positive PnL: green (#22C55E) with greenGlow shadow
  - Negative PnL: red (#EF4444)
  - Sub-balances: textSecondary (#94A3B8)

CARDS / TILES
  - Primary cards: card bg (#11161E) + border (10% white)
  - Highlighted cards: cardElevated (#161D28) + purple border
  - Glass cards: gradient overlay + blur

ACTION BUTTONS
  - Primary CTA: purple gradient + purpleGlow shadow
  - Destructive: red (#EF4444) background
  - Secondary: card bg + border + foreground text
  - Disabled: secondary bg + textMuted text

STATUS INDICATORS
  - LIVE dot: green (#22C55E) with pulse animation
  - Online: green (#22C55E)
  - Pending: orange (#F59E0B)
  - Error: red (#EF4444)
  - Info: blue (#3B82F6) or teal (#0EA5E9)
```

---

### Typography Emotional Hierarchy

```
The MOST important number on any screen = largest, brightest, monospace
Supporting context = smaller, textSecondary
Labels and units = smallest, textMuted, uppercase

Example — Balance Card:
  "$5,382.75"   → 32px SpaceMono Bold foreground      ← FOCUS HERE
  "+$25.48 today (+0.48%)"  → 14px Inter Medium green  ← CONTEXT
  "TOTAL PORTFOLIO"  → 10px Inter Bold uppercase muted  ← LABEL
```
