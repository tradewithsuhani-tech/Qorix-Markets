import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

const NAMES = [
  "Rahul S.", "Priya M.", "Arjun K.", "Vikram J.", "Anjali R.",
  "Karthik P.", "Sneha T.", "Rohan G.", "Aditya V.", "Neha B.",
  "Kabir N.", "Ishaan D.", "Meera L.", "Riya S.", "Aryan H.",
  "Aman C.", "Tara M.", "Dev R.", "Pooja K.", "Siddharth A.",
];

type ActivityKind = "withdraw" | "deposit";
interface ActivityItem {
  kind: ActivityKind;
  name: string;
  amount: number;
  ago: string;
  key: number;
}

function pickAmount(kind: ActivityKind): number {
  if (kind === "withdraw") {
    // Skew toward larger withdrawal amounts to build payout-trust signal.
    const r = Math.random();
    if (r < 0.55) return Math.floor(180 + Math.random() * 1820);   // $180–2000
    if (r < 0.85) return Math.floor(2100 + Math.random() * 5900);  // $2100–8000
    return Math.floor(8200 + Math.random() * 9800);                // $8200–18000
  }
  const r = Math.random();
  if (r < 0.6) return Math.floor(120 + Math.random() * 880);
  if (r < 0.9) return Math.floor(1000 + Math.random() * 4000);
  return Math.floor(5500 + Math.random() * 9500);
}

function pickAgo(): string {
  const minutes = Math.floor(Math.random() * 9) + 1;
  return Math.random() < 0.35 ? `${Math.floor(Math.random() * 55) + 5}s ago` : `${minutes}m ago`;
}

/**
 * Sitewide social-proof toaster shown in the bottom-left corner on every page.
 * Rotates simulated withdrawal + deposit events every 22–40 seconds to build
 * payout trust ("real users are getting paid right now") without depending on
 * a backend feed. Skewed toward withdrawals because that's the biggest fintech
 * trust objection users have.
 */
export function SiteActivityToaster() {
  const [item, setItem] = useState<ActivityItem | null>(null);

  useEffect(() => {
    let mounted = true;
    let showT: ReturnType<typeof setTimeout>;
    let hideT: ReturnType<typeof setTimeout>;

    const cycle = () => {
      if (!mounted) return;
      const kind: ActivityKind = Math.random() < 0.62 ? "withdraw" : "deposit";
      const next: ActivityItem = {
        kind,
        name: NAMES[Math.floor(Math.random() * NAMES.length)],
        amount: pickAmount(kind),
        ago: pickAgo(),
        key: Date.now(),
      };
      setItem(next);
      hideT = setTimeout(() => {
        if (!mounted) return;
        setItem(null);
        showT = setTimeout(cycle, 22000 + Math.random() * 18000);
      }, 6500);
    };

    showT = setTimeout(cycle, 8000);
    return () => {
      mounted = false;
      clearTimeout(showT);
      clearTimeout(hideT);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] hidden sm:block max-w-[320px]">
      <AnimatePresence>
        {item && (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: -32, scale: 0.94 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.94 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-white/10 bg-slate-950/90 backdrop-blur-xl shadow-[0_12px_32px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
          >
            <div
              className={
                "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border " +
                (item.kind === "withdraw"
                  ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-300"
                  : "bg-blue-500/15 border-blue-400/35 text-blue-300")
              }
            >
              {item.kind === "withdraw" ? (
                <ArrowUpFromLine className="w-4 h-4" />
              ) : (
                <ArrowDownToLine className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-white leading-tight truncate">
                <span className="text-white/85">{item.name}</span>{" "}
                {item.kind === "withdraw" ? "withdrew" : "deposited"}{" "}
                <span
                  className={
                    "font-bold tabular-nums " +
                    (item.kind === "withdraw" ? "text-emerald-400" : "text-blue-300")
                  }
                >
                  ${item.amount.toLocaleString()}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/45">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {item.kind === "withdraw" ? "TRC20 payout" : "USDT deposit"} · {item.ago}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
