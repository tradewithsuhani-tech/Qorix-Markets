import type { Request, Response, NextFunction } from "express";
import { db, systemSettingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

// Maintenance has TWO source-of-truth signals that callers should treat as one:
//
//   1. MAINTENANCE_MODE env var — flipped via Fly secret during the Mumbai-DB
//      cutover (and any other ops freeze that doesn't need DB writes).
//        fly secrets set   MAINTENANCE_MODE=true  --app qorix-api
//        fly secrets unset MAINTENANCE_MODE       --app qorix-api
//
//   2. system_settings.maintenance_mode row — toggled from the admin UI for
//      planned maintenance windows that admins drive without a deploy. Used
//      to return a raw 503 from authMiddleware (`{error: "System under
//      maintenance"}` body, no `code`), which blocked reads AND writes and
//      did NOT trigger the friendly inline banner. This module unifies the
//      two so the admin toggle now produces the same structured 503 +
//      `code: "maintenance_mode"` shape, lets reads keep working, and shows
//      the same banner users see during the env-var cutover.
//
// `getMaintenanceState()` merges both signals (with a short in-memory cache so
// the per-request DB lookup doesn't add a round-trip to every API call) and is
// the only "are we in maintenance?" check the rest of the codebase should use.
//
// For operators who explicitly want the legacy "fully block all traffic" mode
// (admins still get through), set `system_settings.maintenance_hard_block` to
// "true" alongside `maintenance_mode`. That additionally rejects reads from
// non-admin authenticated users (enforced in authMiddleware), but with the
// same structured 503 shape so the banner still surfaces.

const MAINTENANCE_KEYS = [
  "maintenance_mode",
  "maintenance_message",
  "maintenance_ends_at",
  "maintenance_hard_block",
] as const;

const DEFAULT_MESSAGE =
  "Brief maintenance in progress — balances will be back shortly.";

export type MaintenanceState = {
  active: boolean;
  // Legacy "block reads too" mode — only ON when `maintenance_hard_block` is
  // explicitly set in system_settings. Default behaviour is the soft "freeze
  // writes, keep reads working" path used by the cutover runbook.
  hardBlock: boolean;
  message: string;
  endsAt: string | null;
  // Where the current ON state is coming from. `null` when not active.
  source: "env" | "db" | "both" | null;
};

// In-memory TTL cache so the DB lookup doesn't fire on every /api request.
// The admin POST /admin/settings handler calls invalidateMaintenanceCache()
// the moment the operator flips the toggle, so the user-facing latency on
// enabling/disabling is bounded by the next request, not by the TTL.
let cached: { state: MaintenanceState; at: number } | null = null;
const CACHE_TTL_MS = 5_000;

export function isEnvMaintenanceMode(): boolean {
  return (process.env["MAINTENANCE_MODE"] ?? "").toLowerCase() === "true";
}

// Optional ETA the operator can attach to a maintenance window via the Fly
// secret MAINTENANCE_ETA (ISO-8601 timestamp, e.g. 2026-04-26T18:00:00Z).
// Returns the ISO string when MAINTENANCE_ETA is a parseable timestamp, else
// null. The source of truth for "are writes back?" stays MAINTENANCE_MODE
// (or the DB row) — an over-running window keeps the banner up rather than
// silently lying to users when the ETA passes.
export function getEnvMaintenanceEndsAt(): string | null {
  const raw = process.env["MAINTENANCE_ETA"];
  if (!raw || !raw.trim()) return null;
  const ts = Date.parse(raw.trim());
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

// Backwards-compatible aliases for callers (e.g. index.ts boot-time gating)
// that historically only knew about the env-var path. Prefer
// `getMaintenanceState()` for new code so the admin DB toggle is honoured too.
export const isMaintenanceMode = isEnvMaintenanceMode;
export const getMaintenanceEndsAt = getEnvMaintenanceEndsAt;

export function invalidateMaintenanceCache(): void {
  cached = null;
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.state;

  const envActive = isEnvMaintenanceMode();
  const envEndsAt = getEnvMaintenanceEndsAt();

  let dbActive = false;
  let dbHardBlock = false;
  let dbMessage: string | null = null;
  let dbEndsAt: string | null = null;
  try {
    const rows = await db
      .select()
      .from(systemSettingsTable)
      .where(inArray(systemSettingsTable.key, [...MAINTENANCE_KEYS]));
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    dbActive = map["maintenance_mode"] === "true";
    dbHardBlock = map["maintenance_hard_block"] === "true";
    const rawMessage = map["maintenance_message"];
    if (typeof rawMessage === "string" && rawMessage.trim()) {
      dbMessage = rawMessage;
    }
    const rawEta = map["maintenance_ends_at"];
    if (typeof rawEta === "string" && rawEta.trim()) {
      const ts = Date.parse(rawEta);
      if (!Number.isNaN(ts)) dbEndsAt = new Date(ts).toISOString();
    }
  } catch {
    // If the DB lookup fails we fall back to env-only. Flapping the gate on
    // every transient DB blip would be worse than briefly missing an admin
    // toggle update — the next successful poll will reconcile.
  }

  const active = envActive || dbActive;
  const source = !active
    ? null
    : envActive && dbActive
      ? "both"
      : envActive
        ? "env"
        : "db";

  // Env ETA wins when both are present (operator-set during a cutover should
  // override whatever value happens to be sitting in the admin row).
  const endsAt = envEndsAt ?? dbEndsAt;

  // Env doesn't carry a custom message channel of its own, so the DB
  // `maintenance_message` row drives the banner copy in both modes.
  const envMessage = process.env["MAINTENANCE_MESSAGE"]?.trim() || null;
  const message = dbMessage ?? envMessage ?? DEFAULT_MESSAGE;

  const state: MaintenanceState = {
    active,
    // Hard-block only takes effect when maintenance is also active; otherwise
    // the flag is dormant.
    hardBlock: active && dbHardBlock,
    message,
    endsAt,
    source,
  };
  cached = { state, at: Date.now() };
  return state;
}

// Methods that must be blocked while writes are frozen. HEAD/OPTIONS are
// metadata-only so they pass through alongside GET. Anything that mutates the
// DB — including custom verbs we might add later — gets caught by the default
// branch below.
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Admin routes are exempt from the write-block so an admin who flipped
// `maintenance_mode` ON via /admin/settings can still POST to flip it OFF
// (otherwise the toggle would be a one-way door from the UI). Auth + admin
// gating still apply on those routes — only an authenticated admin can hit
// them, so this isn't a soft-spot for write traffic during a freeze.
function isAdminApiPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export async function maintenanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const state = await getMaintenanceState();
  if (!state.active) {
    next();
    return;
  }
  // Surface the marker on every response (read or write) so the web app can
  // flip its banner on without waiting for a write to fail.
  res.setHeader("X-Maintenance-Mode", "true");
  if (state.endsAt) res.setHeader("X-Maintenance-Ends-At", state.endsAt);

  if (READ_ONLY_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }
  // Admin writes pass so admins can clear the toggle from the UI.
  if (isAdminApiPath(req.path)) {
    next();
    return;
  }
  // Structured body so the frontend can pattern-match on `code` (stable) and
  // surface `message` to the user. Status 503 + Retry-After matches what
  // proxies and uptime checkers expect for a planned outage.
  res.setHeader("Retry-After", "60");
  res.status(503).json({
    error: "maintenance",
    code: "maintenance_mode",
    maintenance: true,
    message: state.message,
    endsAt: state.endsAt,
  });
}
