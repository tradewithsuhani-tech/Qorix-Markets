import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { useVersionCheck } from "@/lib/version-check";

/**
 * Floating banner that appears at the bottom of the screen when a newer build
 * has been deployed than the one the user is currently running. Tapping
 * "Update" clears caches, unregisters the (now-stale) service worker, and
 * forces a hard reload so the latest bundle is fetched from the network.
 *
 * Mounted globally in App.tsx; renders nothing in dev builds.
 */
export function UpdateBanner() {
  const { updateAvailable, reload } = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);
  const [reloading, setReloading] = useState(false);

  const visible = updateAvailable && !dismissed;

  const handleUpdate = async () => {
    setReloading(true);
    await reload();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),16px)] z-[120] px-3 sm:px-4 pointer-events-none"
          data-testid="banner-update-available"
        >
          <div className="mx-auto max-w-md pointer-events-auto">
            <div className="relative flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-slate-900/95 to-slate-950/95 backdrop-blur-xl p-3 shadow-[0_18px_40px_-12px_rgba(16,185,129,0.45),0_0_0_1px_rgba(255,255,255,0.04)]">
              <div className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/40">
                <Sparkles className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-white leading-tight">
                  New version available
                </div>
                <div className="text-[11px] text-slate-300/80 leading-snug truncate">
                  Refresh karke latest features unlock karo
                </div>
              </div>
              <button
                onClick={handleUpdate}
                disabled={reloading}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 shadow-[0_4px_14px_-4px_rgba(16,185,129,0.7)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 transition-all whitespace-nowrap"
                data-testid="button-update-app"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${reloading ? "animate-spin" : ""}`}
                />
                {reloading ? "Updating…" : "Update"}
              </button>
              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss update notice"
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                data-testid="button-dismiss-update"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
