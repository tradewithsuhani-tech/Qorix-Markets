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
- `GET /v1/feature-flags` — public (no auth), in v1.ts, placed before WRITE GUARDS section.
- `GET /admin/feature-flags` + `PATCH /admin/feature-flags/:key` — admin-auth, in admin.ts, upserts DB row then calls `invalidateFeatureFlagsCache()`.
- Seeds in `seed-settings.ts` — 8 `feature.*` defaults inserted on every boot.

**Why:** `import` statements must be at the top of files in TypeScript/ESM. Placing them mid-file (after `const` declarations) causes runtime errors in Vite's HMR even if esbuild strips them at build time.

## Web (qorix-markets)
- `src/hooks/use-feature-flags.ts` — `useFeatureFlags()` React Query hook, polls every 60s, `staleTime: 30s`, fail-open.
- `src/contexts/feature-flags-context.tsx` — `FeatureFlagsProvider`, `useFlag(key)`, `useAllFlags()`.
- `App.tsx` — `FeatureFlagsProvider` wraps inside `AuthProvider`. `FlaggedRoute` component checks both auth + flag; redirects to `/dashboard` if flag is off.
- Guarded routes: `/p2p/*` → p2p flag; `/referral` → referral; `/signal-history` → signal_trading.
- `layout.tsx` — imports `useAllFlags` at top, spreads flagged entries into `userLinks` array (p2p, referral).
- Admin UI: `FeatureFlagsAdmin` component in `admin-modules.tsx`, calls `/admin/feature-flags` GET + PATCH, shows violet toggles.

## Mobile (qorix-mobile)
- `hooks/useFeatureFlags.ts` — uses `QORIX_API_BASE` from `@/lib/apiClient` (NOT a custom `API_BASE_URL` constant — that doesn't exist in mobile). URL: `${QORIX_API_BASE}/v1/feature-flags`.

**How to apply:** When adding new flags, add the key to `FLAG_KEYS` array in both `feature-flags-cache.ts` (backend) and `use-feature-flags.ts` (web hook), add a label in `FEATURE_FLAG_LABELS`, add a seed row in `seed-settings.ts`, then add `FlaggedRoute` in App.tsx and filter in layout.tsx.
