---
name: Feature Flags system
description: How remote feature flags work — storage, cache, web/mobile integration, admin UI
---

## Storage
Flags stored in `system_settings` table as `feature.<key>` = `"true"` / `"false"`.
Keys: p2p, quiz, signal_trading, referral, inr_withdraw, usdt_deposit, bot_trading, leaderboard.
Default: fail-open (missing row means flag is ON).

## Backend
- `artifacts/api-server/src/lib/feature-flags-cache.ts` — TTLCache (30s), `getFeatureFlags()`, `invalidateFeatureFlagsCache()`, exports `FLAG_KEYS`, `FEATURE_FLAG_LABELS`, `FlagKey`.
- `GET /v1/feature-flags` — public (no auth), in v1.ts.
- `GET /admin/feature-flags` + `PATCH /admin/feature-flags/:key` — admin-auth, in admin.ts, upserts DB row then calls `invalidateFeatureFlagsCache()`.
- Seeds in `seed-settings.ts` — 8 `feature.*` defaults inserted on every boot.

**Why:** `import` statements must be at the top of files. Placing them mid-file causes runtime errors.

## Web (qorix-markets) — Full Coverage
- `src/hooks/use-feature-flags.ts` — `useFeatureFlags()` React Query hook, 60s refetch, 30s stale, fail-open.
- `src/contexts/feature-flags-context.tsx` — `FeatureFlagsProvider`, `useFlag(key)`, `useAllFlags()`.
- `App.tsx` — `FeatureFlagsProvider` wraps inside `AuthProvider`. `FlaggedRoute` redirects to `/dashboard` if flag is off.
  - Guarded routes: `/p2p/*` → p2p; `/referral` → referral; `/signal-history` → signal_trading; `/invest` → bot_trading; `/deposit/crypto` → usdt_deposit; `/withdraw/inr` → inr_withdraw.
- `layout.tsx` — nav links filtered: p2p, referral, bot_trading (Trade link).
- `deposit.tsx` — USDT currency tab hidden + auto-switch to INR when usdt_deposit=false.
- `withdraw.tsx` — INR currency tab hidden + auto-switch to USDT when inr_withdraw=false.
- Admin UI: `FeatureFlagsAdmin` component in `admin-modules.tsx`.

## Mobile (qorix-mobile) — Full Coverage
- `hooks/useFeatureFlags.ts` — uses `QORIX_API_BASE` from `@/lib/apiClient`. TTL 60s, fail-open.
- `app/deposit.tsx` — USDT switcher hidden when usdt_deposit=false; auto-switch to INR.
- `app/withdraw.tsx` — INR switcher hidden when inr_withdraw=false; auto-switch to USDT.
- `app/(tabs)/_layout.tsx` — Terminal tab hidden when bot_trading=false (both ClassicTabLayout via `href: null` and NativeTabLayout via conditional rendering).

## Unimplemented flags (no dedicated page/route exists)
- `quiz` — quiz is in separate Qorixplay app, not in qorix-markets. Nothing to hide in main app.
- `leaderboard` — leaderboards are embedded inside rewards.tsx, analytics.tsx, trading-desk.tsx with no standalone route or nav link.

**How to apply:** When adding new flags, add the key to `FLAG_KEYS` (backend) and `use-feature-flags.ts` (web hook), add label in `FEATURE_FLAG_LABELS`, add seed row in `seed-settings.ts`, then wire `FlaggedRoute` in App.tsx and filter in layout.tsx.
