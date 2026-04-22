import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ArrowRight, Clock, Bell, X, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TODAY_EVENTS, type ImpactLevel, type EconomicEvent } from "@/lib/economic-calendar-data";

// How early before an event the banner appears
export const BANNER_LEAD_MS = 60 * 60 * 1000; // 60 minutes

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

function InlineCountdown({ targetMs }: { targetMs: number }) {
  const diff = useCountdown(targetMs);
  if (diff < 0) {
    return (
      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
        Just Released
      </span>
    );
  }
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const isImminent = diff < 5 * 60 * 1000;
  const colorTxt = isImminent ? "text-red-300" : "text-white";
  const colorSep = isImminent ? "text-red-300/60" : "text-white/30";
  return (
    <div
      className={cn(
        "inline-flex items-baseline gap-0.5 font-mono tabular-nums leading-none",
        isImminent && "animate-pulse",
      )}
    >
      {h > 0 && (
        <>
          <span className={cn("text-base font-bold", colorTxt)}>{String(h).padStart(2, "0")}</span>
          <span className={cn("text-[10px] font-medium ml-0.5 mr-1", colorSep)}>h</span>
        </>
      )}
      <span className={cn("text-base font-bold", colorTxt)}>{String(min).padStart(2, "0")}</span>
      <span className={cn("text-[10px] font-medium ml-0.5 mr-1", colorSep)}>m</span>
      <span className={cn("text-base font-bold", colorTxt)}>{String(sec).padStart(2, "0")}</span>
      <span className={cn("text-[10px] font-medium ml-0.5", colorSep)}>s</span>
    </div>
  );
}

export function HighImpactNotificationBanner() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const nextEvent = useMemo(() => {
    const now = Date.now();
    return (
      TODAY_EVENTS.find(
        (e) =>
          e.impact === "high" &&
          e.timeMs > now &&
          e.timeMs - now < BANNER_LEAD_MS &&
          !dismissedIds.has(e.id),
      ) ?? null
    );
    // tick used to re-evaluate every 30s
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissedIds, tick]);

  return (
    <AnimatePresence>
      {nextEvent && (
        <motion.div
          key={nextEvent.id}
          initial={{ opacity: 0, y: -40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.96 }}
          transition={{ type: "spring", bounce: 0.25, duration: 0.55 }}
          className="fixed left-1/2 -translate-x-1/2 z-[90] w-[calc(100%-1rem)] max-w-[420px] px-0"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 64px)",
          }}
        >
          <div
            className="relative overflow-hidden rounded-2xl border border-red-500/40 shadow-2xl shadow-red-500/25"
            style={{
              background:
                "linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(10,15,30,0.96) 50%, rgba(10,15,30,0.98) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* shimmer accent bar */}
            <motion.div
              className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-red-400 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            />

            {/* HEADER ROW: badge + flag + title + close */}
            <div className="flex items-center gap-2 px-3.5 pt-3 pb-2">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/30 to-red-700/20 border border-red-500/40 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-red-300 fill-red-400" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
              </div>

              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-400 shrink-0">
                High Impact
              </span>
              <span className="text-white/20 shrink-0">·</span>
              <span className="text-[11px] text-white/70 shrink-0 flex items-center gap-1">
                <span>{nextEvent.flag}</span>
                <span className="font-semibold">{nextEvent.currency}</span>
              </span>

              <div className="flex-1" />

              <button
                onClick={() =>
                  setDismissedIds((prev) => {
                    const next = new Set(prev);
                    next.add(nextEvent.id);
                    return next;
                  })
                }
                className="shrink-0 p-1 -mr-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/10 transition"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* EVENT NAME */}
            <div className="px-3.5 pb-2.5">
              <div className="text-[15px] font-semibold text-white leading-tight truncate">
                {nextEvent.event}
              </div>
            </div>

            {/* COUNTDOWN STRIP */}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t border-white/[0.06] bg-black/25">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Releases in
              </span>
              <InlineCountdown targetMs={nextEvent.timeMs} />
            </div>
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
