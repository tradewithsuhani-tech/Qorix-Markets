import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Clock, ArrowRight } from "lucide-react";
import { trackCta } from "@/lib/analytics";

export function SupportFab() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="fixed right-3 md:right-5 bottom-3 md:bottom-5 z-40 flex flex-col items-end gap-2"
    >
      {/* Expanded panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Contact support"
          className="pointer-events-auto w-[260px] rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            background: "rgba(5,8,20,0.96)",
            border: "1px solid rgba(16,185,129,0.32)",
            boxShadow:
              "0 24px 60px -20px rgba(16,185,129,0.45), 0 8px 30px -10px rgba(0,0,0,0.7)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Header */}
          <div
            className="px-4 pt-3.5 pb-3 flex items-start gap-2.5 border-b"
            style={{
              background:
                "linear-gradient(120deg, rgba(16,185,129,0.18), rgba(34,197,94,0.08))",
              borderColor: "rgba(16,185,129,0.18)",
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Support online
                </span>
              </div>
              <div className="text-sm font-bold text-white mt-1 leading-tight">
                Need help? Chat with us
              </div>
              <div className="flex items-center gap-1 mt-1.5 text-[11px] text-slate-400">
                <Clock size={11} className="text-emerald-400" />
                <span>
                  Avg reply: <span className="text-emerald-300 font-semibold">2 min</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white -mr-1 -mt-1 p-1 rounded-md hover:bg-white/[0.06]"
              aria-label="Close support menu"
            >
              <X size={16} />
            </button>
          </div>

          {/* Single contact channel — WhatsApp/Telegram intentionally
              hidden until handles are confirmed. */}
          <div className="p-2">
            <a
              href="/contact"
              onClick={() => {
                trackCta("Support contact", "fab");
                setOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.05] group"
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                style={{
                  background: "linear-gradient(135deg, #10b981, #22c55e)",
                  boxShadow: "0 8px 20px -6px rgba(16,185,129,0.5)",
                }}
              >
                <MessageCircle size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Open contact</div>
                <div className="text-[11px] text-slate-400">Send a message · we reply fast</div>
              </div>
              <ArrowRight size={14} className="text-emerald-300/70 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>

          <div className="px-4 py-2.5 text-[10px] text-slate-500 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            Mon–Sun · 24/7 · English & हिंदी
          </div>
        </div>
      )}

      {/* Trigger FAB */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) trackCta("Support FAB open", "fab");
        }}
        aria-label={open ? "Close support menu" : "Open support menu — average reply 2 minutes"}
        aria-expanded={open}
        className="pointer-events-auto relative inline-flex items-center gap-2 pl-3 pr-3.5 py-2.5 rounded-full font-bold text-white text-sm shadow-2xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050814]"
        style={{
          background: "linear-gradient(135deg, #10b981, #22c55e)",
          boxShadow:
            "0 18px 40px -10px rgba(16,185,129,0.55), 0 6px 16px -8px rgba(0,0,0,0.6)",
          minHeight: 44,
        }}
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
        {!open && (
          <>
            <span className="hidden sm:inline">Support</span>
            <span
              className="hidden sm:inline-flex items-center gap-1 ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(4px)",
              }}
            >
              <Clock size={9} /> 2 min
            </span>
          </>
        )}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3" aria-hidden>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300 ring-2 ring-[#050814]" />
          </span>
        )}
      </button>
    </div>
  );
}
