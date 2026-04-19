import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Clock, Bell, X } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TODAY_EVENTS, type ImpactLevel, type EconomicEvent } from "@/lib/economic-calendar-data";

export type { ImpactLevel, EconomicEvent };

function useCountdown(targetMs: number) {
  const [diff, setDiff] = useState(() => targetMs - Date.now());
  useEffect(() => {
    const id = setInterval(() => setDiff(targetMs - Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  return diff;
}

export function CountdownBadge({ targetMs }: { targetMs: number }) {
  const diff = useCountdown(targetMs);

  if (diff < 0) {
    return <span className="text-[10px] text-muted-foreground font-mono">Released</span>;
  }

  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const isImminent = diff < 30 * 60 * 1000;

  return (
    <span
      className={cn(
        "text-[10px] font-mono tabular-nums",
        isImminent ? "text-red-400 animate-pulse" : "text-muted-foreground"
      )}
    >
      {h > 0 ? `${h}h ${String(min).padStart(2, "0")}m` : `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`}
    </span>
  );
}

export function ImpactDot({ impact }: { impact: ImpactLevel }) {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "w-1 h-2.5 rounded-full",
            impact === "high" && i <= 2 ? "bg-red-500" :
            impact === "medium" && i <= 1 ? "bg-amber-500" :
            impact === "low" && i === 0 ? "bg-emerald-500" :
            "bg-white/10"
          )}
        />
      ))}
    </div>
  );
}

export function HighImpactNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [nextEvent, setNextEvent] = useState<EconomicEvent | null>(null);

  useEffect(() => {
    const checkImminentEvent = () => {
      const now = Date.now();
      const upcoming = TODAY_EVENTS.filter(
        (e) => e.impact === "high" && e.timeMs > now && e.timeMs - now < 30 * 60 * 1000
      );
      if (upcoming.length > 0 && !dismissed) {
        setNextEvent(upcoming[0]!);
        setVisible(true);
      } else {
        setVisible(false);
      }
    };
    checkImminentEvent();
    const id = setInterval(checkImminentEvent, 30000);
    return () => clearInterval(id);
  }, [dismissed]);

  return (
    <AnimatePresence>
      {visible && nextEvent && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
        >
          <div className="glass-card border border-red-500/30 bg-red-500/10 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl shadow-red-500/10">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-red-300 leading-none mb-0.5">High Impact News</div>
              <div className="text-[11px] text-white/70 truncate">
                {nextEvent.event} in <CountdownBadge targetMs={nextEvent.timeMs} />
              </div>
            </div>
            <button
              onClick={() => { setDismissed(true); setVisible(false); }}
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EconomicNewsLandingWidget() {
  const [, navigate] = useLocation();
  const highImpactToday = TODAY_EVENTS.filter((e) => e.impact === "high").slice(0, 5);

  return (
    <div className="glass-card rounded-3xl overflow-hidden">
      <div className="p-5 md:p-6 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <div className="text-sm font-semibold">Today's High-Impact Events</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            Full Calendar <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {highImpactToday.map((event, i) => {
          const isPast = Date.now() > event.timeMs;
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                "flex items-center gap-3 px-5 md:px-6 py-3.5 hover:bg-white/[0.025] transition-colors",
                isPast && "opacity-40"
              )}
            >
              <div className="flex items-center gap-1.5 shrink-0 w-16">
                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] font-mono text-muted-foreground">{event.time}</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 w-14">
                <span className="text-sm">{event.flag}</span>
                <span className="text-[11px] font-semibold text-white/60">{event.currency}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{event.event}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="w-5 h-5 rounded-md bg-red-500/15 border border-red-500/25 flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                </div>
                {!isPast && <CountdownBadge targetMs={event.timeMs} />}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="px-5 md:px-6 py-4 border-t border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          Live market calendar
        </div>
        <button onClick={() => navigate("/login")} className="btn btn-ghost text-[11px] px-3 py-1.5 gap-1">
          View all events <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
