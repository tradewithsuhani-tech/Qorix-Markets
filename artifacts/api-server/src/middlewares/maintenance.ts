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
  if (READ_ONLY_METHODS.has(req.method.toUpperCase())) {
    // Surface the marker on read responses too so the web app can flip its
    // banner on without waiting for a write to fail. It's a header (not a body
    // field) to avoid touching every JSON serializer.
    res.setHeader("X-Maintenance-Mode", "true");
    next();
    return;
  }
  // Structured body so the frontend can pattern-match on `code` (stable) and
  // surface `message` to the user. Status 503 + Retry-After matches what
  // proxies and uptime checkers expect for a planned outage.
  res.setHeader("Retry-After", "60");
  res.setHeader("X-Maintenance-Mode", "true");
  res.status(503).json({
    error: "maintenance",
    code: "maintenance_mode",
    maintenance: true,
    message:
      process.env["MAINTENANCE_MESSAGE"] ||
      "Brief maintenance in progress — balances will be back shortly.",
  });
}
