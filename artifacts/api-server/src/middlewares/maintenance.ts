import type { Request, Response, NextFunction } from "express";
import { db, pool, systemSettingsTable, createListenClient } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { errorLogger, logger } from "../lib/logger";

// Derive the LISTEN client type from the factory rather than importing `pg`
// directly — `pg` is a transitive dependency of @workspace/db and not a
// direct dependency of api-server, so a direct `import type { Client } from
// "pg"` here would break tsc resolution in this package.
type ListenClient = ReturnType<typeof createListenClient>;

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
// The admin POST /admin/settings handler calls notifyMaintenanceInvalidation()
// the moment the operator flips the toggle, which (a) drops THIS instance's
// cache locally and (b) broadcasts a Postgres NOTIFY on the
// `maintenance_invalidate` channel that every other API instance receives via
// startMaintenanceInvalidationListener(). End-to-end the user-facing latency
// on flipping the toggle is bounded by one Postgres round-trip (~tens of ms),
// not the per-instance TTL — so a multi-instance Fly deploy stops serving the
// stale state within a second instead of up to 5.
let cached: { state: MaintenanceState; at: number } | null = null;
const CACHE_TTL_MS = 5_000;

// Channel name used for cross-instance cache invalidation. Constant — never
// interpolate user input into the LISTEN/NOTIFY identifier.
const MAINTENANCE_NOTIFY_CHANNEL = "maintenance_invalidate";

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

// Test-only: returns the backend PID of the live LISTEN connection (or null
// if the listener isn't currently connected). Used by the reconnect
// regression test to forcibly terminate the LISTEN backend via
// pg_terminate_backend() and assert that connectListener() re-establishes
// the subscription. Not used by production callers — `pg_stat_activity` is
// the right tool for ops introspection. Exported here because in the test
// environment `track_activities` is off, so the PID isn't surface-able from
// SQL alone.
export function __getListenerProcessIdForTest(): number | null {
  // pg.Client exposes the backend PID as `processID` after connect(). It's
  // typed as `number | null` on the runtime object but isn't always present
  // on the @types/pg surface — narrow defensively.
  const c = listenerClient as unknown as { processID?: number | null } | null;
  return c?.processID ?? null;
}

// Fan-out cache invalidation across every running API instance.
//
// Called from POST /admin/settings the moment an admin flips a maintenance
// row. We do TWO things:
//   1. Drop this process's cache immediately so the operator's *next*
//      request to the same instance reflects the new state with zero RTT
//      (don't wait on Postgres NOTIFY round-trip for the user driving the
//      toggle).
//   2. Issue `NOTIFY maintenance_invalidate` on the shared pool. Every other
//      API instance has a long-lived LISTEN on the same channel
//      (startMaintenanceInvalidationListener) and drops its own cache as
//      soon as the notification arrives — typically tens of milliseconds.
//
// NOTIFY failure is logged but never thrown to the caller: the local cache
// is already cleared, and any peer that misses the notification will
// reconcile within CACHE_TTL_MS via the existing TTL fallback. We'd rather
// admins keep being able to flip the toggle than fail their write because
// LISTEN/NOTIFY is temporarily unavailable.
export async function notifyMaintenanceInvalidation(): Promise<void> {
  invalidateMaintenanceCache();
  try {
    await pool.query(`NOTIFY ${MAINTENANCE_NOTIFY_CHANNEL}`);
  } catch (err) {
    errorLogger.error(
      { err, channel: MAINTENANCE_NOTIFY_CHANNEL },
      "Failed to broadcast maintenance cache invalidation NOTIFY — peer instances will reconcile via TTL fallback",
    );
  }
}

// Long-lived LISTEN connection state. Held outside the function so the
// reconnect loop and the stop handle can see the same client.
let listenerClient: ListenClient | null = null;
let listenerStopped = false;
let reconnectTimer: NodeJS.Timeout | null = null;
const RECONNECT_DELAY_MS = 1_000;

// Health-of-the-fan-out telemetry. Updated only on a *successful*
// connectListener() and read by the structured "reconnected" log so ops
// can chart bounce rate (count) and inter-bounce gap (last successful
// connect timestamp) without parsing raw stack traces. We deliberately
// don't surface these via a metrics endpoint — the api-server has no
// metrics surface today and pino-on-Fly is what on-call already greps.
let lastConnectedAt: number | null = null;
let reconnectCount = 0;

// Start a dedicated Postgres connection that LISTENs on
// `maintenance_invalidate` and drops the local cache on every notification.
// Designed to be called once at process boot from index.ts. Returns a stop
// function used by graceful shutdown to release the connection cleanly.
//
// On connection loss the listener auto-reconnects every RECONNECT_DELAY_MS
// until either it succeeds or stop() is called. We never throw out of the
// retry loop because the cache TTL fallback already provides eventual
// consistency; a hard failure would be worse than a temporary pause in
// cross-instance fan-out.
export async function startMaintenanceInvalidationListener(): Promise<
  () => Promise<void>
> {
  listenerStopped = false;
  await connectListener();
  return async () => {
    listenerStopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    const c = listenerClient;
    listenerClient = null;
    // Reset the bounce telemetry so a subsequent
    // startMaintenanceInvalidationListener() (e.g. an integration test
    // that stops + restarts the listener within one process) treats its
    // first successful dial as a fresh "active" log, not as a misleading
    // "reconnected" line attributed to the previous lifecycle.
    lastConnectedAt = null;
    reconnectCount = 0;
    if (c) {
      try {
        await c.end();
      } catch {
        // best-effort close on shutdown
      }
    }
  };
}

async function connectListener(): Promise<void> {
  if (listenerStopped) return;
  let client: ListenClient | null = null;
  try {
    client = createListenClient();
    client.on("error", (err: Error) => {
      errorLogger.error(
        { err, channel: MAINTENANCE_NOTIFY_CHANNEL },
        "Maintenance LISTEN connection errored — scheduling reconnect",
      );
      scheduleReconnect();
    });
    client.on("end", () => {
      if (!listenerStopped) scheduleReconnect();
    });
    client.on("notification", (msg: { channel: string }) => {
      if (msg.channel === MAINTENANCE_NOTIFY_CHANNEL) {
        invalidateMaintenanceCache();
      }
    });
    await client.connect();
    await client.query(`LISTEN ${MAINTENANCE_NOTIFY_CHANNEL}`);
    listenerClient = client;
    // pg.Client exposes the backend PID as `processID` after connect(); it's
    // typed as `number | null` on the runtime object but isn't always present
    // on the @types/pg surface. Narrow defensively so the structured log
    // never crashes the listener if the field shape changes. We log it as
    // `backendPid` rather than `pid` because pino auto-injects the OS
    // process ID under the top-level key `pid` — using the same name would
    // silently lose the Postgres backend PID we actually want to chart.
    const backendPid =
      (client as unknown as { processID?: number | null }).processID ?? null;
    const now = Date.now();
    if (lastConnectedAt === null) {
      // First connect of this process — emit the existing startup line so the
      // boot-time log shape doesn't change for log-based smoke tests.
      logger.info(
        { channel: MAINTENANCE_NOTIFY_CHANNEL, backendPid },
        "Maintenance cache invalidation listener active",
      );
    } else {
      // A reconnect succeeded. Emit a structured info log carrying the new
      // backend PID and the gap since the previous successful connect so
      // ops can chart bounce rate (count of these lines per hour) and
      // inter-bounce duration without parsing the preceding error log. The
      // counter is cumulative since process start; restarts reset it,
      // which matches Fly's per-machine log lifetime anyway.
      reconnectCount += 1;
      logger.info(
        {
          channel: MAINTENANCE_NOTIFY_CHANNEL,
          backendPid,
          msSinceLastConnect: now - lastConnectedAt,
          reconnectCount,
        },
        "Maintenance LISTEN reconnected",
      );
    }
    lastConnectedAt = now;
  } catch (err) {
    errorLogger.error(
      { err, channel: MAINTENANCE_NOTIFY_CHANNEL },
      "Failed to start maintenance LISTEN — will retry",
    );
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore: connect failure path
      }
    }
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (listenerStopped || reconnectTimer) return;
  if (listenerClient) {
    const c = listenerClient;
    listenerClient = null;
    c.end().catch(() => {
      // best-effort: client already in error state
    });
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectListener();
  }, RECONNECT_DELAY_MS);
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

// Boot-time gate for cron / Telegram poller / on-chain watchers / BullMQ
// workers. Maintenance mode (env var OR admin-toggled DB flag) forces these
// off so a single freeze freezes writes from every path (HTTP + cron +
// workers). Also honoured: explicit RUN_BACKGROUND_JOBS=false on a per-
// instance basis (e.g. Replit dev once Fly is the source of truth). Pure
// function so the test suite can verify the gating without booting the
// full process.
export function shouldRunBackgroundJobs(maintenance: MaintenanceState): boolean {
  if (maintenance.active) return false;
  return (process.env["RUN_BACKGROUND_JOBS"] ?? "true").toLowerCase() !== "false";
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
