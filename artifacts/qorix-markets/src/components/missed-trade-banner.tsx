import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { AlertTriangle, TrendingUp, Zap, ArrowRight, X } from "lucide-react";

const PAIRS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "ARB/USDT", "AVAX/USDT"];

interface MissedTrade {
  pair: string;
  pct: number;
  minsAgo: number;
  key: number;
}

function pickTrade(): MissedTrade {
  const pair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const pct = +(0.8 + Math.random() * 3.4).toFixed(2);
  const minsAgo = Math.floor(Math.random() * 8) + 1;
  return { pair, pct, minsAgo, key: Date.now() };
}

/**
 * FOMO banner shown on the main dashboard (not a popup).
 * Rotates every ~25s with a missed-trade alert encouraging users to top up.
 * Can be dismissed — stays hidden for 30 minutes via sessionStorage.
 */
export function MissedTradeBanner() {
  const [trade, setTrade] = useState<MissedTrade>(() => pickTrade());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const until = Number(sessionStorage.getItem("missedTradeBannerHideUntil") ?? 0);
    return until > Date.now();
  });

  useEffect(() => {
    if (dismissed) return;
    const id = setInterval(() => setTrade(pickTrade()), 25000);
    return () => clearInterval(id);
  }, [dismissed]);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(
        "missedTradeBannerHideUntil",
        String(Date.now() + 30 * 60 * 1000),
      );
    } catch {}
    setDismissed(true);
  };

  const potentialEarn = useMemo(() => (1000 * trade.pct) / 100, [trade]);

  if (dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-amber-400/35 bg-gradient-to-r from-[#1a0f05] via-[#1d1408] to-[#140a04] shadow-[0_10px_30px_-12px_rgba(245,158,11,0.35),0_1px_0_rgba(255,255,255,0.05)_inset]"
    >
      {/* Animated top accent */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
      {/* Glow orbs */}
      <div className="absolute -top-16 -left-10 w-48 h-48 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -right-10 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="relative px-4 sm:px-5 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Icon */}
        <div className="shrink-0 flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-400/40 blur-xl rounded-full animate-pulse" />
            <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400/25 to-orange-500/20 border border-amber-300/50 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <AlertTriangle className="w-6 h-6 text-amber-300" strokeWidth={2} />
            </div>
          </div>
          <span className="sm:hidden text-[10px] font-extrabold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
            Trade Missed
          </span>
        </div>

        {/* Message */}
        <div className="min-w-0 flex-1">
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-1.5">
            <Zap className="w-3 h-3" /> Trade Detected
          </div>
          <AnimatePresence mode="wait">
            <motion.p
              key={trade.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-sm md:text-[15px] font-semibold text-white leading-snug"
            >
              You missed a{" "}
              <span className="inline-flex items-center gap-1 text-emerald-300 font-bold tabular-nums">
                <TrendingUp className="w-3.5 h-3.5" />
                +{trade.pct}%
              </span>{" "}
              signal on <span className="text-amber-200 font-bold">{trade.pair}</span>{" "}
              <span className="text-white/50 font-normal">· {trade.minsAgo}m ago</span>
            </motion.p>
          </AnimatePresence>
          <p className="mt-1 text-xs md:text-[13px] text-white/65 leading-snug">
            Don't worry — top up now and grab the{" "}
            <span className="text-amber-300 font-semibold">next potential trade</span>. A $1,000 fund
            would have earned{" "}
            <span className="text-emerald-300 font-bold tabular-nums">
              +${potentialEarn.toFixed(2)}
            </span>
            .
          </p>
        </div>

        {/* CTA */}
        <div className="shrink-0 flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/deposit"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-sm font-bold shadow-lg shadow-amber-500/30 transition-all"
          >
            Top Up Now
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
