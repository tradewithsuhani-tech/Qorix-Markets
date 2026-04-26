import { useSyncExternalStore } from "react";
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
 * Stays mounted globally; the banner clears itself via the maintenance store
 * once `/api/system/status` reports `writesDisabled: false` again.
 */
export function MaintenanceBanner() {
  const state = useSyncExternalStore(
    subscribeMaintenance,
    getMaintenanceState,
    getMaintenanceState,
  );

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
                <div className="text-[13px] font-bold text-white leading-tight">
                  Brief maintenance in progress
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
