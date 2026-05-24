# Qorix Markets — POST /api/demo/reset

> One-call full demo ecosystem reset for Flutter developers, QA engineers, and investor demos.
> Wipes all demo-account data and seeds a fresh, deterministic, premium dataset in under 3 seconds.

---

## Quick Start

```bash
# Check if reset is available (no auth needed)
curl https://qorix-api.fly.dev/api/demo/status

# Reset the full demo ecosystem
curl -X POST https://qorix-api.fly.dev/api/demo/reset \
  -H "Authorization: Bearer <DEMO_RESET_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

---

## Endpoint Reference

### `GET /api/demo/status`

No auth required. Returns whether the reset endpoint is available in this environment.

**Response 200:**
```json
{
  "resetAvailable": true,
  "reason": null,
  "demoEmail": "demo@qorix.markets",
  "env": "development"
}
```

When unavailable (production without `DEMO_RESET_ENABLED=true`):
```json
{
  "resetAvailable": false,
  "reason": "Demo reset is disabled in production. Set DEMO_RESET_ENABLED=true on the server if this is intentional for a staging deploy.",
  "demoEmail": "demo@qorix.markets",
  "env": "production"
}
```

---

### `POST /api/demo/reset`

Full idempotent reset. Wipes all data for the demo account and re-seeds a fresh premium ecosystem.

**Request Headers:**

| Header | Required | Description |
|---|---|---|
| `Authorization: Bearer <secret>` | Yes (one of two) | Primary auth method |
| `X-Demo-Secret: <secret>` | Yes (one of two) | Alternative when Authorization header is stripped by proxy |
| `Content-Type: application/json` | Yes | Required for body parsing |

**Request Body (all optional):**
```json
{
  "confirm": "RESET_DEMO"
}
```
`confirm` is an optional extra safety gate. If provided, it must equal the string `"RESET_DEMO"` exactly or the request is rejected with 400. Useful in CI/CD pipelines to guard against accidental calls.

**Success Response 200:**
```json
{
  "success": true,
  "message": "Demo ecosystem reset complete. Login with the credentials below.",
  "demoEmail": "demo@qorix.markets",
  "demoPassword": "Demo@Qorix2026",
  "resetAt": "2026-05-24T10:30:00.000Z",
  "durationMs": 2191,
  "seeded": {
    "wallets": {
      "inr": 245000,
      "usdt": 125.5,
      "trading": 5000,
      "profit": 412.75
    },
    "investment": {
      "amount": 5000,
      "riskLevel": "medium",
      "isActive": true,
      "totalProfit": 412.75
    },
    "trades": 150,
    "transactions": 48,
    "notifications": {
      "total": 11,
      "unread": 3
    },
    "equityHistory": 90,
    "p2p": {
      "ads": 1,
      "completedOrders": 1,
      "pendingOrders": 1,
      "chatMessages": 9,
      "ratings": 2
    }
  }
}
```

**Error Responses:**

| Status | Condition | Response body |
|---|---|---|
| `401` | Missing secret | `{"error":"Invalid or missing demo reset secret."}` |
| `401` | Wrong secret | `{"error":"Invalid or missing demo reset secret."}` |
| `400` | `confirm` provided but not `"RESET_DEMO"` | `{"error":"If 'confirm' is provided it must equal the string 'RESET_DEMO'."}` |
| `503` | Production without `DEMO_RESET_ENABLED=true` | `{"error":"Demo reset is disabled in production..."}` |
| `500` | Internal DB error | `{"error":"Demo reset failed...","detail":"<message>"}` |

---

## All cURL Examples

### Basic reset (dev)
```bash
curl -X POST http://localhost:8080/api/demo/reset \
  -H "Authorization: Bearer dev-demo-secret-2026" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Reset with confirm string (CI/CD safe)
```bash
curl -X POST https://qorix-api.fly.dev/api/demo/reset \
  -H "Authorization: Bearer $DEMO_RESET_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"confirm":"RESET_DEMO"}'
```

### Using X-Demo-Secret (when Authorization header is stripped)
```bash
curl -X POST https://qorix-api.fly.dev/api/demo/reset \
  -H "X-Demo-Secret: $DEMO_RESET_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Check status before reset
```bash
# Step 1 — check availability
AVAILABLE=$(curl -s https://qorix-api.fly.dev/api/demo/status | jq -r '.resetAvailable')

# Step 2 — reset only if available
if [ "$AVAILABLE" = "true" ]; then
  curl -X POST https://qorix-api.fly.dev/api/demo/status \
    -H "Authorization: Bearer $DEMO_RESET_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"confirm":"RESET_DEMO"}'
fi
```

### Extract token after reset and immediately call an API
```bash
# Reset and get credentials
RESET=$(curl -s -X POST http://localhost:8080/api/demo/reset \
  -H "Authorization: Bearer dev-demo-secret-2026" \
  -H "Content-Type: application/json" \
  -d '{}')

EMAIL=$(echo $RESET | jq -r '.demoEmail')
PASS=$(echo $RESET | jq -r '.demoPassword')

# Login and get JWT
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | jq -r '.token')

# Use JWT to call authenticated API
curl -s http://localhost:8080/api/wallet \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `DEMO_RESET_SECRET` | **Yes** | Secret key callers must provide. Set via Replit Secrets. | `dev-demo-secret-2026` |
| `DEMO_RESET_ENABLED` | Only in production | If `NODE_ENV=production`, this must be `"true"` to allow resets. | `true` |

### Setting up in different environments

**Replit dev (current):**
- `DEMO_RESET_SECRET` is already set in the Secrets panel as `dev-demo-secret-2026`
- No `DEMO_RESET_ENABLED` needed (dev always allows reset)

**Fly.io staging:**
```bash
fly secrets set DEMO_RESET_SECRET="your-staging-secret" --app qorix-api-staging
# No DEMO_RESET_ENABLED needed if NODE_ENV != production
```

**Fly.io production (use with extreme care):**
```bash
fly secrets set DEMO_RESET_SECRET="your-prod-secret" --app qorix-api
fly secrets set DEMO_RESET_ENABLED="true" --app qorix-api
```

---

## What Gets Reset

### Deleted first (parallel)
- All bot trades for demo user
- All transactions for demo user
- All notifications for demo user
- All equity history for demo user
- All P2P chat messages, escrow records, ratings for demo's orders
- All P2P orders for demo user
- All P2P ads for P2P seller
- All P2P payment methods for P2P seller
- Demo user's active investment
- P2P wallets for demo user and seller

### Then re-seeded (deterministic)

| Dataset | Value |
|---|---|
| **Main balance (INR)** | ₹2,45,000 |
| **USDT wallet** | $125.50 |
| **Trading balance** | $5,000 (active bot) |
| **Profit balance** | $412.75 |
| **Investment** | $5,000 · Medium risk · Active · 40 days old |
| **Equity history** | 90 days, realistic growth curve (~0.4-0.6%/day, 12% loss days) |
| **Bot trades** | 150 trades across XAUUSD, EURUSD, BTCUSD, USOIL · ~72% win rate |
| **Transactions** | 48 rows — deposits, profits, referral bonuses, 1 pending withdrawal |
| **Notifications** | 11 total · 3 unread (profit, drawdown alert, P2P update) |
| **P2P ad** | FastTrader99 active SELL ad · 500 USDT · ₹96.50/USDT |
| **P2P completed order** | 100 USDT bought · 7-message chat · 5★ ratings both ways |
| **P2P pending order** | 50 USDT · 12-min countdown from reset time |

---

## Flutter Integration

### Dart client

```dart
// lib/core/api/demo_service.dart

import 'dart:convert';
import 'package:http/http.dart' as http;

class DemoResetResult {
  final bool success;
  final String email;
  final String password;
  final String resetAt;
  final int durationMs;

  DemoResetResult({
    required this.success,
    required this.email,
    required this.password,
    required this.resetAt,
    required this.durationMs,
  });

  factory DemoResetResult.fromJson(Map<String, dynamic> json) => DemoResetResult(
    success: json['success'] as bool,
    email: json['demoEmail'] as String,
    password: json['demoPassword'] as String,
    resetAt: json['resetAt'] as String,
    durationMs: json['durationMs'] as int,
  );
}

class DemoService {
  final String baseUrl;
  final String resetSecret;

  const DemoService({required this.baseUrl, required this.resetSecret});

  /// Check if the reset endpoint is available in the current environment.
  Future<bool> isResetAvailable() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/api/demo/status'));
      if (res.statusCode != 200) return false;
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return data['resetAvailable'] == true;
    } catch (_) {
      return false;
    }
  }

  /// Reset the full demo ecosystem and return fresh credentials.
  /// Throws [DemoResetException] on failure.
  Future<DemoResetResult> reset({bool requireConfirm = false}) async {
    final body = requireConfirm ? '{"confirm":"RESET_DEMO"}' : '{}';

    final res = await http.post(
      Uri.parse('$baseUrl/api/demo/reset'),
      headers: {
        'Authorization': 'Bearer $resetSecret',
        'Content-Type': 'application/json',
      },
      body: body,
    );

    if (res.statusCode == 200) {
      return DemoResetResult.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
    }

    final error = (jsonDecode(res.body) as Map<String, dynamic>)['error'] as String? ?? 'Unknown error';
    throw DemoResetException(statusCode: res.statusCode, message: error);
  }
}

class DemoResetException implements Exception {
  final int statusCode;
  final String message;
  const DemoResetException({required this.statusCode, required this.message});

  @override
  String toString() => 'DemoResetException($statusCode): $message';
}
```

### Usage in a test helper

```dart
// test/helpers/demo_helper.dart

import 'package:flutter_test/flutter_test.dart';
import '../lib/core/api/demo_service.dart';

const _demoService = DemoService(
  baseUrl: 'http://localhost:8080',
  resetSecret: 'dev-demo-secret-2026',
);

/// Reset demo data before a widget test.
Future<void> resetDemoForTest() async {
  final result = await _demoService.reset();
  expect(result.success, isTrue, reason: 'Demo reset should succeed');
  expect(result.email, equals('demo@qorix.markets'));
  // ignore: avoid_print
  print('[demo] Reset complete in ${result.durationMs}ms');
}
```

### Usage in UI (QA reset button)

```dart
// Show a reset button in debug builds only
if (kDebugMode)
  ElevatedButton.icon(
    icon: const Icon(Icons.refresh),
    label: const Text('Reset Demo Data'),
    style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
    onPressed: () async {
      final service = ref.read(demoServiceProvider);
      try {
        showLoadingDialog(context);
        final result = await service.reset();
        if (!mounted) return;
        Navigator.pop(context); // dismiss loading
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reset complete in ${result.durationMs}ms')),
        );
        // Re-login with fresh credentials
        await ref.read(authProvider.notifier).login(
          email: result.email,
          password: result.password,
        );
      } catch (e) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Reset failed: $e'), backgroundColor: Colors.red),
        );
      }
    },
  ),
```

---

## Security Notes

1. **The secret is not a JWT** — it bypasses user authentication entirely, so treat it with the same care as a master password or admin API key.
2. **Never hardcode the secret in Flutter source** — use `--dart-define` or a `.env` file excluded from git.
3. **Production guard** — without `DEMO_RESET_ENABLED=true`, the endpoint returns 503 in production even if the correct secret is supplied. This prevents an accidental deploy of staging config from wiping prod data.
4. **Rate limiting** — the global per-IP rate limiter applies (same as all other `/api` routes). The reset itself is slow enough (~2s) that it self-rate-limits under normal usage.
5. **No data is permanently deleted** — the three user accounts (Arjun Mehta, FastTrader99, Vikram Singh) are preserved; only their associated data (trades, notifications, P2P, etc.) is wiped and re-seeded. User IDs stay stable across resets.

---

## Performance Benchmarks

Measured against Neon PostgreSQL (Singapore region) from Fly.io BOM:

| Operation | Parallel? | Typical time |
|---|---|---|
| Delete old data | Yes (parallel) | ~400ms |
| Wallet upserts (3 users) | Yes (parallel) | ~80ms |
| Insert investment | No | ~30ms |
| Insert 90 equity rows | No | ~120ms |
| Insert 150 trades | No | ~200ms |
| Insert 48 transactions | No | ~80ms |
| Insert 11 notifications | No | ~30ms |
| P2P ecosystem setup | Partially parallel | ~300ms |
| **Total** | | **~1.8–2.5s** |

Full reset completes in under 3 seconds from a cold call. Fast enough to integrate into UI loading states without a skeleton screen.
