# Qorix Markets — Real-time Events & WebSocket Reference

> The Qorix backend uses **SSE (Server-Sent Events)** and **HTTP Polling** — there is no WebSocket (socket.io/ws). Plan Flutter accordingly.

---

## Overview

| Mechanism | Used For | Flutter Strategy |
|---|---|---|
| SSE (Server-Sent Events) | P2P order updates + chat | `http` package stream |
| HTTP Polling (1.5s) | Bot terminal prices | `Timer.periodic` |
| HTTP Polling (30s) | Notifications, wallet balance | `Timer.periodic` |
| HTTP Polling (60s) | Dashboard summary | `Timer.periodic` |
| Postgres LISTEN/NOTIFY | Maintenance mode | Server-side only (no client action needed) |

---

## 1. P2P Order SSE Stream

**Endpoint:** `GET /api/p2p/orders/:orderId/stream?token=<scoped_jwt>`

The `streamToken` is returned when creating an order (`POST /api/p2p/orders`). It is a short-lived, purpose-scoped JWT that only allows subscribing to that specific order's stream.

### Connection

```dart
// lib/features/p2p/p2p_sse_service.dart

import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class P2POrderStream {
  static const String _baseUrl = 'https://qorix-api.fly.dev/api';
  StreamSubscription? _subscription;
  final _controller = StreamController<P2PEvent>.broadcast();

  Stream<P2PEvent> get events => _controller.stream;

  void connect(int orderId, String streamToken) {
    _disconnect();
    final uri = Uri.parse(
      '$_baseUrl/p2p/orders/$orderId/stream?token=${Uri.encodeComponent(streamToken)}'
    );

    final client = http.Client();
    final request = http.Request('GET', uri);

    client.send(request).then((response) {
      _subscription = response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(
            _handleLine,
            onError: (e) => _scheduleReconnect(orderId, streamToken),
            onDone: () => _scheduleReconnect(orderId, streamToken),
          );
    }).catchError((e) {
      _scheduleReconnect(orderId, streamToken);
    });
  }

  String _eventType = '';
  String _data = '';

  void _handleLine(String line) {
    if (line.startsWith('event:')) {
      _eventType = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      _data = line.substring(5).trim();
    } else if (line.isEmpty && _eventType.isNotEmpty) {
      // End of SSE event block — emit
      try {
        final json = jsonDecode(_data) as Map<String, dynamic>;
        _controller.add(P2PEvent(type: _eventType, data: json));
      } catch (_) {}
      _eventType = '';
      _data = '';
    }
  }

  void _scheduleReconnect(int orderId, String token) {
    Future.delayed(const Duration(seconds: 3), () {
      connect(orderId, token);
    });
  }

  void _disconnect() {
    _subscription?.cancel();
    _subscription = null;
  }

  void dispose() {
    _disconnect();
    _controller.close();
  }
}
```

### SSE Event Types

#### `order.updated`
Order status changed (any party or system update).
```json
{
  "type": "order.updated",
  "data": {
    "orderId": 88,
    "status": "paid",
    "updatedAt": "2026-05-24T10:32:00Z"
  }
}
```

#### `order.paid`
Buyer has marked payment as sent.
```json
{
  "type": "order.paid",
  "data": {
    "orderId": 88,
    "paymentRef": "GPay ref 123456",
    "paidAt": "2026-05-24T10:32:00Z"
  }
}
```

#### `order.completed`
Seller released USDT — trade complete.
```json
{
  "type": "order.completed",
  "data": {
    "orderId": 88,
    "usdtAmount": "100.00",
    "completedAt": "2026-05-24T10:38:00Z"
  }
}
```

#### `order.cancelled`
Order was cancelled (timeout or manual).
```json
{
  "type": "order.cancelled",
  "data": {
    "orderId": 88,
    "cancelReason": "Payment timeout",
    "cancelledAt": "2026-05-24T10:47:00Z"
  }
}
```

#### `order.disputed`
A dispute has been opened.
```json
{
  "type": "order.disputed",
  "data": {
    "orderId": 88,
    "openedBy": "buyer",
    "reason": "payment_not_received"
  }
}
```

#### `chat.message`
New chat message in the order thread.
```json
{
  "type": "chat.message",
  "data": {
    "orderId": 88,
    "messageId": 12,
    "senderId": 42,
    "senderRole": "buyer",
    "message": "I've sent the payment",
    "sentAt": "2026-05-24T10:32:00Z"
  }
}
```

### Flutter P2P Event Model

```dart
class P2PEvent {
  final String type;
  final Map<String, dynamic> data;
  const P2PEvent({required this.type, required this.data});
}

// Usage in Riverpod Notifier:
ref.watch(p2pOrderStreamProvider(orderId)).listen((event) {
  switch (event.type) {
    case 'order.paid':
      // Show "Payment received" banner, enable Release button
      break;
    case 'order.completed':
      // Navigate to success screen
      break;
    case 'order.cancelled':
      // Navigate back, show cancellation message
      break;
    case 'chat.message':
      // Append message to chat list
      break;
    case 'order.disputed':
      // Show dispute banner
      break;
  }
});
```

---

## 2. Bot Terminal — Price Polling

**Endpoint:** `GET /api/bot-trading/quotes`  
**Interval:** 1500ms  
**Auth:** None  
**Cache-Control:** `no-store, max-age=0`

### Flutter Implementation

```dart
// lib/features/trading/quote_poller.dart

class QuotePoller {
  Timer? _timer;
  final Dio _dio;
  final Function(QuoteFeed) onUpdate;

  QuotePoller({required Dio dio, required this.onUpdate}) : _dio = dio;

  void start() {
    _timer?.cancel();
    _fetch(); // immediate first fetch
    _timer = Timer.periodic(
      const Duration(milliseconds: 1500),
      (_) => _fetch(),
    );
  }

  Future<void> _fetch() async {
    try {
      final res = await _dio.get('/bot-trading/quotes');
      final feed = QuoteFeed.fromJson(res.data);
      onUpdate(feed);
    } catch (_) {
      // Silent — keep showing last known price
    }
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }
}
```

### Response Shape

```dart
class QuoteFeed {
  final List<Quote> quotes;
  final DateTime updatedAt;
}

class Quote {
  final String symbol;  // XAUUSD | EURUSD | BTCUSD | USOIL
  final double bid;
  final double ask;
  final double change;
  final double changePct;

  // Derived fields for display:
  double get spread => ask - bid;
  bool get isUp => change > 0;
  Color get trendColor => isUp ? QorixColors.green : QorixColors.red;
}
```

---

## 3. Wallet Balance Polling

**Endpoint:** `GET /api/wallet`  
**Interval:** 30 seconds (also refresh on: deposit confirm, withdraw submit, transfer complete)  
**Auth:** Required

```dart
// Trigger refresh on:
// 1. Pull-to-refresh gesture
// 2. After any deposit/withdraw/transfer action
// 3. Timer.periodic every 30s while app is in foreground
// 4. App resume from background

class WalletPoller {
  Timer? _timer;

  void startPolling(WidgetRef ref) {
    _timer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => ref.invalidate(walletProvider),
    );
  }

  void stopPolling() {
    _timer?.cancel();
  }
}
```

---

## 4. Notifications Polling

**Endpoint:** `GET /api/notifications?page=1&limit=20`  
**Interval:** 30 seconds  
**Auth:** Required

### Badge Count Logic

```dart
// Show red badge on notification icon when unreadCount > 0
// Dismiss badge after PATCH /notifications/read-all
// Store last-seen count in memory to detect new arrivals
```

---

## 5. Dashboard Summary Polling

**Endpoint:** `GET /api/dashboard/summary`  
**Interval:** 60 seconds (also on pull-to-refresh)  
**Auth:** Required

---

## 6. App Lifecycle — Polling Management

```dart
// lib/core/lifecycle_manager.dart

class LifecycleManager extends WidgetsBindingObserver {
  final QuotePoller quotePoller;
  final WalletPoller walletPoller;
  bool _isInvestmentActive = false;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        // Restart all pollers
        if (_isInvestmentActive) quotePoller.start();
        walletPoller.startPolling(ref);
        // Immediate refresh after background
        ref.invalidate(walletProvider);
        ref.invalidate(notificationsProvider);
        break;

      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
        // Stop all pollers to save battery
        quotePoller.stop();
        walletPoller.stopPolling();
        break;

      default:
        break;
    }
  }
}
```

---

## 7. Maintenance Mode Handling

The server returns `HTTP 503` with `{ "maintenance": true }` when maintenance mode is active.

```dart
// In Dio interceptor:
if (response.statusCode == 503 && response.data['maintenance'] == true) {
  // Navigate to full-screen MaintenancePage
  // Stop all pollers
  // Show estimated end time if available
  router.go('/maintenance', extra: response.data['estimatedEnd']);
}
```

---

## 8. Offline / Network Error Handling

```dart
// DioException types to handle:

DioExceptionType.connectionTimeout → show "Connection timeout" toast, retry
DioExceptionType.receiveTimeout    → show "Slow connection" toast, retry
DioExceptionType.connectionError   → show offline banner, stop pollers
DioExceptionType.badResponse:
  401 → clear token, navigate to /login
  403 → show error message (do not logout)
  429 → show "Too many requests, slow down" message
  503 → show maintenance screen

// Retry strategy:
// - 3 retries with exponential backoff (1s, 2s, 4s)
// - Only retry on 5xx and network errors
// - Never retry on 4xx (except 429 with delay)
```

---

## 9. SSE Reconnection Strategy

```dart
// Reconnection policy for P2P order stream:

const int maxReconnectAttempts = 10;
const Duration initialDelay = Duration(seconds: 1);
const Duration maxDelay = Duration(seconds: 30);

// Exponential backoff:
// attempt 1: 1s
// attempt 2: 2s
// attempt 3: 4s
// attempt 4: 8s
// attempt 5+: 30s (cap)

// Stop reconnecting when:
// 1. Order status is completed/cancelled/disputed
// 2. User navigates away from order screen
// 3. App goes to background (resume on foreground)
```

---

## 10. Push Notifications (Future — Not Yet Implemented)

> The current backend does not support FCM/APNs push notifications. All alerts are delivered via in-app polling or Telegram bot.

**Current workaround:** Poll `GET /api/notifications` every 30s.

**Telegram alternative:** Users can link their Telegram account and receive personal trade alerts, deposit confirmations, and withdrawal status via Telegram bot.

To link Telegram:
1. `GET /telegram/link-code` → `{ "linkCode": "ABCD1234", "botUsername": "QorixBot" }`
2. User messages the bot: `/start ABCD1234`
3. Backend detects → marks `telegramLinkedAt`

**For future FCM support:** The backend is structured to support it — add an FCM token field to `user_devices` and call Firebase Admin SDK from the notification service.

---

## 11. Summary: What to Build in Flutter

| Feature | Mechanism | Interval | Priority |
|---|---|---|---|
| P2P order chat + status | SSE | Real-time | High |
| Bot terminal prices | HTTP Poll | 1500ms | High |
| Wallet balances | HTTP Poll | 30s | High |
| Notification badge | HTTP Poll | 30s | High |
| Dashboard stats | HTTP Poll | 60s | Medium |
| Investment status | HTTP Poll | 60s | Medium |
| Maintenance detection | 503 intercept | Any request | High |
| Network offline banner | DioException | Any request | Medium |
