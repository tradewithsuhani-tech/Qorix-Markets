import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Clock } from "lucide-react";
import { trackCta } from "@/lib/analytics";

const WHATSAPP_URL = "https://wa.me/919999999999?text=Hi%20Qorix%20Markets%2C%20I%20need%20help";
const TELEGRAM_URL = "https://t.me/Qorixmarketsalerts";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function TelegramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

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

          {/* Channels */}
          <div className="p-2 flex flex-col gap-1.5">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackCta("Support WhatsApp", "fab");
                setOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.05] group"
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                style={{
                  background: "linear-gradient(135deg, #25D366, #128C7E)",
                  boxShadow: "0 8px 20px -6px rgba(37,211,102,0.5)",
                }}
              >
                <WhatsAppIcon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">WhatsApp</div>
                <div className="text-[11px] text-slate-400">Fastest · usually instant</div>
              </div>
            </a>

            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackCta("Support Telegram", "fab");
                setOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-white/[0.05] group"
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white"
                style={{
                  background: "linear-gradient(135deg, #29B6F6, #0277BD)",
                  boxShadow: "0 8px 20px -6px rgba(41,182,246,0.5)",
                }}
              >
                <TelegramIcon size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white">Telegram</div>
                <div className="text-[11px] text-slate-400">Alerts + live support</div>
              </div>
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
