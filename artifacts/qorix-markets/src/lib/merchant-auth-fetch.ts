import { notifyMaintenance } from "./maintenance-state";

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

export async function merchantAuthFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const token = getMerchantToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
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
  if (res.status === 401) {
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
