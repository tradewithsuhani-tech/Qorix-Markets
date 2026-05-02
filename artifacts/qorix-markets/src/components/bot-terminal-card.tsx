/**
 * BotTerminalCard — Batch T
 *
 * Dashboard widget for the Bot Trading Terminal. Renders:
 *   - 4 ticker tiles (XAU/USD, EUR/USD, BTC/USD, USOIL) driven by
 *     /api/bot-trading/quotes (2s poll)
 *   - a header strip with platform open-position count + today's
 *     realized %, driven by /api/bot-trading/state (5s poll, auth)
 *   - a footer strip with bot plan progress + next signal ETA +
 *     the calling user's distribution share for the day
 *
 * The card stays useful for logged-out visitors too: the quotes
 * hook is public, so the 4 ticker tiles always render. The state
 * hook silently fails 401 in that case and the bot/share strip
 * shows a graceful "—" placeholder.
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ArrowDown, ArrowUp, Sparkles, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useBotQuotes,
  useBotState,
  type BotQuote,
} from "@/hooks/use-bot-terminal";

function formatPrice(value: number, precision: number) {
  return value.toFixed(Math.max(0, Math.min(8, precision)));
}

function formatPct(value: number) {
  const s = value.toFixed(2);
  return value >= 0 ? `+${s}%` : `${s}%`;
}

/**
 * Counts down to a future ISO timestamp ("in 2m 22s" / "in 14s" /
 * "now"). Updates once per second via a single tab-scoped interval.
 * If `to` is null the component renders nothing — callers pass
 * null when there's no upcoming slot, and the parent strip hides
 * the surrounding "next ... in X" line.
 */
function CountdownLabel({ to }: { to: string | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!to) return null;
  const target = new Date(to).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  if (diff <= 0) return <span className="font-mono">now</span>;
  const m = Math.floor(diff / 60);
  const s = diff % 60;
  return <span className="font-mono">{m > 0 ? `${m}m ${s}s` : `${s}s`}</span>;
}

function TickerTile({ q }: { q: BotQuote }) {
  const change = q.change24h;
  const isUp = change > 0;
  const isFlat = change === 0;
  return (
    <div className="rounded-lg border bg-background/50 p-3 flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground truncate">
          {q.display}
        </span>
        {q.marketOpen ? (
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] gap-1 px-1.5"
          >
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-slate-500/30 bg-slate-500/10 text-slate-400 text-[9px] px-1.5"
          >
            CLOSED
          </Badge>
        )}
      </div>
      <div className="font-mono text-base font-semibold tabular-nums truncate">
        {formatPrice(q.mid, q.precision)}
      </div>
      <div className="flex items-center justify-between text-[11px] gap-2">
        <span
          className={cn(
            "font-mono tabular-nums inline-flex items-center gap-0.5",
            isUp
              ? "text-emerald-400"
              : isFlat
                ? "text-muted-foreground"
                : "text-rose-400",
          )}
        >
          {isUp ? (
            <ArrowUp className="size-3" />
          ) : isFlat ? null : (
            <ArrowDown className="size-3" />
          )}
          {formatPct(change)}
        </span>
        <span className="text-muted-foreground tabular-nums shrink-0">
          {q.spreadPips}p
        </span>
      </div>
    </div>
  );
}

export function BotTerminalCard() {
  const { data: quotesData, isLoading: quotesLoading } = useBotQuotes();
  const { data: state } = useBotState();

  const quotes = quotesData?.quotes ?? [];
  const summary = state?.summary;
  const plan = state?.bot.plan;
  const userToday = state?.userToday;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-gradient-to-r from-emerald-500/5 via-transparent to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="size-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold tracking-wider truncate">
            BOT TERMINAL
          </span>
          <Badge
            variant="outline"
            className="h-5 shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] gap-1 px-1.5"
          >
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </Badge>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums flex items-center gap-2 shrink-0">
          {summary ? (
            <>
              <span>{summary.openCount} open</span>
              <span className="text-muted-foreground/50">•</span>
              <span
                className={cn(
                  summary.closedTodayPctSum > 0
                    ? "text-emerald-400"
                    : summary.closedTodayPctSum < 0
                      ? "text-rose-400"
                      : "",
                )}
              >
                {summary.closedTodayPctSum >= 0 ? "+" : ""}
                {summary.closedTodayPctSum.toFixed(2)}% today
              </span>
            </>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </div>
      </div>

      {/* 4 ticker tiles */}
      <div className="p-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
        {quotesLoading || quotes.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border bg-background/50 p-3 h-[88px] animate-pulse"
              />
            ))
          : quotes.map((q) => <TickerTile key={q.code} q={q} />)}
      </div>

      {/* Bot plan + user share strip */}
      <div className="px-4 py-2.5 border-t bg-background/40 text-[11px] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
          <TrendingUp className="size-3 text-emerald-400 shrink-0" />
          <span>Plan</span>
          {plan ? (
            <span className="font-mono tabular-nums text-foreground">
              {plan.executed}/{plan.totalSlots}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
          {plan?.nextSlot ? (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>next</span>
              <span className="font-mono text-foreground">
                {plan.nextSlot.pair} {plan.nextSlot.direction}
              </span>
              <span>in</span>
              <CountdownLabel to={plan.nextSlot.scheduledAt} />
            </>
          ) : plan ? (
            <span className="text-muted-foreground/60">· no upcoming slot</span>
          ) : null}
        </div>
        <div className="text-muted-foreground inline-flex items-center gap-1.5">
          <Sparkles className="size-3 text-amber-400 shrink-0" />
          <span>Your share today:</span>
          <span className="font-mono tabular-nums text-foreground">
            ${(userToday?.totalProfit ?? 0).toFixed(2)}
          </span>
          <span className="text-muted-foreground/60">
            ({userToday?.distributionsCount ?? 0})
          </span>
        </div>
      </div>
    </Card>
  );
}
