# Qorix Markets — Mobile Loading, Empty & Error States

> Exact conditions, data shapes, and recommended UI for every major screen.
> Use these to build correct, predictable Flutter screens.

---

## Global State Rules

### Loading State
Show skeleton/shimmer when:
- Initial data fetch in progress (`isLoading: true`)
- JWT present → API not yet responded

Never show loading for:
- Background refresh on cached data (use `isRefreshing` separately)
- Optimistic UI updates (show new value immediately, roll back on error)

### Empty State
Show when:
- API returned 200 with `data: []` or empty list
- First-time user with no activity

### Error State
Show when:
- Network unreachable
- API returned 4xx/5xx
- JWT expired (redirect to login instead of showing error)

---

## Dashboard

### Loading State
```dart
// Show skeleton cards for:
// - Total Balance card (large number)
// - Daily P&L card
// - Active Investment card
// - VIP tier badge
// - Bottom nav notification badge count
```

### Empty / New User State (all zero balances)
```
totalBalance: 0
activeInvestment: 0
isTrading: false
riskLevel: null
```
**UI:** Show onboarding CTA cards:
1. "Deposit USDT to get started" → `/wallet/deposit`
2. "Transfer to Trading Wallet" → `/wallet/transfer`
3. "Start AI Trading" → `/investment`

### Weekend State
```
dailyPnl.marketClosed: true
dailyPnl.marketOpensAt: <unix ms>   // Monday 00:00 UTC
```
**UI:** Replace "Daily P&L" value with "Markets Closed" label + countdown timer to `marketOpensAt`.

### Mid-day State (not all chunks dispensed)
```
dailyPnl.incrementsDone: 2
dailyPnl.incrementsTotal: 4
dailyPnl.nextChunkAt: <unix ms>    // next 4hr boundary
```
**UI:** Show subtle "next update" countdown in the Daily P&L card.
Don't show a progress bar — just the countdown label.

### Trading Paused (drawdown hit)
```
investment.isPaused: true
investment.drawdownFromPeak: 4.8   // near the limit
```
**UI:** Show amber "Capital Protection Active" banner with drawdown percentage.
Offer "Adjust Risk Level" or "Resume Trading" action.

---

## Wallet Screen

### Loading
```dart
// Shimmer for: mainBalance, tradingBalance, profitBalance, usdtBalance
```

### Zero Balance State
All balances are 0. Show:
- "Deposit USDT" primary CTA
- "How it works" explainer link

### Insufficient Balance (pre-validated)
```
// Before calling /wallet/withdraw:
if (amount > wallet.profitBalance) → show inline error "Insufficient balance"
// Never rely on server 400 — validate client-side first
```

### Withdrawal Locked States
Check `GET /auth/security-status` for lock reasons before showing the withdraw button:

| Error Code | Lock State | UI |
|---|---|---|
| `kyc_required` | KYC not done | Disable withdraw, show "Complete KYC" |
| `withdrawal_locked_new_account` | Account < 24h | Show hours remaining |
| `withdrawal_locked_password_change` | Password changed < 24h | Show `hoursLeft` + `lockedUntil` |

### Withdrawal OTP Flow States
```
1. Initial: show amount + address fields + "Request OTP" button
2. OTP Sent: show 6-digit OTP input + 10-min countdown + "Resend" link
3. Submitting: show loading on "Confirm Withdrawal" button
4. Success: show "Withdrawal submitted — pending admin approval" message
5. Error: show error.message inline
```

---

## Investment Screen

### Loading
```dart
// Shimmer: investment amount, risk badge, profit figures
```

### No Investment State
```
investment.isActive: false
investment.amount: 0
investment.startedAt: null
```
**UI:** "Start Trading" onboarding — show 3 risk-level cards (Low / Medium / High) with fee/protection info.

### Active Investment State
```
investment.isActive: true
investment.isPaused: false
```
**UI:** Show live stats, "Add Capital" and "Stop" actions.

### Paused Investment State
```
investment.isActive: true
investment.isPaused: true
investment.drawdownFromPeak: >limit
```
**UI:** Show amber "Trading Paused — Drawdown Limit Reached" card.
Show current drawdown % vs limit %.
Action buttons: "Adjust Protection Limit" | "Stop Strategy".

### Stopped Investment State
```
investment.isActive: false
investment.stoppedAt: "2026-05-20T..."
```
**UI:** Show historical summary (amount, totalProfit, stoppedAt date) with "Restart" CTA.

---

## Trade History

### Loading
```dart
// Shimmer list of 5 trade rows
```

### Empty State
```
{ data: [], total: 0, page: 1, totalPages: 0 }
```
**UI:** "No trades yet — your first trade will appear here once the bot executes."

### Profitable Trade
```
trade.profit > 0   // green, buy/sell icon
```

### Loss Trade
```
trade.profit < 0   // red
```
Note: losses show the AI's risk management working — frame positively ("Capital Protected").

### Pagination
```dart
// Load more on scroll-to-bottom (cursor-style)
// Query: ?page=<nextPage>&limit=20
// Stop loading when: page >= totalPages

// Show "Load More" button (not infinite scroll) for accessibility
```

---

## Notifications Screen

### Loading
```dart
// Shimmer 3 rows
```

### Empty State
```
{ notifications: [], unreadCount: 0 }
```
**UI:** "All caught up! No notifications yet."

### Unread Badge
```dart
// On app tab bar / bottom nav:
int unreadCount = response['unreadCount'];
// Show badge only when unreadCount > 0
// Cap display at "99+" for unreadCount > 99
```

---

## Transactions Screen

### Loading
```dart
// Shimmer list with skeleton rows
```

### Empty State
```
{ data: [], total: 0 }
```
**UI:** "No transactions yet. Make your first deposit to get started."

### Pending Withdrawal Row
```
transaction.type: "withdrawal"
transaction.status: "pending"
```
**UI:** Show amber "Pending" chip, "Awaiting approval" subtitle.
No cancel action — contact support.

### Failed Transaction
```
transaction.status: "failed"
```
**UI:** Show red "Failed" chip. Tap for support contact.

---

## P2P Order Detail

### Loading
```dart
// Shimmer the order header, status, and chat area
```

### Stream Connecting State
```
_streamConnected: false   // before 'ready' SSE event received
```
**UI:** Show subtle "Connecting..." indicator in header. Don't block the UI.

### Stream Reconnecting State
```
// After SSE error / disconnect
_streamConnected: false + reconnect attempt in progress
```
**UI:** Show amber "Reconnecting..." chip. Keep showing last known state.

### Order Status: pending
**UI:**
- Buyer: Show payment instructions + "Mark as Paid" button + 15-min countdown
- Seller: Show "Awaiting buyer payment" message

### Order Status: paid
**UI:**
- Seller: Show "Buyer has marked payment sent" alert + "Confirm Release" + "Raise Dispute" buttons
- Buyer: Show "Waiting for seller confirmation" spinner

### Order Status: completed
**UI:** Show green "Trade Complete" banner. Display settlement details. Prompt for rating.

### Order Status: cancelled / disputed
**UI:** Show respective banner with reason. Support contact CTA.

---

## Auth Screens

### Login Loading
```dart
// Disable submit button, show CircularProgressIndicator on button
// Never show full-screen loading for login
```

### requiresVerification (200, not an error)
```json
{ "requiresVerification": true, "email": "..." }
```
**UI:** Transition to OTP verify screen. Pre-fill email (read-only). Show 6-digit input + 10-min timer.

### requires2FA (200, not an error)
```json
{ "requires2FA": true, "twoFactorToken": "...", "ttlSeconds": 300 }
```
**UI:** Transition to TOTP screen. Show 5-min countdown. Offer "Use Email Backup Code" link.

### requiresApproval (200, new device)
```json
{ "requiresApproval": true, "pollToken": "...", "expiresAt": "..." }
```
**UI:** Show "Approve login on your other device" screen. Poll every 3s. Show countdown to `expiresAt`.

### Rate Limited (429)
```dart
// response.headers['retry-after'] → seconds to wait
// Show: "Too many attempts. Try again in <N> seconds."
// Disable submit button for <N> seconds with countdown
```

### JWT Expired (401 on any authenticated request)
```dart
// Clear stored token
// Show brief toast: "Session expired — please sign in again"
// Navigate to login (remove all routes from stack)
```

---

## KYC Gate

Shown when API returns `403` with `error: "kyc_required"`.

**UI flow:**
```
User tries to withdraw / start trading
  → 403 kyc_required
  → Show: "Identity Verification Required"
  → CTA: "Start KYC" → navigate to KYC screen
  → KYC status: none → "Begin Verification"
  → KYC status: pending → "Under Review (1-2 business days)"
  → KYC status: rejected → "Verification Failed — Resubmit" + reason
  → KYC status: approved → should not see this state
```

---

## Maintenance Mode

When server returns `503` on any endpoint:
```json
{ "error": "Platform is under maintenance. We'll be back shortly.", "code": "MAINTENANCE" }
```
**UI:** Full-screen maintenance overlay. Show estimated downtime if available in message. Auto-retry every 30s.

---

## Network Connectivity

Check before making API calls:
```dart
// Use connectivity_plus package
final connectivity = await Connectivity().checkConnectivity();
if (connectivity == ConnectivityResult.none) {
  // Show offline banner — don't make API calls
  // Cache last known data for offline viewing
}
```

Offline UI: Show last known data with "Offline" chip in header. Disable all write actions.
