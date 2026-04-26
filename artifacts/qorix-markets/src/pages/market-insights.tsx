import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Filter, Calendar, BarChart2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEK_EVENTS, type ImpactLevel, type EconomicEvent } from "@/lib/economic-calendar-data";
import { CountdownBadge, ImpactDot } from "@/components/economic-news-widget";
import { Layout } from "@/components/layout";
import { PageContainer } from "@/components/page-container";

function groupByDay(events: EconomicEvent[]) {
  const groups: Record<string, EconomicEvent[]> = {};
  events.forEach((e) => {
    const key = new Date(e.timeMs).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(e);
  });
  return groups;
}

const CURRENCIES = ["All", "USD", "EUR", "GBP", "JPY", "CAD", "AUD"];
const IMPACTS: { label: string; value: ImpactLevel | "all" }[] = [
  { label: "All", value: "all" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

function EventRow({ event, i }: { event: EconomicEvent; i: number }) {
  const isPast = Date.now() > event.timeMs;
  const isNext = !isPast && WEEK_EVENTS.find((e) => e.timeMs > Date.now())?.id === event.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.03 }}
      className={cn(
        "flex items-center gap-2 md:gap-4 px-2.5 md:px-6 py-3 md:py-3.5 group transition-colors relative",
        isNext && "bg-blue-500/5",
        !isNext && "hover:bg-white/[0.02]",
        isPast && "opacity-40"
      )}
    >
      {isNext && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-blue-400" />
      )}

      <div className="flex items-center gap-1 shrink-0 w-12 md:w-16">
        <Clock className="w-3 h-3 text-muted-foreground shrink-0 hidden md:block" />
        <span className="text-[10px] md:text-[11px] font-mono text-muted-foreground whitespace-nowrap">{event.time}</span>
      </div>

      <div className="flex items-center gap-1 shrink-0 w-12 md:w-16">
        <span className="text-sm">{event.flag}</span>
        <span className="text-[10px] md:text-[11px] font-semibold text-white/60">{event.currency}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[12px] md:text-sm font-medium truncate">{event.event}</div>
        {(event.forecast !== "—" || event.previous !== "—") && (
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
            {event.forecast && event.forecast !== "—" && (
              <span className="text-[9.5px] md:text-[10px] text-muted-foreground whitespace-nowrap">F: <span className="text-white/60">{event.forecast}</span></span>
            )}
            {event.previous && event.previous !== "—" && (
              <span className="text-[9.5px] md:text-[10px] text-muted-foreground whitespace-nowrap">P: <span className="text-white/50">{event.previous}</span></span>
            )}
          </div>
        )}
      </div>

      <div className="hidden md:flex items-center gap-1.5 shrink-0">
        <ImpactDot impact={event.impact} />
        <span className={cn(
          "text-[10px] font-medium capitalize",
          event.impact === "high" ? "text-red-400" :
          event.impact === "medium" ? "text-amber-400" : "text-emerald-400"
        )}>
          {event.impact}
        </span>
      </div>

      <div className="md:hidden shrink-0">
        {event.impact === "high" && (
          <div className="w-4 h-4 rounded-md bg-red-500/15 border border-red-500/25 flex items-center justify-center">
            <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
          </div>
        )}
      </div>

      <div className="shrink-0 w-12 md:w-16 text-right">
        {!isPast ? (
          <CountdownBadge targetMs={event.timeMs} />
        ) : (
          <span className="text-[9.5px] md:text-[10px] text-muted-foreground">Released</span>
        )}
      </div>
    </motion.div>
  );
}

export default function MarketInsightsPage() {
  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [impactFilter, setImpactFilter] = useState<ImpactLevel | "all">("all");

  const filtered = WEEK_EVENTS.filter((e) => {
    const matchCurrency = currencyFilter === "All" || e.currency === currencyFilter;
    const matchImpact = impactFilter === "all" || e.impact === impactFilter;
    return matchCurrency && matchImpact;
  });

  const grouped = groupByDay(filtered);
  const todayKey = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });

  const totalHigh = WEEK_EVENTS.filter((e) => e.impact === "high").length;
  const upcomingHigh = WEEK_EVENTS.filter((e) => e.impact === "high" && e.timeMs > Date.now()).length;
  const todayCount = WEEK_EVENTS.filter((e) => {
    const eDate = new Date(e.timeMs);
    const now = new Date();
    return eDate.toDateString() === now.toDateString();
  }).length;

  return (
    <Layout>
      <PageContainer maxWidth="default">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Market Insights</h1>
            <p className="text-sm text-muted-foreground mt-1">Economic calendar — high-impact events affecting your trades</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: AlertTriangle, label: "High-Impact Week", value: totalHigh, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
            { icon: Clock, label: "Upcoming High", value: upcomingHigh, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
            { icon: Calendar, label: "Events Today", value: todayCount, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className={cn("glass-card rounded-2xl p-4 border", bg)}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("w-4 h-4", color)} />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
              <div className={cn("text-2xl font-bold", color)}>{value}</div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filter</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-wrap gap-1.5">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrencyFilter(c)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                    currencyFilter === c
                      ? "bg-blue-500/20 border border-blue-500/40 text-blue-300"
                      : "bg-white/[0.04] border border-white/[0.06] text-muted-foreground hover:text-white hover:bg-white/[0.07]"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="w-px bg-white/10 mx-1 hidden md:block" />
            <div className="flex flex-wrap gap-1.5">
              {IMPACTS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setImpactFilter(value)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1",
                    impactFilter === value
                      ? "bg-blue-500/20 border border-blue-500/40 text-blue-300"
                      : "bg-white/[0.04] border border-white/[0.06] text-muted-foreground hover:text-white hover:bg-white/[0.07]"
                  )}
                >
                  {value !== "all" && (
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      value === "high" ? "bg-red-500" :
                      value === "medium" ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                  )}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {Object.entries(grouped).map(([dayLabel, events]) => {
            const isToday = dayLabel === todayKey;
            return (
              <div key={dayLabel} className="glass-card rounded-2xl overflow-hidden">
                <div className={cn(
                  "flex items-center gap-2 px-4 md:px-6 py-3 border-b border-white/[0.06]",
                  isToday && "bg-blue-500/5"
                )}>
                  <Calendar className={cn("w-3.5 h-3.5", isToday ? "text-blue-400" : "text-muted-foreground")} />
                  <span className={cn("text-xs font-semibold", isToday ? "text-blue-300" : "text-muted-foreground")}>
                    {isToday ? `Today · ${dayLabel}` : dayLabel}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {events.filter((e) => e.impact === "high").length > 0 && (
                      <span className="text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
                        {events.filter((e) => e.impact === "high").length} high
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{events.length} events</span>
                  </div>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {events.map((event, i) => (
                    <EventRow key={event.id} event={event} i={i} />
                  ))}
                </div>
              </div>
            );
          })}

          {Object.keys(grouped).length === 0 && (
            <div className="glass-card rounded-2xl p-12 text-center">
              <BarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <div className="text-sm text-muted-foreground">No events match the current filter</div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Economic calendar data is indicative only. High-impact events can cause significant market volatility. Times shown are in your local timezone.
            Always manage your risk accordingly.
          </p>
        </div>
      </PageContainer>
    </Layout>
  );
}
