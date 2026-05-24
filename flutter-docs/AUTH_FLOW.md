# Qorix Markets — Complete Mobile Auth Flow

> All branches, states, and decisions for implementing auth in Flutter.
> Every path that can return a JWT is documented here.

---

## Overview

The auth system has 4 entry paths:
1. **Email + Password** (standard)
2. **Email + Password + 2FA TOTP** (if user enrolled TOTP)
3. **Google OAuth** (SSO)
4. **New Device Approval** (when logging in from unrecognized device)

---

## Path 1: Standard Login

```
POST /api/auth/login
  {email, password, captchaToken}

  ┌─── Response branches ──────────────────────────────────────────────┐
  │                                                                    │
  │  requiresVerification: true  ──► Show OTP verify screen           │
  │  (email not confirmed)            POST /api/auth/resend-verification│
  │                                   POST /api/auth/verify-email-public│
  │                                   ──► Issues JWT on success        │
  │                                                                    │
  │  requires2FA: true  ──────────► Show TOTP input screen            │
  │  (2FA enabled)                    POST /api/auth/2fa/login-verify  │
  │                                   {twoFactorToken, code}           │
  │                                   ──► Issues JWT on success        │
  │                                                                    │
  │  requiresApproval: true  ─────► Show "Approve on other device"    │
  │  (new device detected)            screen with countdown timer      │
  │                                   Poll: GET /api/auth/login-approval│
  │                                   ?pollToken=<token>               │
  │                                   every 3s until approved/expired  │
  │                                   ──► Issues JWT on approved       │
  │                                                                    │
  │  token + user (JWT issued)  ──► Save JWT → navigate to home       │
  │  (standard success)                                                │
  └────────────────────────────────────────────────────────────────────┘
```

---

## Path 2: Registration → Verification

```
POST /api/auth/register
  {email, password, fullName, referralCode?, captchaToken, _hp: "", _plt: timestamp}

  ──► Always returns {requiresVerification: true}

POST /api/auth/verify-email-public
  {email, otp}

  ──► Returns {token, user}  (JWT issued)
  ──► Save token → navigate to home (KYC gate)
```

---

## Path 3: Google OAuth

```
GET /api/auth/google   (opens OAuth popup/redirect)

  ──► Google callback → POST /api/auth/google/callback (server-side)

  ──► Redirects to: /auth-success?token=<jwt>

  Flutter WebView or deep-link capture → extract token from URL
```

---

## Path 4: Forgot Password Flow

```
POST /api/auth/forgot-password
  {email}
  ──► Always 200 (anti-enumeration)

POST /api/auth/verify-reset-otp
  {email, otp}
  ──► {resetToken: "<short-lived-token>"}

POST /api/auth/reset-password
  {resetToken, newPassword}
  ──► {success: true}

  ──► Then: POST /api/auth/login (normal flow)
```

---

## JWT Storage & Usage

```dart
// Store
await secureStorage.write(key: 'jwt', value: token);

// Use on every authenticated request
final token = await secureStorage.read(key: 'jwt');
request.headers['Authorization'] = 'Bearer $token';

// Check expiry (7-day token)
// JWT payload: { userId, isAdmin, aud: "markets", iat, exp }
// Parse locally with jwt_decode package — do not call /auth/me to check

// On 401 response → clear token + redirect to login
// No refresh token — must re-login
```

---

## Captcha Integration

All public auth endpoints require a Cloudflare Turnstile token:

```dart
// Use cloudflare_turnstile flutter package
// Widget renders the Turnstile challenge
// On success: captchaToken callback fires with token string
// Send as: body["captchaToken"] = token

// In dev (no TURNSTILE_SECRET_KEY set): server auto-skips captcha
// Never hardcode a token — always get fresh one per submission attempt
```

---

## 2FA Verify Endpoints

**POST `/api/auth/2fa/login-verify`**
```json
{
  "twoFactorToken": "<challenge-jwt-from-login>",
  "code": "123456"
}
```
Success → `{token, user}` (full JWT)

**POST `/api/auth/2fa/email-fallback/request`**
```json
{ "twoFactorToken": "<challenge-jwt>" }
```
Sends OTP to user's email as 2FA backup

**POST `/api/auth/2fa/email-fallback/verify`**
```json
{ "twoFactorToken": "<challenge-jwt>", "code": "123456" }
```
Success → `{token, user}` (full JWT)

---

## New Device Approval Polling

```dart
// When login returns { requiresApproval: true, pollToken, expiresAt }:

Timer.periodic(Duration(seconds: 3), (timer) async {
  final res = await http.get(
    Uri.parse('$base/api/auth/login-approval?pollToken=$pollToken'),
  );
  final data = jsonDecode(res.body);
  
  if (data['status'] == 'approved') {
    timer.cancel();
    final jwt = data['token'];
    // save and navigate
  } else if (data['status'] == 'denied' || data['status'] == 'expired') {
    timer.cancel();
    // show error + back to login
  }
  // status == 'pending' → keep polling
});
```

The poll window is **10 minutes**. After expiry, the server returns `status: 'expired'`.

---

## Withdrawal OTP Flow

Withdrawals require a separate OTP. This is NOT the login OTP.

```
POST /api/auth/withdrawal-otp
  (no body needed — userId from JWT)
  ──► Sends 6-digit OTP to user's registered email
  ──► {success: true, message: "OTP sent"}

POST /api/wallet/withdraw
  {amount, walletAddress, otp: "123456", source: "profit", idempotencyKey: "<uuid>"}
  ──► Withdrawal submitted
```

OTP expires in **10 minutes**. Request new one after expiry.

---

## Account States & Their Effect

| State | Can Login | Can Trade | Can Withdraw | Can View |
|---|---|---|---|---|
| Normal | ✅ | ✅ (if KYC) | ✅ (if KYC) | ✅ |
| Email unverified | ❌ (redirected to verify) | ❌ | ❌ | ❌ |
| isFrozen | ❌ 403 | ❌ | ❌ | ❌ |
| isDisabled | ❌ 403 | ❌ | ❌ | ❌ |
| KYC pending/none | ✅ | ❌ | ❌ | ✅ |
| New account (<24h) | ✅ | ✅ | ❌ (locked) | ✅ |
| Post-password-change | ✅ | ✅ | ❌ (24h lock) | ✅ |

---

## Security Headers Required

Flutter's `http` package sends no `Origin` header by default — that is correct and expected. The server's origin guard includes a **stateless Bearer bypass**: any request with `Authorization: Bearer <token>` and no cookie header is automatically passed through.

Do NOT send Cookie headers. Do NOT send Origin headers manually. Just send Bearer.

```dart
// ✅ Correct — triggers the stateless bearer bypass
headers: {
  'Authorization': 'Bearer $jwt',
  'Content-Type': 'application/json',
}

// ❌ Wrong — never set Origin manually
headers: {
  'Origin': 'https://qorixmarkets.com', // don't do this
}
```

---

## Device ID Header (optional but recommended)

Send a stable device UUID on every request. This enables new-device login alerts and withdrawal device cooldowns:

```dart
// Generate once and persist
final deviceId = await secureStorage.read(key: 'device_id')
  ?? const Uuid().v4();
await secureStorage.write(key: 'device_id', value: deviceId);

// Send on every request
headers['X-Device-Id'] = deviceId;
```

---

## Error Handling Guide

```dart
switch (response.statusCode) {
  case 200:
  case 201:
    // success — parse body
    break;

  case 400:
    final body = jsonDecode(response.body);
    // Show body['error'] or body['message'] to user
    break;

  case 401:
    // JWT expired or invalid → clear token → push login
    await secureStorage.delete(key: 'jwt');
    Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
    break;

  case 403:
    final body = jsonDecode(response.body);
    if (body['error'] == 'kyc_required') {
      Navigator.pushNamed(context, '/kyc');
    } else {
      showSnackbar(body['error'] ?? 'Access denied');
    }
    break;

  case 429:
    final retryAfter = response.headers['retry-after'] ?? '60';
    showSnackbar('Too many attempts. Try again in $retryAfter seconds.');
    break;

  case 503:
    showSnackbar('Platform is temporarily under maintenance. Please try again shortly.');
    break;

  default:
    showSnackbar('Something went wrong. Please try again.');
}
```
