// Tiny external store for the "writes are temporarily frozen" banner.
//
// During the Mumbai-DB cutover the API runs with MAINTENANCE_MODE=true: GETs
// keep working, but every write returns a structured 503 with a JSON body
// containing `code: "maintenance_mode"`. We pick that signal up from two
// places (raw `fetch` in `auth-fetch.ts` and the codegen client's
// `customFetch`), funnel it through `notifyMaintenance()`, and let the
// `<MaintenanceBanner />` component subscribe via `useSyncExternalStore`.
//
// The banner auto-clears once `/api/system/status` reports `writesDisabled:
// false` again, so the cutover end-of-window doesn't leave a stale banner up.
//
// Operators can also attach an ETA (env var MAINTENANCE_ETA or admin setting
// `maintenance_ends_at`). When present it travels in the X-Maintenance-Ends-At
// header / `endsAt` body field, gets stored here as `endsAt`, and powers a
// live "Back in ~Xm" countdown in the banner. The ETA passing on its own does
// NOT clear the banner — only the API confirming `writesDisabled:false` does,
// which means an over-running cutover keeps the banner up rather than telling
// users everything's fine when it isn't.

type Listener = () => void;

const DEFAULT_MESSAGE = "Brief maintenance in progress — balances will be back shortly.";

export type MaintenanceSnapshot = {
  active: boolean;
  message: string;
  endsAt: string | null;
};

let _active = false;
let _message = DEFAULT_MESSAGE;
let _endsAt: string | null = null;
let _listeners = new Set<Listener>();
let _pollTimer: ReturnType<typeof setInterval> | null = null;

// `useSyncExternalStore` compares the snapshot reference with `Object.is`.
// We MUST return a stable object reference between mutations or React will
// think state has changed on every render and loop forever. Update the
// cached snapshot only inside `emit()` (i.e. when something actually changes).
let _snapshot: MaintenanceSnapshot = {
  active: _active,
  message: _message,
  endsAt: _endsAt,
};

function emit() {
  _snapshot = { active: _active, message: _message, endsAt: _endsAt };
  for (const l of _listeners) l();
}

function normalizeEndsAt(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const ts = Date.parse(trimmed);
  if (Number.isNaN(ts)) return null;
  return new Date(ts).toISOString();
}

function startPolling() {
  if (_pollTimer) return;
  if (typeof window === "undefined") return;
  // Poll the public status endpoint every 15s while the banner is up. This is
  // the same endpoint MaintenanceGate already polls, just at a faster cadence
  // because we want the banner to disappear quickly once the cutover ends.
  _pollTimer = setInterval(async () => {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/system/status`);
      if (!r.ok) return;
      const d = await r.json();
      if (!d.writesDisabled) {
        // Source of truth for "is the window over?" is the API, not the ETA.
        // An over-running cutover (ETA elapsed, writes still disabled) keeps
        // the banner up; a clean finish drops it as soon as we hear about it.
        clearMaintenance();
        return;
      }
      let changed = false;
      const nextMessage =
        typeof d.maintenanceMessage === "string" && d.maintenanceMessage
          ? d.maintenanceMessage
          : _message;
      if (nextMessage !== _message) {
        _message = nextMessage;
        changed = true;
      }
      const nextEndsAt = normalizeEndsAt(d.maintenanceEndsAt);
      if (nextEndsAt !== _endsAt) {
        _endsAt = nextEndsAt;
        changed = true;
      }
      if (changed) emit();
    } catch {
      // Network errors during the cutover are expected — keep polling.
    }
  }, 15_000);
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

export function notifyMaintenance(message?: string, endsAt?: string): void {
  const nextMessage = message && message.trim() ? message : DEFAULT_MESSAGE;
  const nextEndsAt = normalizeEndsAt(endsAt);
  if (_active && nextMessage === _message && nextEndsAt === _endsAt) return;
  _active = true;
  _message = nextMessage;
  _endsAt = nextEndsAt;
  startPolling();
  emit();
}

export function clearMaintenance(): void {
  if (!_active) return;
  _active = false;
  _message = DEFAULT_MESSAGE;
  _endsAt = null;
  stopPolling();
  emit();
}

export function getMaintenanceState(): MaintenanceSnapshot {
  return _snapshot;
}

export function subscribeMaintenance(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
