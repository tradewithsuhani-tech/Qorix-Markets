import { notifyMaintenance } from "./maintenance-state";
import { DEVICE_ID_HEADER, getOrCreateDeviceId } from "./device-id";
import { getCsrfHeaders, invalidateCsrfToken, isCsrfError } from "./csrf-token";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Separate token storage from user/admin so a merchant signing in on a shared
// browser doesn't clobber the user's session, and vice versa.
export const MERCHANT_TOKEN_KEY = "qorix_merchant_token";

export function getMerchantToken(): string | null {
  return localStorage.getItem(MERCHANT_TOKEN_KEY);
}

export function setMerchantToken(token: string): void {
  localStorage.setItem(MERCHANT_TOKEN_KEY, token);
}

export function clearMerchantToken(): void {
  localStorage.removeItem(MERCHANT_TOKEN_KEY);
}

async function doMerchantFetch(url: string, init: RequestInit | undefined, attachCsrf: boolean): Promise<Response> {
  const token = getMerchantToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Stable per-browser device identity — same rationale as in auth-fetch.ts.
    // Server-side `computeDeviceFingerprint(req)` reads this header and
    // prefers it over hash(UA + IP) so the merchant card stays stable when
    // the merchant browser roams between networks (mobile data ↔ wifi).
    [DEVICE_ID_HEADER]: getOrCreateDeviceId(),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // B30: CSRF nonce on state-changing methods. No-op when CSRF is disabled
  // server-side. See csrf-token.ts for the cache + bootstrap semantics.
  if (attachCsrf) {
    const csrfHeaders = await getCsrfHeaders();
    Object.assign(headers, csrfHeaders);
  }
  return fetch(url, { ...init, headers });
}

export async function merchantAuthFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const isStateChange = STATE_CHANGING_METHODS.has(method);

  let res = await doMerchantFetch(url, init, isStateChange);
  let text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // B30 CSRF retry: same pattern as authFetch — invalidate + one-shot
  // retry on CSRF_* 403, then fall through to the rest of the handling
  // exactly as before.
  if (isStateChange && isCsrfError(res.status, data)) {
    invalidateCsrfToken();
    res = await doMerchantFetch(url, init, true);
    text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  }

  const maintenanceHeader = res.headers.get("x-maintenance-mode") === "true";
  const maintenanceBody =
    data && typeof data === "object" && (data as { code?: string }).code === "maintenance_mode";
  if (maintenanceHeader || maintenanceBody) {
    const msg =
      data && typeof data === "object" && typeof (data as { message?: string }).message === "string"
        ? (data as { message: string }).message
        : undefined;
    const headerEndsAt = res.headers.get("x-maintenance-ends-at") || undefined;
    const bodyEndsAt =
      data && typeof data === "object" && typeof (data as { endsAt?: string }).endsAt === "string"
        ? (data as { endsAt: string }).endsAt
        : undefined;
    notifyMaintenance(msg, headerEndsAt || bodyEndsAt);
  }
  // Special-case: backend signals "the admin disabled this merchant account
  // mid-session" with HTTP 403 + { code: "ACCOUNT_DISABLED" }. We need to
  // (a) clear the now-useless token, (b) bounce the user back to the login
  // page, and (c) carry a flag in the URL so the login page shows a clear,
  // actionable banner — instead of the user staring at a generic "Login
  // failed" toast and assuming they typed the wrong password.
  const isAccountDisabled =
    res.status === 403 &&
    data &&
    typeof data === "object" &&
    (data as { code?: string }).code === "ACCOUNT_DISABLED";
  if (isAccountDisabled) {
    clearMerchantToken();
    if (typeof window !== "undefined" && !window.location.pathname.endsWith("/merchant/login")) {
      window.location.href = `${import.meta.env.BASE_URL ?? "/"}merchant/login?disabled=1`;
    }
  } else if (res.status === 401) {
    // Stale token — clear and bounce back to login. Wouter handles the SPA
    // navigation; full reload would lose the toast.
    clearMerchantToken();
    if (typeof window !== "undefined" && !window.location.pathname.endsWith("/merchant/login")) {
      window.location.href = `${import.meta.env.BASE_URL ?? "/"}merchant/login`;
    }
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    if (data && typeof data === "object") {
      const obj = data as { message?: unknown; error?: unknown };
      if (typeof obj.message === "string") msg = obj.message;
      else if (typeof obj.error === "string") msg = obj.error;
    }
    throw new Error(msg);
  }
  return data as T;
}

const BASE_URL = import.meta.env.BASE_URL ?? "/";
export function merchantApiUrl(p: string): string {
  return `${BASE_URL}api${p}`;
}
