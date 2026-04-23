import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, type LucideIcon } from "lucide-react";

/**
 * Forex markets follow a Sun 22:00 UTC → Fri 22:00 UTC continuous session.
 * Returns true while markets are considered open.
 */
function isMarketsOpen(d: Date = new Date()): boolean {
  const day = d.getUTCDay();
  const hour = d.getUTCHours();
  if (day === 6) return false;
  if (day === 0) return hour >= 22;
  if (day === 5) return hour < 22;
  return true;
}

export function MarketsStatusPill() {
  const [open, setOpen] = useState<boolean>(() => isMarketsOpen());
  useEffect(() => {
    const t = setInterval(() => setOpen(isMarketsOpen()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
        open
          ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-300"
          : "bg-amber-500/8 border-amber-500/25 text-amber-300"
      }`}
      title={open ? "Forex markets are open" : "Forex markets are closed"}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-60 ${
            open ? "bg-emerald-400 animate-ping" : "bg-amber-400"
          }`}
        />
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            open ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
      </span>
      <span className="uppercase tracking-wider text-[10.5px]">
        {open ? "Markets Open" : "Markets Closed"}
      </span>
    </div>
  );
}

export interface InsightItem {
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
  border: string;
}

export function InsightRotatorPill({
  insights,
  intervalMs = 3500,
}: {
  insights: InsightItem[];
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (insights.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % insights.length), intervalMs);
    return () => clearInterval(t);
  }, [insights.length, intervalMs]);

  const cur = insights[i] ?? insights[0];
  if (!cur) return null;
  const Icon = cur.icon ?? CircleDot;

  return (
    <div
      className={`relative overflow-hidden flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 border ${cur.bg} ${cur.border} ${cur.color}`}
      style={{ minWidth: 130 }}
    >
      <Icon style={{ width: 12, height: 12 }} />
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="whitespace-nowrap"
        >
          {cur.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
