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

// Verify-before-show guard. The bare X-Maintenance-Mode header / 503-with-
// maintenance_mode body can show up spuriously (CDN/proxy holding a stale
// response, Service-Worker replay, an old tab from a real cutover, etc.).
// When that happens the polling loop *would* clear the banner after 15s, but
// the next stale response would re-trigger immediately, producing the
// "popup keeps coming back" bug we hit in dev. Before we actually flip the
// banner on, do a one-shot verification against /api/system/status — the
// authoritative source of truth — and only show the banner if that endpoint
// agrees writes are frozen. Cheap (single GET, ~1ms locally) and defends
// against every false-positive path without changing the legit cutover UX:
// during a real freeze /api/system/status reports writesDisabled:true and the
// banner shows on the very first verification.
let _verifyInFlight = false;
let _lastVerifyAt = 0;
let _lastVerifySaidClean = false;
const VERIFY_TTL_MS = 5_000;

async function verifyAndApply(message: string, endsAt: string | null): Promise<void> {
  if (typeof window === "undefined") return;
  if (_verifyInFlight) return;
  // Symmetric dedup: trust ANY verify result (clean or active) for VERIFY_TTL_MS
  // so a burst of stale-marker responses can't spam /api/system/status, but a
  // legitimate server-state transition still gets re-checked within 5s instead
  // of waiting for the 15s polling loop.
  if (Date.now() - _lastVerifyAt < VERIFY_TTL_MS) {
    // Last verify said no maintenance: clear if a stale signal flipped us on.
    if (_lastVerifySaidClean && _active) clearMaintenance();
    return;
  }
  _verifyInFlight = true;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}api/system/status`);
    if (!r.ok) return;
    const d = await r.json();
    _lastVerifyAt = Date.now();
    if (!d.writesDisabled) {
      // Authoritative source says writes are NOT frozen — refuse to show the
      // banner (and clear it if it was already up from a previous false signal).
      _lastVerifySaidClean = true;
      if (_active) clearMaintenance();
      return;
    }
    _lastVerifySaidClean = false;
    // Server confirms maintenance. Prefer the server-side message/ETA over the
    // values we got from the triggering response — the status endpoint is
    // always the freshest copy.
    const serverMessage =
      typeof d.maintenanceMessage === "string" && d.maintenanceMessage.trim()
        ? d.maintenanceMessage
        : message;
    const serverEndsAt = normalizeEndsAt(d.maintenanceEndsAt) ?? endsAt;
    if (_active && serverMessage === _message && serverEndsAt === _endsAt) return;
    _active = true;
    _message = serverMessage;
    _endsAt = serverEndsAt;
    startPolling();
    emit();
  } catch {
    // Network blip — don't show the banner on speculative signal alone.
    // The next legitimate trigger will retry the verify.
  } finally {
    _verifyInFlight = false;
  }
}

export function notifyMaintenance(message?: string, endsAt?: string): void {
  const nextMessage = message && message.trim() ? message : DEFAULT_MESSAGE;
  const nextEndsAt = normalizeEndsAt(endsAt);
  // Always route through verifyAndApply — its TTL-based dedup handles the
  // "burst of identical stale signals" case without an early-return that
  // could otherwise pin a stale banner up until the 15s polling tick.
  void verifyAndApply(nextMessage, nextEndsAt);
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
