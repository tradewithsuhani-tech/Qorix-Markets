import { MessageCircle, Clock } from "lucide-react";
import { trackCta } from "@/lib/analytics";

export function SupportFab() {
  const openChat = () => {
    trackCta("Support FAB open", "fab");
    const w = window as unknown as { qorixOpenSupport?: () => void };
    if (typeof w.qorixOpenSupport === "function") {
      w.qorixOpenSupport();
    } else {
      window.dispatchEvent(new CustomEvent("qorix:open-support"));
    }
  };

  return (
    <div className="fixed right-3 md:right-5 bottom-3 md:bottom-5 z-40">
      <button
        type="button"
        onClick={openChat}
        aria-label="Open support chat — average reply 2 minutes"
        className="pointer-events-auto relative inline-flex items-center gap-2 pl-3 pr-3.5 py-2.5 rounded-full font-bold text-white text-sm shadow-2xl transition-transform hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050814]"
        style={{
          background: "linear-gradient(135deg, #10b981, #22c55e)",
          boxShadow:
            "0 18px 40px -10px rgba(16,185,129,0.55), 0 6px 16px -8px rgba(0,0,0,0.6)",
          minHeight: 44,
        }}
      >
        <MessageCircle size={18} />
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
        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3" aria-hidden>
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-80" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300 ring-2 ring-[#050814]" />
        </span>
      </button>
    </div>
  );
}
