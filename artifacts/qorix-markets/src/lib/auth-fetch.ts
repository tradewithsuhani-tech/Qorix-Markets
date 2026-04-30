import { notifyMaintenance } from "./maintenance-state";
import { DEVICE_ID_HEADER, getOrCreateDeviceId } from "./device-id";
import { getCsrfHeaders, invalidateCsrfToken, isCsrfError } from "./csrf-token";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function methodOf(init?: RequestInit): string {
  return (init?.method || "GET").toUpperCase();
}

async function doFetch(url: string, init: RequestInit | undefined, attachCsrf: boolean): Promise<Response> {
  const token = localStorage.getItem("qorix_token");
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    // Stable per-browser device identity for the security stack — the
    // server prefers this over hash(UA + IP) so a browser that roams
    // networks isn't false-flagged as a new device. See lib/device-id.ts
    // for the full rationale and the storage / fallback semantics.
    [DEVICE_ID_HEADER]: getOrCreateDeviceId(),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) baseHeaders.Authorization = `Bearer ${token}`;
  // B30: CSRF nonce on state-changing methods. getCsrfHeaders() returns an
  // empty object when the server reports CSRF as disabled, so this is a
  // pure no-op until the operator opts in via CSRF_HMAC_SECRET on the API.
  if (attachCsrf) {
    const csrfHeaders = await getCsrfHeaders();
    Object.assign(baseHeaders, csrfHeaders);
  }
  return fetch(url, { ...init, headers: baseHeaders });
}

export async function authFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const isStateChange = STATE_CHANGING_METHODS.has(methodOf(init));

  let res = await doFetch(url, init, isStateChange);
  let text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  // B30 CSRF retry: if a state-changing call hit a CSRF_* 403 (e.g.
  // because our cached token expired one second before reaching the
  // server, or the operator just flipped the feature on between our
  // last /api/csrf bootstrap and now), invalidate the cache and retry
  // exactly once. Two-attempt cap prevents infinite loops if the
  // server keeps rejecting (e.g. UA mismatch from a transparent proxy
  // rewriting the User-Agent header).
  if (isStateChange && isCsrfError(res.status, data)) {
    invalidateCsrfToken();
    res = await doFetch(url, init, true);
    text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  }

  // Surface MAINTENANCE_MODE 503s (and read responses tagged with the marker
  // header) into the global maintenance banner state, same path the codegen
  // client uses. Done before the throw so the banner still shows even if the
  // caller catches and silences the error.
  const maintenanceHeader = res.headers.get("x-maintenance-mode") === "true";
  const maintenanceBody = data && typeof data === "object" && data.code === "maintenance_mode";
  if (maintenanceHeader || maintenanceBody) {
    const msg = data && typeof data === "object" && typeof data.message === "string" ? data.message : undefined;
    // ETA travels alongside the marker — header first (set on every read +
    // 503), body `endsAt` as a fallback for callers that only see JSON.
    const headerEndsAt = res.headers.get("x-maintenance-ends-at") || undefined;
    const bodyEndsAt = data && typeof data === "object" && typeof data.endsAt === "string" ? data.endsAt : undefined;
    notifyMaintenance(msg, headerEndsAt || bodyEndsAt);
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
