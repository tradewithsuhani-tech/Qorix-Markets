# Qorix Markets — Environment Setup Guide

> Complete reference for all environment variables across dev, staging, and production.
> For Flutter integration, this tells you which server-side variables affect API behaviour you consume.

---

## Quick Start (Flutter Dev Against Local API)

```bash
# 1. Clone & install
pnpm install

# 2. Start the API server (runs on :8080)
pnpm --filter @workspace/api-server run dev
# OR via Replit workflow: "API Server"

# 3. Start the web frontend (runs on :5000)
pnpm --filter @workspace/qorix-markets run dev

# 4. Flutter — point to local API
# In your Flutter app's .env or dart-define:
# BASE_URL=http://localhost:8080
```

---

## API Server Environment Variables

### Required in Production

| Variable | Description | Example |
|---|---|---|
| `NEON_DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `REDIS_URL` | Redis connection string | `redis://user:pass@host:6379` |
| `JWT_SECRET` | Secret for signing user JWTs | 64+ char random hex |
| `WALLET_ENC_SECRET` | Encryption key for TRON wallet private keys | 32 char hex |

### Auth & Security

| Variable | Description | Default |
|---|---|---|
| `JWT_EXPIRY` | JWT TTL | `7d` |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | `""` (dev = all) |
| `CSRF_HMAC_SECRET` | HMAC CSRF nonce secret (opt-in) | unset = disabled |
| `ADMIN_IP_ALLOWLIST` | Comma-separated IP/CIDR for admin routes | unset = disabled |
| `CF_ORIGIN_SECRET` | Cloudflare origin pin header value | unset = disabled |

### External Services

| Variable | Description | Where to get |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI for quiz question generation | platform.openai.com |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile captcha | dash.cloudflare.com |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | console.cloud.google.com |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | console.cloud.google.com |
| `SMTP_HOST` | Email SMTP host | Your SES/SMTP provider |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | AWS SES access key |
| `SMTP_PASS` | SMTP password | AWS SES secret |
| `SMTP_FROM` | From address | `noreply@qorixmarkets.com` |
| `TRONGRID_API_KEY` | TronGrid for USDT deposit watching | trongrid.io |
| `PLATFORM_TRON_PRIVATE_KEY` | Platform TRON wallet key | From wallet generation |
| `TELEGRAM_BOT_TOKEN` | Telegram bot for user alerts | @BotFather on Telegram |
| `TWILIO_ACCOUNT_SID` | Twilio for SMS OTP (future) | console.twilio.com |
| `TWILIO_AUTH_TOKEN` | Twilio auth | console.twilio.com |
| `TWILIO_FROM_NUMBER` | Twilio from number | console.twilio.com |

### Rate Limiting

| Variable | Description | Default |
|---|---|---|
| `GLOBAL_RATE_LIMIT` | Max requests per IP per minute | `600` |
| `LOGIN_RATE_LIMIT` | Login attempts per IP per minute | `5` |

### Feature Flags

| Variable | Description | Default |
|---|---|---|
| `MAINTENANCE_MODE` | Block all non-admin traffic | `false` |
| `REGISTRATION_ENABLED` | Allow new registrations | `true` |
| `AUTO_DEMO_SIGNUP` | Auto-seed demo funds on signup | `false` |
| `DEMO_RESET_ENABLED` | Enable `/api/demo/reset` in production | `false` |
| `DEMO_RESET_SECRET` | Secret for demo reset endpoint | unset |
| `LOGIN_DEVICE_GATE_DISABLED` | Disable single-device gate (dev only) | `false` |

### App

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listen port | `8080` |
| `NODE_ENV` | `development` or `production` | `development` |
| `BASE_PATH` | URL base path prefix | `/` |
| `NEW_ACCOUNT_WITHDRAWAL_LOCK_HOURS` | Hours new accounts can't withdraw | `24` |

---

## Flutter App Configuration

### dart-define setup (recommended)

```bash
# Development
flutter run \
  --dart-define=BASE_URL=http://localhost:8080 \
  --dart-define=DEMO_RESET_SECRET=dev-demo-secret-2026

# Staging
flutter run \
  --dart-define=BASE_URL=https://qorix-api-staging.fly.dev \
  --dart-define=DEMO_RESET_SECRET=your-staging-secret

# Production
flutter build apk \
  --dart-define=BASE_URL=https://qorix-api.fly.dev
  # No DEMO_RESET_SECRET in production builds
```

### Read in Dart

```dart
// lib/core/config/app_config.dart

class AppConfig {
  static const baseUrl = String.fromEnvironment(
    'BASE_URL',
    defaultValue: 'http://localhost:8080',
  );

  static const demoResetSecret = String.fromEnvironment(
    'DEMO_RESET_SECRET',
    defaultValue: '',
  );

  static bool get hasDemoReset => demoResetSecret.isNotEmpty;
}
```

---

## Endpoint Base URLs

| Environment | Base URL | Notes |
|---|---|---|
| Local dev | `http://localhost:8080` | API Server workflow on Replit |
| Replit preview | `https://$REPLIT_DEV_DOMAIN` | Replace `$` with actual domain |
| Staging (Fly) | `https://qorix-api-staging.fly.dev` | |
| Production (Fly) | `https://qorix-api.fly.dev` | |

All endpoints are under `/api/`. Example: `http://localhost:8080/api/auth/login`

---

## Captcha Setup for Flutter

The server uses **Cloudflare Turnstile** (not reCAPTCHA).

```dart
// pubspec.yaml
dependencies:
  cloudflare_turnstile: ^1.x.x

// In your login/register screen:
TurnstileWidget(
  siteKey: '0x4AAAAAAAxx...', // Turnstile site key (public — safe to embed)
  onTokenReceived: (token) {
    setState(() => _captchaToken = token);
  },
)

// Send with auth requests:
body['captchaToken'] = _captchaToken;
```

**Site keys by environment:**

| Environment | Site Key | Notes |
|---|---|---|
| Dev | Any / none | Server auto-skips if `TURNSTILE_SECRET_KEY` unset |
| Staging/Prod | Contact team | From Cloudflare dashboard |

---

## CORS & Origin Behaviour

The server's origin guard **does not affect Flutter** because Flutter's `http` package:
- Sends `Authorization: Bearer <jwt>` (triggers the stateless Bearer bypass)
- Does NOT send `Cookie` headers
- Does NOT send `Origin` headers (except in `WebView` — avoid `WebView` for API calls)

No special CORS configuration is needed for Flutter native builds.

---

## Demo Credentials (Dev Only)

| Field | Value |
|---|---|
| Email | `demo@qorix.markets` |
| Password | `Demo@Qorix2026` |
| Reset secret | `dev-demo-secret-2026` |
| Referral code | `ARJUN7X` |

Reset endpoint: `POST http://localhost:8080/api/demo/reset`
See `flutter-docs/DEMO_RESET_API.md` for full docs.

---

## Health Check Endpoints

```bash
# Liveness (no auth, no origin guard)
GET /api/healthz
→ { "status": "ok", "ts": 1748000000000 }

# Version
GET /api/version
→ { "version": "1.0.0", "buildAt": "..." }
```

Use `/api/healthz` as a connectivity check in Flutter before showing the app.

---

## Fly.io Production Secrets Management

```bash
# View current secrets (names only)
fly secrets list --app qorix-api

# Set a secret
fly secrets set DEMO_RESET_ENABLED=true --app qorix-api

# Scale machines
fly scale count 3 --app qorix-api

# View logs
fly logs --app qorix-api
```

---

## Database Schema Migrations

```bash
# Run pending migrations
pnpm --filter @workspace/db run migrate

# Or via the Migration Only workflow in Replit

# Generate a new migration after schema changes
pnpm --filter @workspace/db run generate
```
