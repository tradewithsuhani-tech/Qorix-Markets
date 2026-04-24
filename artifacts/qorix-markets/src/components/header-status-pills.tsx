import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CircleDot, Clock, type LucideIcon } from "lucide-react";

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

/**
 * Returns the next forex session boundary (close if open, open if closed).
 * Open period:  Sun 22:00 UTC → Fri 22:00 UTC
 * Closed period: Fri 22:00 UTC → Sun 22:00 UTC
 */
function nextBoundary(now: Date = new Date()): { open: boolean; target: Date } {
  const open = isMarketsOpen(now);
  const target = new Date(now);
  target.setUTCSeconds(0, 0);

  if (open) {
    // Next Friday 22:00 UTC
    const day = now.getUTCDay();
    const daysToFri = (5 - day + 7) % 7;
    target.setUTCDate(now.getUTCDate() + daysToFri);
    target.setUTCHours(22, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setUTCDate(target.getUTCDate() + 7);
    }
  } else {
    // Next Sunday 22:00 UTC
    const day = now.getUTCDay();
    const daysToSun = (0 - day + 7) % 7;
    target.setUTCDate(now.getUTCDate() + daysToSun);
    target.setUTCHours(22, 0, 0, 0);
    if (target.getTime() <= now.getTime()) {
      target.setUTCDate(target.getUTCDate() + 7);
    }
  }
  return { open, target };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${secs}s`;
}

export function MarketsStatusPill() {
  const [{ open, target }, setState] = useState(() => nextBoundary());
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(target.getTime() - Date.now()),
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const remaining = target.getTime() - now.getTime();
      if (remaining <= 0) {
        // Boundary crossed — recompute state
        setState(nextBoundary(now));
      } else {
        setCountdown(formatCountdown(remaining));
      }
    };
    // Update each second so the < 1h "MM:SS" view ticks live
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1.5 border transition-colors whitespace-nowrap ${
        open
          ? "bg-emerald-500/8 border-emerald-500/25 text-emerald-300"
          : "bg-amber-500/8 border-amber-500/25 text-amber-300"
      }`}
      title={
        open
          ? `Forex markets open · Closes ${target.toUTCString()}`
          : `Forex markets closed · Opens ${target.toUTCString()}`
      }
      data-testid="pill-markets-status"
    >
      <span className="relative flex h-2 w-2 shrink-0">
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
      <span className="uppercase tracking-wider text-[10.5px] font-bold">
        {open ? "Open" : "Closed"}
      </span>
      <span className="opacity-40 text-[10px]">·</span>
      <Clock className="w-3 h-3 opacity-70" />
      <span className="tabular-nums text-[10.5px] font-semibold">
        {countdown}
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
