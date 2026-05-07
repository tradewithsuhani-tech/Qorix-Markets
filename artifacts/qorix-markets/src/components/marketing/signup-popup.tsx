import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, X, Sparkles } from "lucide-react";
import { trackCta, trackEvent } from "@/lib/analytics";
import { withRef } from "@/lib/referral";

const STORAGE_KEY = "qx_signup_popup_seen";
const DELAY_MS = 25_000;

/**
 * One-shot signup invite popup. Fires after `DELAY_MS` of dwell time on
 * any marketing page, persists a "seen" flag in localStorage so it never
 * re-opens, and exits cleanly on dismiss or CTA click.
 */
export function SignupPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* incognito — show once per session */
    }
    const t = window.setTimeout(() => {
      setOpen(true);
      trackEvent("signup_popup_shown");
    }, DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={dismiss}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-3xl p-6 md:p-7 text-center"
        style={{
          background: "linear-gradient(180deg, #0b1226, #060914)",
          border: "1px solid rgba(139,92,246,0.30)",
          boxShadow: "0 24px 60px -10px rgba(0,0,0,0.6)",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06]"
          aria-label="Close popup"
        >
          <X size={16} />
        </button>

        <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.30)" }}>
          <Sparkles size={20} className="text-violet-300" />
        </div>

        <h2 className="text-xl font-black text-white mb-2">Start with just $10</h2>
        <p className="text-sm text-slate-400 mb-5 leading-relaxed">
          Join 12,000+ investors letting our AI desk grow capital on autopilot.
          Zero fees. Withdraw anytime in USDT.
        </p>

        <Link
          href={withRef("/signup")}
          onClick={() => {
            trackCta("Create free account", "signup_popup");
            dismiss();
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: "linear-gradient(90deg,#8b5cf6,#6366f1)" }}
        >
          Create my free account <ArrowRight size={14} />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 text-xs text-slate-500 hover:text-slate-300"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
