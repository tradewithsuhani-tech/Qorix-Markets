import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Megaphone, ExternalLink } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const STORAGE_KEY = "qorix_popup_dismissed";

type PopupData = {
  active: boolean;
  mode?: "once" | "always";
  title?: string;
  message?: string;
  buttonText?: string;
  redirectLink?: string;
  version?: string;
};

export function AdminPopup() {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    authFetch<PopupData>(`${BASE_URL}/api/popup`)
      .then((data) => {
        if (!data?.active) return;
        if (data.mode === "once") {
          const dismissed = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
          if (dismissed === data.version) return; // already dismissed this version
        }
        setPopup(data);
        setOpen(true);
      })
      .catch(() => {});
  }, []);

  function handleClose() {
    if (popup?.mode === "once" && popup.version) {
      try { localStorage.setItem(STORAGE_KEY, popup.version); } catch {}
    }
    setOpen(false);
  }

  function handleAction() {
    if (popup?.redirectLink) {
      window.open(popup.redirectLink, "_blank", "noopener,noreferrer");
    }
    handleClose();
  }

  if (!popup) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-blue-500/30 bg-gradient-to-br from-[#0d1117] via-[#0d1117] to-blue-950/40 shadow-2xl shadow-blue-500/10 overflow-hidden"
          >
            <button
              onClick={handleClose}
              className="absolute right-3 top-3 p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition-all z-10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-6 pt-7 pb-6 space-y-4">
              <div className="flex items-center justify-center">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.05 }}
                  className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center"
                >
                  <Megaphone className="w-7 h-7 text-blue-400" />
                </motion.div>
              </div>

              {popup.title && (
                <h2 className="text-lg font-bold text-white text-center leading-snug">
                  {popup.title}
                </h2>
              )}

              {popup.message && (
                <p className="text-sm text-muted-foreground text-center leading-relaxed whitespace-pre-line">
                  {popup.message}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-2">
                {popup.redirectLink ? (
                  <button
                    onClick={handleAction}
                    className="btn btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {popup.buttonText || "Learn more"}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="btn btn-primary w-full"
                  >
                    {popup.buttonText || "Got it"}
                  </button>
                )}
                {popup.redirectLink && popup.mode === "once" && (
                  <button
                    onClick={handleClose}
                    className="text-xs text-muted-foreground hover:text-white transition-colors py-1"
                  >
                    Don't show again
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
