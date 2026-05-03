import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setAuthTokenGetter,
  setBaseUrl,
  setPendingCaptchaToken,
} from "@workspace/api-client-react";

export const QORIX_API_BASE = "https://qorix-api.fly.dev/api";
export const TOKEN_STORAGE_KEY = "@qorix_token";

// Cloudflare Turnstile site key (public — safe to commit).
// Provided by Qorix Markets for mobile/web client captcha verification.
export const TURNSTILE_SITE_KEY = "0x4AAAAAADF7hI5k4y3DhVSQh78YMeLoc7U";

/**
 * Set a one-shot Turnstile captcha token to attach to the next API request.
 * Call this immediately before invoking signup() / login() / any captcha-gated
 * endpoint after the Turnstile widget produces a token.
 */
export function setCaptchaToken(token: string | null): void {
  setPendingCaptchaToken(token);
}

let memoryToken: string | null = null;

export async function setAuthToken(token: string | null): Promise<void> {
  memoryToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  const stored = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  memoryToken = stored;
  return stored;
}

export function configureApiClient(): void {
  setBaseUrl(QORIX_API_BASE);
  setAuthTokenGetter(() => getAuthToken());
}

// ---------------------------------------------------------------------------
// Direct REST helpers for endpoints not yet in the generated api-client.
// Keep payload shapes in sync with artifacts/api-server/src/routes/*.ts.
// ---------------------------------------------------------------------------

async function authedRequest<T>(
  path: string,
  init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = { method: "GET" },
): Promise<T> {
  const token = await getAuthToken();
  const res = await fetch(`${QORIX_API_BASE}${path}`, {
    method: init.method,
    headers: {
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data && typeof data.error === "string" && data.error) ||
      `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { status?: number; data?: unknown };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

// ─── change-password ────────────────────────────────────────────────────────
export interface ChangePasswordResponse {
  success: true;
  message: string;
  passwordChangedAt: string;
  withdrawalLockedUntil: string;
  withdrawalLockHours: number;
}

export function changePassword(body: {
  currentPassword: string;
  newPassword: string;
}): Promise<ChangePasswordResponse> {
  return authedRequest<ChangePasswordResponse>("/auth/change-password", {
    method: "POST",
    body,
  });
}

// ─── 2FA (TOTP) ─────────────────────────────────────────────────────────────
export interface TwoFactorStatus {
  enabled: boolean;
  backupCodesRemaining: number;
  enabledAt: string | null;
}
export interface TwoFactorSetupResponse {
  qrDataUrl: string;
  manualCode: string;
  issuer: string;
  accountName: string;
}
export interface TwoFactorVerifySetupResponse {
  enabled: true;
  backupCodes: string[];
}

export function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  return authedRequest<TwoFactorStatus>("/security/2fa/status");
}
export function setupTwoFactor(): Promise<TwoFactorSetupResponse> {
  return authedRequest<TwoFactorSetupResponse>("/security/2fa/setup", {
    method: "POST",
    body: {},
  });
}
export function verifyTwoFactorSetup(code: string): Promise<TwoFactorVerifySetupResponse> {
  return authedRequest<TwoFactorVerifySetupResponse>("/security/2fa/verify-setup", {
    method: "POST",
    body: { code },
  });
}
export function disableTwoFactor(password: string, code: string): Promise<{ enabled: false }> {
  return authedRequest<{ enabled: false }>("/security/2fa/disable", {
    method: "POST",
    body: { password, code },
  });
}

// ─── devices (read-only — no revoke endpoint server-side) ───────────────────
export interface ApiDevice {
  id: string;
  browser: string;
  os: string;
  firstSeenAt: string;
  lastSeenAt: string;
  city: string | null;
  country: string | null;
  isCurrent: boolean;
  newDeviceAlertSent: boolean;
  withdrawalLocked: boolean;
  withdrawalUnlockAt: string | null;
  withdrawalUnlockHoursLeft: number;
  withdrawalUnlockIst: string | null;
}
export interface ListDevicesResponse {
  devices: ApiDevice[];
  cooldownHours: number;
  currentDeviceTracked: boolean;
  currentSession:
    | { withdrawalAllowed: true }
    | {
        withdrawalAllowed: false;
        message: string;
        hoursLeft: number;
        unlockAt: string;
        unlockIst: string;
      };
}

export function listDevices(): Promise<ListDevicesResponse> {
  return authedRequest<ListDevicesResponse>("/devices");
}
