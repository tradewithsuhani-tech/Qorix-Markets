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

type Listener = () => void;

const DEFAULT_MESSAGE = "Brief maintenance in progress — balances will be back shortly.";

let _active = false;
let _message = DEFAULT_MESSAGE;
let _listeners = new Set<Listener>();
let _pollTimer: ReturnType<typeof setInterval> | null = null;

// `useSyncExternalStore` compares the snapshot reference with `Object.is`.
// We MUST return a stable object reference between mutations or React will
// think state has changed on every render and loop forever. Update the
// cached snapshot only inside `emit()` (i.e. when something actually changes).
let _snapshot: { active: boolean; message: string } = {
  active: _active,
  message: _message,
};

function emit() {
  _snapshot = { active: _active, message: _message };
  for (const l of _listeners) l();
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
        clearMaintenance();
      } else if (typeof d.maintenanceMessage === "string" && d.maintenanceMessage) {
        if (d.maintenanceMessage !== _message) {
          _message = d.maintenanceMessage;
          emit();
        }
      }
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

export function notifyMaintenance(message?: string): void {
  const next = message && message.trim() ? message : DEFAULT_MESSAGE;
  if (_active && next === _message) return;
  _active = true;
  _message = next;
  startPolling();
  emit();
}

export function clearMaintenance(): void {
  if (!_active) return;
  _active = false;
  _message = DEFAULT_MESSAGE;
  stopPolling();
  emit();
}

export function getMaintenanceState(): { active: boolean; message: string } {
  return _snapshot;
}

export function subscribeMaintenance(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
