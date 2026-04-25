// Single source of truth for promo settings bounds. Imported by:
//   - routes/admin.ts  -> server-side validation of POST /admin/settings
//   - routes/promo.ts  -> defensive runtime clamp when reading from DB
// The admin UI in artifacts/qorix-markets/src/pages/admin-modules.tsx mirrors
// these limits in the input min/max/maxLength attributes. Keep all four in sync.
export const PROMO_BOUNDS = {
  windowMin: 5,
  windowMax: 240,
  pctMin: 0.5,
  pctMax: 50,
  stepMin: 0.1,
  stepMax: 5,
  codePrefixMaxLen: 8,
} as const;

export function normalizePromoCodePrefix(raw: string): string {
  const cleaned = String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, PROMO_BOUNDS.codePrefixMaxLen);
  return cleaned || "QRX";
}

// Scheduled holiday-promo codes (e.g. "DIWALI25", "NYE2026") — independent of
// the rotating-window prefix. Allowed: A-Z, 0-9. Length 1..32. Returns "" when
// nothing valid remains so the caller can produce a 400.
export const SCHEDULED_PROMO_CODE_MAX_LEN = 32;
export function normalizeScheduledPromoCode(raw: string): string {
  return String(raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, SCHEDULED_PROMO_CODE_MAX_LEN);
}
