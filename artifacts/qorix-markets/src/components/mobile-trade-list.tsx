import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { PairIcon } from "@/components/pair-icon";
import { findPair, formatPair } from "@/lib/pair-meta";
import { cn } from "@/lib/utils";

export type MobileTrade = {
  id: number;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  profit: number;
  profitPercent: number;
  executedAt: string;
  lot?: number;
};

type Props = {
  trades: MobileTrade[];
  loading?: boolean;
};

function dayBucket(d: Date): { key: string; label: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const d0 = new Date(d);
  d0.setHours(0, 0, 0, 0);

  const fmtDate = d0.toLocaleDateString(undefined, { day: "numeric", month: "long" });

  if (d0.getTime() === today.getTime()) return { key: "today", label: `Today, ${fmtDate}` };
  if (d0.getTime() === yesterday.getTime()) return { key: "yesterday", label: `Yesterday, ${fmtDate}` };

  const diffDays = Math.round((today.getTime() - d0.getTime()) / 86_400_000);
  return { key: d0.toISOString(), label: `${diffDays} days ago, ${fmtDate}` };
}

export function MobileTradeList({ trades, loading }: Props) {
  // Group by day, ordered newest-first.
  const groups = useMemo(() => {
    const map = new Map<string, { label: string; ts: number; trades: MobileTrade[]; total: number }>();
    for (const t of trades) {
      const d = new Date(t.executedAt);
      const b = dayBucket(d);
      const existing = map.get(b.key);
      if (existing) {
        existing.trades.push(t);
        existing.total += t.profit || 0;
      } else {
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        map.set(b.key, {
          label: b.label,
          ts: day.getTime(),
          trades: [t],
          total: t.profit || 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.ts - a.ts);
  }, [trades]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-white/40">Loading trades…</div>;
  }

  if (trades.length === 0) {
    return (
      <div className="py-16 text-center">
        <Activity className="w-10 h-10 mx-auto text-white/20 mb-3" />
        <div className="text-sm text-white/50">No trades in this period</div>
        <div className="text-xs text-white/30 mt-1">Try a wider range or another tab</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const positive = g.total >= 0;
        return (
          <section key={g.label}>
            {/* Date group header */}
            <div className="flex items-baseline justify-between px-1 mb-2">
              <span className="text-xs font-medium text-white/55">{g.label}</span>
              <span className={cn("text-xs font-semibold tabular-nums", positive ? "text-emerald-400" : "text-red-400")}>
                {positive ? "+" : ""}${g.total.toFixed(2)}
              </span>
            </div>

            {/* Cards container */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] divide-y divide-white/[0.05] overflow-hidden">
              {g.trades.map((t, i) => (
                <TradeRow key={t.id} t={t} index={i} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TradeRow({ t, index }: { t: MobileTrade; index: number }) {
  const meta = findPair(t.symbol);
  const dp = meta ? (meta.pipSize < 0.01 ? 5 : 3) : 4;
  const isBuy = t.direction === "BUY" || t.direction === "LONG";
  const directionClr = isBuy ? "text-sky-400" : "text-rose-400";
  const positive = t.profit >= 0;
  const valueClr = positive ? "text-emerald-400" : "text-red-400";
  // Real lot derived from displayed USD profit and price move. This is
  // mathematically equivalent to (activeCapital / entryPrice) and keeps the
  // displayed lot, USD profit and price move all consistent for every trade.
  const priceDiff = Math.abs(t.exitPrice - t.entryPrice);
  const derivedLot = priceDiff > 0 ? Math.abs(t.profit) / priceDiff : 0;
  const lotNum = t.lot ?? derivedLot;
  const lot = lotNum.toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.1) }}
      className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-3.5 py-3"
    >
      {/* Pair icon */}
      <div className="mt-0.5">
        <PairIcon code={t.symbol} size={28} />
      </div>

      {/* Pair name + direction line */}
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-white leading-tight truncate">
          {formatPair(t.symbol)}
        </div>
        <div className="text-[12px] mt-1 leading-tight">
          <span className={cn("font-medium", directionClr)}>
            {isBuy ? "Buy" : "Sell"} {lot} lot
          </span>
          <span className="text-white/45"> at {t.entryPrice.toFixed(dp)}</span>
        </div>
      </div>

      {/* Right column: P/L + close price */}
      <div className="text-right shrink-0">
        <div className={cn("text-[15px] font-semibold tabular-nums leading-tight", valueClr)}>
          {positive ? "+" : ""}${t.profit.toFixed(2)}
        </div>
        <div className="text-[12px] text-white/45 mt-1 leading-tight tabular-nums">
          {t.exitPrice.toFixed(dp)}
        </div>
      </div>
    </motion.div>
  );
}
