import type { Request, Response, NextFunction } from "express";

// Read-only "maintenance mode" gate used during the Mumbai-DB cutover (and any
// future planned-write freeze). Flipped via the Fly secret MAINTENANCE_MODE so
// we can enable/disable it without a code deploy:
//
//     fly secrets set   MAINTENANCE_MODE=true  --app qorix-api   # freeze writes
//     fly secrets unset MAINTENANCE_MODE       --app qorix-api   # resume
//
// When ON the API stays up and keeps serving GETs (so balances/charts/signals
// still render), but every write (POST/PUT/PATCH/DELETE) returns a structured
// 503 the frontend can recognise and surface as an inline "Brief maintenance"
// banner — instead of the raw 503 the old `fly scale count 0` cutover step
// produced. Background jobs (cron, Telegram poller, BullMQ workers) are gated
// separately in `index.ts` on the same env var.
export function isMaintenanceMode(): boolean {
  return (process.env["MAINTENANCE_MODE"] ?? "").toLowerCase() === "true";
}

// Optional ETA the operator can attach to a maintenance window via the Fly
// secret MAINTENANCE_ETA (ISO-8601 timestamp, e.g. 2026-04-26T18:00:00Z).
// When set we surface it on /system/status and on the X-Maintenance-Ends-At
// header so the web app can render a live "Back in ~Xm" countdown instead of
// a generic message.
//
// Returns the ISO string when MAINTENANCE_ETA is a parseable timestamp, else
// null. We deliberately do NOT clear MAINTENANCE_MODE just because the ETA
// has passed — the source of truth for "are writes back?" is still the
// MAINTENANCE_MODE secret, and an over-running cutover should keep the banner
// up rather than silently lie to users.
export function getMaintenanceEndsAt(): string | null {
  const raw = process.env["MAINTENANCE_ETA"];
  if (!raw || !raw.trim()) return null;
  const ts = Date.parse(raw.trim());
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

// Methods that must be blocked while writes are frozen. HEAD/OPTIONS are
// metadata-only so they pass through alongside GET. Anything that mutates the
// DB — including custom verbs we might add later — gets caught by the default
// branch below.
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isMaintenanceMode()) {
    next();
    return;
  }
  const endsAt = getMaintenanceEndsAt();
  if (READ_ONLY_METHODS.has(req.method.toUpperCase())) {
    // Surface the marker on read responses too so the web app can flip its
    // banner on without waiting for a write to fail. It's a header (not a body
    // field) to avoid touching every JSON serializer.
    res.setHeader("X-Maintenance-Mode", "true");
    if (endsAt) res.setHeader("X-Maintenance-Ends-At", endsAt);
    next();
    return;
  }
  // Structured body so the frontend can pattern-match on `code` (stable) and
  // surface `message` to the user. Status 503 + Retry-After matches what
  // proxies and uptime checkers expect for a planned outage.
  res.setHeader("Retry-After", "60");
  res.setHeader("X-Maintenance-Mode", "true");
  if (endsAt) res.setHeader("X-Maintenance-Ends-At", endsAt);
  res.status(503).json({
    error: "maintenance",
    code: "maintenance_mode",
    maintenance: true,
    message:
      process.env["MAINTENANCE_MESSAGE"] ||
      "Brief maintenance in progress — balances will be back shortly.",
    endsAt,
  });
}
