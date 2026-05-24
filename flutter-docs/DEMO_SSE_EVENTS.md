# Qorix Markets — Demo SSE Events & Fake Data Catalog

> Complete sample data for mocking the SSE stream, bot quotes, and building Flutter UI tests without a live backend connection.

---

## Part 1 — P2P Order SSE Stream

### How to Connect
```
URL:  GET /api/p2p/orders/{orderId}/stream?token={streamToken}
Auth: scoped JWT from order creation response
```

### SSE Wire Format
```
event: order.updated
data: {"orderId":88,"status":"paid","updatedAt":"2026-05-24T10:32:00Z"}

event: chat.message
data: {"orderId":88,"messageId":5,"senderId":42,"senderRole":"buyer","message":"Payment sent!","sentAt":"2026-05-24T10:32:15Z"}
```

---

### Event Sequence — Full Happy Path (Buyer POV)

#### Event 1 — Order Created (system)
```
event: order.created
data: {
  "orderId": 101,
  "adId": 15,
  "buyerId": 1,
  "sellerId": 8,
  "fiatAmount": "4825.00",
  "usdtAmount": "50.00000000",
  "price": "96.50",
  "paymentMethod": "UPI",
  "status": "pending",
  "paymentDeadline": "2026-05-24T10:47:00.000Z",
  "timeRemainingSeconds": 900
}
```
> Flutter action: Start countdown timer (15:00 → 0:00), show seller's payment details, enable "Mark as Paid" button

#### Event 2 — System Message (chat)
```
event: chat.message
data: {
  "orderId": 101,
  "messageId": 1,
  "senderId": 8,
  "senderRole": "seller",
  "isSystem": true,
  "message": "Order created. You have 15 minutes to pay ₹4,825 to the seller.",
  "sentAt": "2026-05-24T10:32:00.000Z"
}
```

#### Event 3 — Seller Greets (chat)
```
event: chat.message
data: {
  "orderId": 101,
  "messageId": 2,
  "senderId": 8,
  "senderRole": "seller",
  "isSystem": false,
  "message": "Hi! Ready. UPI: fasttrader99@gpay — please add note 'USDT order'.",
  "sentAt": "2026-05-24T10:32:30.000Z"
}
```
> Flutter action: Append message to chat, scroll to bottom

#### Event 4 — Buyer Sends Payment (chat)
```
event: chat.message
data: {
  "orderId": 101,
  "messageId": 3,
  "senderId": 1,
  "senderRole": "buyer",
  "isSystem": false,
  "message": "Payment done! GPay Ref: 416052109334",
  "sentAt": "2026-05-24T10:35:10.000Z"
}
```

#### Event 5 — Order Status → paid
```
event: order.paid
data: {
  "orderId": 101,
  "paymentRef": "GPay Ref: 416052109334",
  "paidAt": "2026-05-24T10:35:15.000Z"
}
```
> Flutter action: Update status badge to "Paid", disable countdown, show "Waiting for seller to release"

#### Event 6 — Seller Confirms (chat)
```
event: chat.message
data: {
  "orderId": 101,
  "messageId": 4,
  "senderId": 8,
  "senderRole": "seller",
  "isSystem": false,
  "message": "Got ₹4,825. Releasing USDT now. Done!",
  "sentAt": "2026-05-24T10:38:45.000Z"
}
```

#### Event 7 — Order Completed 🎉
```
event: order.completed
data: {
  "orderId": 101,
  "usdtAmount": "50.00000000",
  "completedAt": "2026-05-24T10:39:00.000Z",
  "buyerNewUsdtBalance": "175.50000000"
}
```
> Flutter action: Navigate to success screen, show confetti animation, update wallet balance

---

### Event Sequence — Dispute Path

#### Dispute Opened
```
event: order.disputed
data: {
  "orderId": 101,
  "openedBy": "buyer",
  "reason": "payment_not_received",
  "description": "I sent ₹4,825 via GPay but seller is not responding.",
  "disputeId": 5,
  "createdAt": "2026-05-24T10:50:00.000Z"
}
```
> Flutter action: Show orange "Under Dispute" banner, disable Mark as Paid / Release buttons

#### Dispute Resolved (USDT Released to Buyer)
```
event: order.dispute_resolved
data: {
  "orderId": 101,
  "resolution": "resolved_release",
  "note": "Admin verified GPay screenshot. USDT released to buyer.",
  "resolvedAt": "2026-05-24T12:00:00.000Z"
}
```

---

### Event Sequence — Cancellation

```
event: order.cancelled
data: {
  "orderId": 101,
  "cancelReason": "Payment not received within 15 minutes",
  "cancelledAt": "2026-05-24T10:47:05.000Z",
  "cancelledBy": "system"
}
```
> Flutter action: Show "Order Cancelled" screen with reason, navigate back to P2P after 3s

---

## Part 2 — Bot Terminal Live Quotes (Mock Stream)

Poll `GET /api/bot-trading/quotes` every 1500ms. Below are 5 consecutive snapshots to test price animation:

### Tick 1 (t=0)
```json
{
  "quotes": [
    { "symbol": "XAUUSD", "bid": 2341.48, "ask": 2341.62, "change": 8.34,   "changePct": 0.357  },
    { "symbol": "EURUSD", "bid": 1.08542, "ask": 1.08558, "change": -0.00128,"changePct": -0.118 },
    { "symbol": "BTCUSD", "bid": 67240.0, "ask": 67260.0, "change": 840.0,  "changePct": 1.264  },
    { "symbol": "USOIL",  "bid": 78.42,   "ask": 78.46,   "change": -0.18,  "changePct": -0.229 }
  ],
  "updatedAt": "2026-05-24T10:30:01.234Z"
}
```

### Tick 2 (t=1.5s) — XAUUSD up, EURUSD down
```json
{
  "quotes": [
    { "symbol": "XAUUSD", "bid": 2341.85, "ask": 2341.99, "change": 8.71,   "changePct": 0.373  },
    { "symbol": "EURUSD", "bid": 1.08528, "ask": 1.08544, "change": -0.00142,"changePct": -0.131 },
    { "symbol": "BTCUSD", "bid": 67195.0, "ask": 67215.0, "change": 795.0,  "changePct": 1.197  },
    { "symbol": "USOIL",  "bid": 78.45,   "ask": 78.49,   "change": -0.15,  "changePct": -0.191 }
  ],
  "updatedAt": "2026-05-24T10:30:02.734Z"
}
```

### Tick 3 (t=3s) — BTC spikes
```json
{
  "quotes": [
    { "symbol": "XAUUSD", "bid": 2341.72, "ask": 2341.86, "change": 8.58,   "changePct": 0.367  },
    { "symbol": "EURUSD", "bid": 1.08535, "ask": 1.08551, "change": -0.00135,"changePct": -0.124 },
    { "symbol": "BTCUSD", "bid": 67380.0, "ask": 67400.0, "change": 980.0,  "changePct": 1.477  },
    { "symbol": "USOIL",  "bid": 78.41,   "ask": 78.45,   "change": -0.19,  "changePct": -0.242 }
  ],
  "updatedAt": "2026-05-24T10:30:04.234Z"
}
```

### Tick 4 (t=4.5s) — XAUUSD drops slightly
```json
{
  "quotes": [
    { "symbol": "XAUUSD", "bid": 2341.10, "ask": 2341.24, "change": 7.96,   "changePct": 0.341  },
    { "symbol": "EURUSD", "bid": 1.08548, "ask": 1.08564, "change": -0.00122,"changePct": -0.112 },
    { "symbol": "BTCUSD", "bid": 67310.0, "ask": 67330.0, "change": 910.0,  "changePct": 1.372  },
    { "symbol": "USOIL",  "bid": 78.38,   "ask": 78.42,   "change": -0.22,  "changePct": -0.280 }
  ],
  "updatedAt": "2026-05-24T10:30:05.734Z"
}
```

### Tick 5 (t=6s) — Recovery
```json
{
  "quotes": [
    { "symbol": "XAUUSD", "bid": 2341.55, "ask": 2341.69, "change": 8.41,   "changePct": 0.360  },
    { "symbol": "EURUSD", "bid": 1.08561, "ask": 1.08577, "change": -0.00109,"changePct": -0.100 },
    { "symbol": "BTCUSD", "bid": 67425.0, "ask": 67445.0, "change": 1025.0, "changePct": 1.545  },
    { "symbol": "USOIL",  "bid": 78.44,   "ask": 78.48,   "change": -0.16,  "changePct": -0.204 }
  ],
  "updatedAt": "2026-05-24T10:30:07.234Z"
}
```

### Flutter Price Flash Animation Trigger
```dart
// When a price changes between ticks:
// bid increased → flash GREEN (#22C55E) for 700ms then fade back
// bid decreased → flash RED (#EF4444) for 700ms then fade back

void onPriceTick(Quote oldQ, Quote newQ) {
  if (newQ.bid > oldQ.bid) {
    _flashColor = QorixColors.green;
  } else if (newQ.bid < oldQ.bid) {
    _flashColor = QorixColors.red;
  }
  _flashController.forward(from: 0); // 700ms animation
}
```

---

## Part 3 — Bot Engine State

### `GET /api/bot-trading/state`
```json
{
  "planProgress": 68,
  "dailyTargetPct": 0.50,
  "dailyEarnedPct": 0.34,
  "openPositions": [
    {
      "id": "pos_xau_001",
      "symbol": "XAUUSD",
      "direction": "buy",
      "size": 0.05,
      "entryPrice": 2338.40,
      "currentPrice": 2341.55,
      "unrealizedPnl": 15.75,
      "unrealizedPnlPct": 0.135,
      "openedAt": "2026-05-24T09:15:00.000Z",
      "durationMinutes": 75
    },
    {
      "id": "pos_eur_002",
      "symbol": "EURUSD",
      "direction": "sell",
      "size": 5000,
      "entryPrice": 1.08580,
      "currentPrice": 1.08561,
      "unrealizedPnl": 9.50,
      "unrealizedPnlPct": 0.175,
      "openedAt": "2026-05-24T10:05:00.000Z",
      "durationMinutes": 25
    }
  ],
  "totalUnrealizedPnl": 25.25,
  "distributionShares": [
    {
      "userId": 1,
      "userDisplayName": "Arjun M.",
      "sharePct": 2.84,
      "estimatedAmountUsd": 0.72
    }
  ]
}
```

---

## Part 4 — AI Signal Trades History

### `GET /api/signal-trades` (mock response)
```json
[
  {
    "id": 12,
    "symbol": "BTCUSD",
    "direction": "buy",
    "entryPrice": "64800.00",
    "exitPrice": "66988.00",
    "profitPct": "3.38",
    "userProfit": "18.50",
    "openedAt": "2026-05-08T09:00:00.000Z",
    "closedAt": "2026-05-09T14:30:00.000Z",
    "durationHours": 29.5
  },
  {
    "id": 11,
    "symbol": "XAUUSD",
    "direction": "sell",
    "entryPrice": "2378.50",
    "exitPrice": "2342.00",
    "profitPct": "1.54",
    "userProfit": "9.20",
    "openedAt": "2026-05-04T10:00:00.000Z",
    "closedAt": "2026-05-05T16:15:00.000Z",
    "durationHours": 30.25
  },
  {
    "id": 10,
    "symbol": "EURUSD",
    "direction": "buy",
    "entryPrice": "1.07820",
    "exitPrice": "1.08340",
    "profitPct": "0.48",
    "userProfit": "4.10",
    "openedAt": "2026-04-28T08:30:00.000Z",
    "closedAt": "2026-04-28T19:45:00.000Z",
    "durationHours": 11.25
  },
  {
    "id": 9,
    "symbol": "USOIL",
    "direction": "buy",
    "entryPrice": "76.40",
    "exitPrice": "78.55",
    "profitPct": "2.81",
    "userProfit": "14.05",
    "openedAt": "2026-04-20T11:00:00.000Z",
    "closedAt": "2026-04-22T09:30:00.000Z",
    "durationHours": 46.5
  }
]
```

---

## Part 5 — Full Leaderboard Mock

### `GET /api/leaderboard` (mock — feature in development)
```json
{
  "period": "monthly",
  "month": "2026-05",
  "generatedAt": "2026-05-24T10:00:00.000Z",
  "currentUserRank": 7,
  "entries": [
    { "rank": 1,  "displayName": "Rohan V.",   "city": "Delhi",     "totalProfit": 1284.50, "winRate": 81.2, "activeDays": 30, "badge": "🏆 Top Trader" },
    { "rank": 2,  "displayName": "Priya K.",   "city": "Bangalore", "totalProfit": 1156.20, "winRate": 78.4, "activeDays": 29, "badge": "🥈 Elite" },
    { "rank": 3,  "displayName": "Amit S.",    "city": "Mumbai",    "totalProfit": 1042.80, "winRate": 76.1, "activeDays": 28, "badge": "🥉 Expert" },
    { "rank": 4,  "displayName": "Kavya R.",   "city": "Hyderabad", "totalProfit":  948.40, "winRate": 74.8, "activeDays": 30, "badge": null },
    { "rank": 5,  "displayName": "Suresh M.",  "city": "Chennai",   "totalProfit":  876.15, "winRate": 73.2, "activeDays": 27, "badge": null },
    { "rank": 6,  "displayName": "Deepa N.",   "city": "Pune",      "totalProfit":  812.90, "winRate": 72.0, "activeDays": 26, "badge": null },
    { "rank": 7,  "displayName": "Arjun M.",   "city": "Mumbai",    "totalProfit":  412.75, "winRate": 72.0, "activeDays": 40, "badge": null, "isCurrentUser": true },
    { "rank": 8,  "displayName": "Ravi P.",    "city": "Ahmedabad", "totalProfit":  398.20, "winRate": 70.8, "activeDays": 25, "badge": null },
    { "rank": 9,  "displayName": "Sona T.",    "city": "Kolkata",   "totalProfit":  356.80, "winRate": 69.5, "activeDays": 24, "badge": null },
    { "rank": 10, "displayName": "Vivek C.",   "city": "Jaipur",    "totalProfit":  298.40, "winRate": 68.2, "activeDays": 22, "badge": null }
  ]
}
```

---

## Part 6 — VIP Tier Progress (Mock)

```json
{
  "currentTier": "Silver",
  "currentTierMinDeposit": 500,
  "nextTier": "Gold",
  "nextTierMinDeposit": 2000,
  "currentTotalDeposited": 1248.50,
  "progressPercent": 49.7,
  "amountToNextTier": 751.50,
  "benefits": {
    "current": [
      "Priority withdrawal processing (48h)",
      "Silver badge on P2P profile",
      "0.5% referral bonus boost"
    ],
    "next": [
      "Priority withdrawal processing (24h)",
      "Gold badge on P2P profile",
      "1.0% referral bonus boost",
      "Dedicated support"
    ]
  },
  "tiers": [
    { "name": "Bronze",   "minDeposit": 0,     "color": "#CD7F32", "icon": "🥉" },
    { "name": "Silver",   "minDeposit": 500,   "color": "#94A3B8", "icon": "🥈" },
    { "name": "Gold",     "minDeposit": 2000,  "color": "#EAB308", "icon": "🥇" },
    { "name": "Platinum", "minDeposit": 5000,  "color": "#8B5CF6", "icon": "💎" },
    { "name": "Diamond",  "minDeposit": 10000, "color": "#3B82F6", "icon": "👑" }
  ]
}
```

---

## Part 7 — Flutter Mock Service (Offline Dev)

Use this Dart class when building Flutter UI without a live backend:

```dart
// lib/core/api/mock_service.dart

class MockApiService {
  static Map<String, dynamic> get wallet => {
    "mainBalance": "245000.00000000",
    "tradingBalance": "5000.00000000",
    "profitBalance": "412.75000000",
    "usdtBalance": "125.50000000",
    "points": 2450,
  };

  static Map<String, dynamic> get investment => {
    "amount": "5000.00000000",
    "riskLevel": "medium",
    "isActive": true,
    "isPaused": false,
    "totalProfit": "412.75000000",
    "dailyProfit": "25.48000000",
    "drawdown": "1.24",
    "drawdownLimit": "5.00",
    "peakBalance": "5412.75000000",
  };

  static Map<String, dynamic> get dashboardSummary => {
    "totalBalance": 5783.02,
    "dailyProfitLoss": 25.48,
    "dailyProfitPercent": 0.4823,
    "activeInvestment": true,
    "riskLevel": "medium",
    "tradingBalance": 5000.0,
    "profitBalance": 412.75,
  };

  static Map<String, dynamic> get user => {
    "id": 1,
    "email": "demo@qorix.markets",
    "fullName": "Arjun Mehta",
    "kycStatus": "approved",
    "referralCode": "ARJUN7X",
    "emailVerified": true,
    "points": 2450,
  };

  static List<Map<String, dynamic>> get quotes => [
    { "symbol": "XAUUSD", "bid": 2341.48, "ask": 2341.62, "change": 8.34,    "changePct": 0.357  },
    { "symbol": "EURUSD", "bid": 1.08542, "ask": 1.08558, "change": -0.00128,"changePct": -0.118 },
    { "symbol": "BTCUSD", "bid": 67240.0, "ask": 67260.0, "change": 840.0,   "changePct": 1.264  },
    { "symbol": "USOIL",  "bid": 78.42,   "ask": 78.46,   "change": -0.18,   "changePct": -0.229 },
  ];

  static List<Map<String, dynamic>> get notifications => [
    { "id": 1, "type": "trade",   "isRead": false, "title": "Daily Profit Distributed",   "message": "Your bot earned \$25.48 today (+0.48%). Total profit: \$412.75.",         "createdAt": "2026-05-24T09:00:00Z" },
    { "id": 2, "type": "system",  "isRead": false, "title": "Drawdown Alert",              "message": "Portfolio drawdown 1.24% of 5% limit. Bot continuing normally.",          "createdAt": "2026-05-24T06:00:00Z" },
    { "id": 3, "type": "p2p",     "isRead": false, "title": "P2P Order Completed",         "message": "FastTrader99 released 100 USDT. Order #88 complete.",                    "createdAt": "2026-05-23T14:00:00Z" },
    { "id": 4, "type": "deposit", "isRead": true,  "title": "USDT Deposit Confirmed",      "message": "200.00 USDT credited to USDT wallet. Balance: \$325.50.",                 "createdAt": "2026-05-20T14:32:00Z" },
    { "id": 5, "type": "kyc",     "isRead": true,  "title": "KYC Approved",                "message": "Identity verified. Full platform access unlocked.",                        "createdAt": "2026-04-12T10:00:00Z" },
  ];

  static List<Map<String, dynamic>> get recentTrades => [
    { "id": 150, "symbol": "XAUUSD", "direction": "buy",  "entryPrice": "2338.40", "exitPrice": "2349.85", "profit": "11.45",  "profitPercent": "0.4896", "executedAt": "2026-05-24T09:15:00Z" },
    { "id": 149, "symbol": "EURUSD", "direction": "sell", "entryPrice": "1.08700", "exitPrice": "1.08520", "profit": "9.00",   "profitPercent": "0.1656", "executedAt": "2026-05-24T08:47:00Z" },
    { "id": 148, "symbol": "BTCUSD", "direction": "buy",  "entryPrice": "66840.0", "exitPrice": "67185.0", "profit": "3.45",   "profitPercent": "0.5162", "executedAt": "2026-05-24T08:22:00Z" },
    { "id": 147, "symbol": "XAUUSD", "direction": "sell", "entryPrice": "2352.10", "exitPrice": "2344.80", "profit": "7.30",   "profitPercent": "0.3103", "executedAt": "2026-05-23T15:55:00Z" },
    { "id": 146, "symbol": "USOIL",  "direction": "buy",  "entryPrice": "78.24",   "exitPrice": "78.65",   "profit": "4.10",   "profitPercent": "0.5241", "executedAt": "2026-05-23T14:30:00Z" },
    { "id": 145, "symbol": "EURUSD", "direction": "buy",  "entryPrice": "1.08340", "exitPrice": "1.08490", "profit": "7.50",   "profitPercent": "0.1383", "executedAt": "2026-05-23T11:15:00Z" },
    { "id": 144, "symbol": "BTCUSD", "direction": "sell", "entryPrice": "67400.0", "exitPrice": "67050.0", "profit": "3.50",   "profitPercent": "0.5193", "executedAt": "2026-05-23T09:00:00Z" },
    { "id": 143, "symbol": "XAUUSD", "direction": "buy",  "entryPrice": "2325.80", "exitPrice": "2338.40", "profit": "12.60",  "profitPercent": "0.5415", "executedAt": "2026-05-22T14:45:00Z" },
    { "id": 142, "symbol": "USOIL",  "direction": "sell", "entryPrice": "79.15",   "exitPrice": "78.42",   "profit": "-3.65",  "profitPercent": "-0.9223","executedAt": "2026-05-22T11:30:00Z" },
    { "id": 141, "symbol": "EURUSD", "direction": "buy",  "entryPrice": "1.08210", "exitPrice": "1.08410", "profit": "10.00",  "profitPercent": "0.1849", "executedAt": "2026-05-22T08:15:00Z" },
  ];

  // Simulate SSE event stream for P2P order (use with Timer in dev mode)
  static List<Map<String, dynamic>> get p2pOrderEvents => [
    { "type": "chat.message",   "delay": 0,    "data": { "senderId": 8, "senderRole": "seller", "isSystem": true,  "message": "Order created. Pay ₹4,825 within 15 minutes." } },
    { "type": "chat.message",   "delay": 3000, "data": { "senderId": 8, "senderRole": "seller", "isSystem": false, "message": "Hi! Pay to fasttrader99@gpay — add note 'USDT order'." } },
    { "type": "chat.message",   "delay": 8000, "data": { "senderId": 1, "senderRole": "buyer",  "isSystem": false, "message": "Payment sent! GPay Ref: 416052109334" } },
    { "type": "order.paid",     "delay": 9000, "data": { "paymentRef": "GPay Ref: 416052109334", "paidAt": "now" } },
    { "type": "chat.message",   "delay": 15000,"data": { "senderId": 8, "senderRole": "seller", "isSystem": false, "message": "Got it. Releasing USDT now!" } },
    { "type": "order.completed","delay": 17000,"data": { "usdtAmount": "50.00000000", "buyerNewUsdtBalance": "175.50000000" } },
  ];
}
```

---

## Part 8 — Maintenance Mode Response

When admin enables maintenance, ALL API calls return:

```
HTTP 503 Service Unavailable
Content-Type: application/json

{
  "error": "Platform is under scheduled maintenance. We'll be back shortly.",
  "maintenance": true,
  "estimatedEnd": "2026-05-24T12:00:00.000Z"
}
```

### Flutter Handler
```dart
// In Dio response interceptor:
if (response.statusCode == 503) {
  final data = response.data as Map<String, dynamic>?;
  if (data?['maintenance'] == true) {
    ref.read(appStateProvider.notifier).setMaintenance(
      estimatedEnd: data?['estimatedEnd'] as String?,
    );
    // Navigate to maintenance screen, stop all pollers
  }
}
```
