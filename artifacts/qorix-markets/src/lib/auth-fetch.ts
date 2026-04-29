import { notifyMaintenance } from "./maintenance-state";
import { DEVICE_ID_HEADER, getOrCreateDeviceId } from "./device-id";

export async function authFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("qorix_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    // Stable per-browser device identity for the security stack — the
    // server prefers this over hash(UA + IP) so a browser that roams
    // networks isn't false-flagged as a new device. See lib/device-id.ts
    // for the full rationale and the storage / fallback semantics.
    [DEVICE_ID_HEADER]: getOrCreateDeviceId(),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
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
