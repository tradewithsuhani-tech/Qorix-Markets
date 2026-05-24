# Qorix Markets — SSE Lifecycle (P2P Order Stream)

> Complete guide to connecting, maintaining, and recovering from the Server-Sent Events stream
> used for real-time P2P order and chat updates.

---

## Why Two-Step Auth

Standard `EventSource` cannot send custom headers (including `Authorization: Bearer`). The server uses a **token-in-query-param** pattern instead:

1. **Step 1:** POST a normal authenticated request → receive a short-lived stream token
2. **Step 2:** GET the stream URL with the token as a query parameter

The stream token is a separate JWT with `aud: "p2p-stream"` (scope-limited — cannot be used for anything else).

---

## Connection Flow

```
Step 1: POST /api/p2p/orders/:orderId/stream-token
        Headers: Authorization: Bearer <user-jwt>
        Response: { "token": "<5-min-stream-jwt>" }

Step 2: GET /api/p2p/orders/:orderId/stream?token=<stream-jwt>
        (No Authorization header needed — token is in query param)
        Response: text/event-stream
```

---

## Event Reference

All events are JSON. Parse `event.data` with `jsonDecode`.

### `ready`
Sent immediately on connection. Signals the stream is live.
```json
{ "orderId": 42, "ts": 1748260800000 }
```

### `order_updated`
Sent when order status changes.
```json
{
  "orderId": 42,
  "status": "paid",
  "updatedAt": "2026-05-24T10:30:00.000Z"
}
```
`status` values: `"pending"` | `"paid"` | `"completed"` | `"cancelled"` | `"disputed"`

### `chat_message`
Sent when either party posts a new message.
```json
{
  "id": 301,
  "orderId": 42,
  "senderId": 100,
  "senderName": "FastTrader99",
  "message": "Payment sent. Please check.",
  "createdAt": "2026-05-24T10:31:00.000Z"
}
```

### `payment_proof`
Sent when buyer uploads a screenshot.
```json
{
  "orderId": 42,
  "imageUrl": "https://...",
  "uploadedAt": "2026-05-24T10:32:00.000Z"
}
```

### `dispute_opened`
Sent when either party raises a dispute.
```json
{
  "orderId": 42,
  "raisedBy": 100,
  "reason": "Payment not received after 30 minutes",
  "ts": 1748260800000
}
```

### `: ping` (comment — no event name)
Sent every **25 seconds**. No data. Used to keep the TCP connection alive. `EventSource` ignores comment lines — no action needed.

---

## Flutter Implementation

```dart
// lib/features/p2p/services/p2p_sse_service.dart

import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_client_sse/flutter_client_sse.dart';

class P2pSseService {
  final String baseUrl;
  final String userJwt;

  P2pSseService({required this.baseUrl, required this.userJwt});

  StreamSubscription? _subscription;
  Timer? _reconnectTimer;
  Timer? _tokenRefreshTimer;
  int _reconnectDelayMs = 1000;
  String? _streamToken;
  bool _disposed = false;

  static const _maxReconnectDelayMs = 30000;
  static const _tokenRefreshIntervalMs = 4 * 60 * 1000; // 4 min (token expires in 5)

  /// Start streaming events for the given order.
  Future<void> connect({
    required int orderId,
    required void Function(String eventType, Map<String, dynamic> data) onEvent,
    required void Function(String error) onError,
  }) async {
    await _fetchTokenAndConnect(orderId: orderId, onEvent: onEvent, onError: onError);

    // Refresh token before expiry (4 min cycle for 5-min token)
    _tokenRefreshTimer = Timer.periodic(
      Duration(milliseconds: _tokenRefreshIntervalMs),
      (_) async {
        if (_disposed) return;
        await _reconnect(orderId: orderId, onEvent: onEvent, onError: onError);
      },
    );
  }

  Future<void> _fetchTokenAndConnect({
    required int orderId,
    required void Function(String, Map<String, dynamic>) onEvent,
    required void Function(String) onError,
  }) async {
    try {
      // Step 1: get stream token
      final tokenRes = await http.post(
        Uri.parse('$baseUrl/api/p2p/orders/$orderId/stream-token'),
        headers: {'Authorization': 'Bearer $userJwt'},
      );
      if (tokenRes.statusCode != 200) {
        onError('Failed to get stream token: ${tokenRes.statusCode}');
        _scheduleReconnect(orderId: orderId, onEvent: onEvent, onError: onError);
        return;
      }
      _streamToken = jsonDecode(tokenRes.body)['token'] as String;
      _reconnectDelayMs = 1000; // reset backoff on successful token fetch

      // Step 2: open SSE stream
      _subscription?.cancel();
      _subscription = SSEClient.subscribeToSSE(
        method: SSERequestType.GET,
        url: '$baseUrl/api/p2p/orders/$orderId/stream?token=$_streamToken',
        header: {}, // no auth header needed
      ).listen(
        (event) {
          if (event.event == null || event.data == null) return;
          try {
            final data = jsonDecode(event.data!) as Map<String, dynamic>;
            onEvent(event.event!, data);
          } catch (_) {
            // malformed JSON — skip
          }
        },
        onError: (error) {
          onError('Stream error: $error');
          _scheduleReconnect(orderId: orderId, onEvent: onEvent, onError: onError);
        },
        onDone: () {
          if (!_disposed) {
            _scheduleReconnect(orderId: orderId, onEvent: onEvent, onError: onError);
          }
        },
      );
    } catch (e) {
      onError('Connection error: $e');
      _scheduleReconnect(orderId: orderId, onEvent: onEvent, onError: onError);
    }
  }

  void _scheduleReconnect({
    required int orderId,
    required void Function(String, Map<String, dynamic>) onEvent,
    required void Function(String) onError,
  }) {
    if (_disposed) return;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(Duration(milliseconds: _reconnectDelayMs), () async {
      if (_disposed) return;
      await _reconnect(orderId: orderId, onEvent: onEvent, onError: onError);
    });
    // Exponential backoff capped at 30s
    _reconnectDelayMs = (_reconnectDelayMs * 2).clamp(1000, _maxReconnectDelayMs);
  }

  Future<void> _reconnect({
    required int orderId,
    required void Function(String, Map<String, dynamic>) onEvent,
    required void Function(String) onError,
  }) async {
    _subscription?.cancel();
    await _fetchTokenAndConnect(orderId: orderId, onEvent: onEvent, onError: onError);
  }

  void dispose() {
    _disposed = true;
    _reconnectTimer?.cancel();
    _tokenRefreshTimer?.cancel();
    _subscription?.cancel();
  }
}
```

---

## Usage in a Widget

```dart
// In your P2P order detail StatefulWidget:

late final P2pSseService _sse;

@override
void initState() {
  super.initState();
  _sse = P2pSseService(baseUrl: AppConfig.baseUrl, userJwt: authService.token!);
  _sse.connect(
    orderId: widget.orderId,
    onEvent: _handleSseEvent,
    onError: (e) => debugPrint('[SSE] error: $e'),
  );
  // Safety-net poll — in case stream silently stalls
  _pollTimer = Timer.periodic(const Duration(seconds: 60), (_) => _fetchOrderState());
}

void _handleSseEvent(String eventType, Map<String, dynamic> data) {
  switch (eventType) {
    case 'ready':
      setState(() => _streamConnected = true);
      break;
    case 'order_updated':
      setState(() => _order = _order.copyWith(status: data['status']));
      break;
    case 'chat_message':
      setState(() => _messages.add(ChatMessage.fromJson(data)));
      break;
    case 'payment_proof':
      setState(() => _paymentProofUrl = data['imageUrl'] as String?);
      break;
    case 'dispute_opened':
      setState(() => _order = _order.copyWith(status: 'disputed'));
      break;
  }
}

@override
void dispose() {
  _sse.dispose();
  _pollTimer?.cancel();
  super.dispose();
}
```

---

## Reconnection Logic

```
Connection lost / error / done
  │
  ├─ _scheduleReconnect(delay)
  │     delay starts at 1s, doubles each failure, caps at 30s
  │
  └─ On reconnect:
       1. Re-fetch stream token (Step 1 — POST /stream-token)
       2. Re-subscribe to SSE (Step 2 — GET /stream?token=...)
       3. Reset delay to 1s on success

Token refresh (independent of connection health):
  Every 4 minutes → re-run full connect flow proactively
  (avoids mid-session expiry cutting off the stream)
```

---

## Server Behaviour Reference

| Behaviour | Value |
|---|---|
| Heartbeat | `: ping` comment every **25 seconds** |
| Stream token TTL | **5 minutes** |
| Max clients per order | **8** (oldest closed on overflow) |
| Redis pub/sub channel | `p2p:order:events` |
| Multi-instance support | ✅ Redis fans out to all Fly.io machines |
| Redis reconnect | Auto-retry with exponential backoff, no retry limit |
| Cleanup on disconnect | ✅ `req.on("close")` clears interval + removes from Map |

---

## Lifecycle Diagram

```
Flutter                          Server (Fly BOM)              Redis
  │                                    │                          │
  │── POST /stream-token ─────────────►│                          │
  │◄── { token } ─────────────────────│                          │
  │                                    │                          │
  │── GET /stream?token= ─────────────►│ addSSEClient()           │
  │◄── event: ready ──────────────────│◄─── subscribe ──────────►│
  │◄── : ping (25s) ──────────────────│                          │
  │◄── : ping (25s) ──────────────────│                          │
  │                              [Other user action]              │
  │                                    │◄─── publishOrderEvent ───│
  │◄── event: order_updated ──────────│                          │
  │◄── event: chat_message ───────────│                          │
  │                                    │                          │
  │  [4 min elapsed — proactive refresh]                          │
  │── POST /stream-token ─────────────►│                          │
  │◄── { token } ─────────────────────│                          │
  │── GET /stream?token=<new> ────────►│ addSSEClient() ×2        │
  │   [old stream closed by server]    │ [oldest evicted]         │
  │◄── event: ready ──────────────────│                          │
  │                                    │                          │
  │  [user navigates away]             │                          │
  │── dispose() → cancel subscription  │                          │
  │   [TCP close triggers req.close]  ►│ cleanup() removes client │
```
