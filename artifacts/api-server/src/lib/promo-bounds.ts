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
