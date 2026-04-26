import { useEffect, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench } from "lucide-react";
import {
  getMaintenanceState,
  subscribeMaintenance,
} from "@/lib/maintenance-state";

/**
 * Sticky inline banner that appears whenever the API responds with the
 * MAINTENANCE_MODE marker (header `X-Maintenance-Mode: true` or 503 body
 * `{ code: "maintenance_mode" }`). Replaces the wall of generic toast errors
 * users used to see during the Mumbai-DB cutover when the API was scaled to
 * zero machines.
 *
 * When the API also exposes an ETA (MAINTENANCE_ETA env var or
 * `maintenance_ends_at` admin setting), the banner shows a live "Back in ~Xm"
 * countdown that ticks once a second. The countdown alone never clears the
 * banner — that only happens when `/api/system/status` reports
 * `writesDisabled: false`, so an over-running cutover keeps the banner up
 * (with a "Wrapping up…" message) instead of silently lying to users.
 *
 * Stays mounted globally; the banner clears itself via the maintenance store
 * once the API confirms maintenance is over.
 */

function formatRemaining(msRemaining: number): string {
  if (msRemaining <= 0) return "";
  const totalSeconds = Math.ceil(msRemaining / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return remMinutes === 0 ? `${hours}h` : `${hours}h ${remMinutes}m`;
}

function useCountdown(endsAt: string | null, active: boolean): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Only burn a 1s timer when there is something to count down to. The
    // banner stays mounted globally, so without this guard we'd tick every
    // second of the user's session in the (overwhelmingly common) no-
    // maintenance state.
    if (!active || !endsAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, endsAt]);

  if (!active || !endsAt) return null;
  const target = Date.parse(endsAt);
  if (Number.isNaN(target)) return null;
  const remaining = target - now;
  if (remaining <= 0) {
    // ETA elapsed but the API hasn't confirmed the window is over yet.
    // Hold the banner with a softer "wrapping up" status until the next
    // status poll either clears it or extends the ETA.
    return "wrapping_up";
  }
  return formatRemaining(remaining);
}

export function MaintenanceBanner() {
  const state = useSyncExternalStore(
    subscribeMaintenance,
    getMaintenanceState,
    getMaintenanceState,
  );
  const countdown = useCountdown(state.endsAt, state.active);

  const headline =
    countdown === "wrapping_up"
      ? "Wrapping up maintenance…"
      : countdown
        ? `Back in ~${countdown}`
        : "Brief maintenance in progress";

  return (
    <AnimatePresence>
      {state.active && (
        <motion.div
          key="maintenance-banner"
          initial={{ y: -64, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -64, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed inset-x-0 top-[max(env(safe-area-inset-top),0px)] z-[110] px-3 pt-2 pointer-events-none"
          data-testid="banner-maintenance-mode"
        >
          <div className="mx-auto max-w-2xl pointer-events-auto">
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-slate-900/95 to-slate-950/95 backdrop-blur-xl px-4 py-3 shadow-[0_18px_40px_-12px_rgba(251,191,36,0.45),0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/40">
                <Wrench className="w-4 h-4 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-[13px] font-bold text-white leading-tight"
                  data-testid="text-maintenance-headline"
                >
                  {headline}
                </div>
                <div className="text-[11px] text-slate-300/80 leading-snug mt-0.5">
                  {state.message}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
