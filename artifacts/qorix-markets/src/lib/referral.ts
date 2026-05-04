/**
 * Referral capture utility. Reads `?ref=CODE` (or `?referral=CODE`) from
 * the URL on first visit, normalises to upper-case, and persists in
 * localStorage for 30 days so the code survives multi-page navigation
 * before the user lands on /signup.
 *
 * The existing /signup page already auto-fills `?ref=` from the URL — the
 * helpers here add cross-page persistence and a `withRef()` builder so
 * every CTA link carries the code forward without each component needing
 * to know about it.
 */

const STORAGE_KEY = "qx_ref";
const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredRef {
  code: string;
  ts: number;
}

export function captureReferralFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("ref") || params.get("referral") || "").trim();
    if (!raw) return;
    const code = raw.toUpperCase().slice(0, 32);
    const payload: StoredRef = { code, ts: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* localStorage may be blocked (incognito); silently ignore */
  }
}

export function getReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRef;
    if (!parsed?.code) return null;
    if (Date.now() - parsed.ts > STORAGE_TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearReferralCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Append the stored referral code to a target URL. Used by every "Start
 * Trading" / "Sign up" CTA on marketing pages so the referral attribution
 * follows the user into the signup form.
 */
export function withRef(href: string): string {
  const code = getReferralCode();
  if (!code) return href;
  if (!href.startsWith("/") && !href.startsWith("http")) return href;
  const sep = href.includes("?") ? "&" : "?";
  if (href.includes("ref=")) return href;
  return `${href}${sep}ref=${encodeURIComponent(code)}`;
}
