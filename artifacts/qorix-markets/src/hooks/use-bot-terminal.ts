/**
 * BOT TERMINAL hooks — Batch T
 *
 * Two react-query hooks for the dashboard's BotTerminalCard:
 *
 *   useBotQuotes()  -> public 4-pair feed, polls every 2s
 *   useBotState()   -> auth-gated bot/positions/user-share, polls every 5s
 *
 * Both hooks pause polling when the tab is hidden
 * (refetchIntervalInBackground=false) so a tab parked in the
 * background doesn't keep beating on the API.
 *
 * Types here mirror the API server's response shapes one-for-one
 * (artifacts/api-server/src/lib/quote-feed.ts + bot-state.ts) but
 * are duplicated locally on purpose: the bot-trading endpoints are
 * not yet in the orval'd OpenAPI surface, and a hand-typed hook is
 * the smallest possible diff to ship the widget without spinning
 * up the codegen pipeline.
 */

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";

export type BotQuote = {
  code: string;
  display: string;
  bid: number;
  ask: number;
  mid: number;
  spreadPips: number;
  change24h: number;
  changeAbs24h: number;
  precision: number;
  pipSize: number;
  source: string;
  asOf: string;
  marketOpen: boolean;
};

export type BotQuotesResponse = {
  asOf: string;
  forexMarketOpen: boolean;
  quotes: BotQuote[];
};

export type BotStatePlan = {
  dayKey: string;
  targetPct: number;
  loserCount: number;
  totalSlots: number;
  executed: number;
  pending: number;
  failed: number;
  cumulativeRealizedPct: number;
  nextSlot: {
    index: number;
    pair: string;
    direction: string;
    pct: number;
    isLoser: boolean;
    scheduledAt: string;
  } | null;
  windowStart: string;
  windowEnd: string;
  effectiveStart: string;
} | null;

export type BotStateOpenPosition = {
  id: number;
  pair: string;
  direction: string;
  entryPrice: number;
  tpPrice: number | null;
  slPrice: number | null;
  expectedProfitPercent: number;
  openedAt: string;
  livePnlPct: number | null;
};

export type BotStateClosedTrade = {
  id: number;
  pair: string;
  direction: string;
  entryPrice: number;
  realizedExitPrice: number | null;
  realizedProfitPercent: number | null;
  closeReason: string | null;
  closedAt: string;
};

export type BotStateResponse = {
  asOf: string;
  market: { forexOpen: boolean; cryptoOpen: boolean };
  bot: { enabled: boolean; plan: BotStatePlan };
  openPositions: BotStateOpenPosition[];
  closedToday: BotStateClosedTrade[];
  userToday: { distributionsCount: number; totalProfit: number };
  summary: {
    openCount: number;
    closedTodayCount: number;
    closedTodayPctSum: number;
  };
};

export function useBotQuotes() {
  return useQuery<BotQuotesResponse>({
    queryKey: ["bot-trading-quotes"],
    queryFn: async () => {
      const res = await fetch("/api/bot-trading/quotes");
      if (!res.ok) throw new Error(`quotes failed: ${res.status}`);
      return res.json();
    },
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    // 1.5s staleTime keeps a cached snapshot warm for the BotTerminalCard
    // sibling renders without forcing a network call on every parent
    // re-render.
    staleTime: 1500,
  });
}

export function useBotState() {
  return useQuery<BotStateResponse>({
    queryKey: ["bot-trading-state"],
    queryFn: () => authFetch<BotStateResponse>("/api/bot-trading/state"),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 4000,
    // One retry only: a 401 here means the user is logged out, retrying
    // 3+ times wastes traffic and surfaces nothing useful in the widget.
    // The component handles `data === undefined` gracefully (skeleton +
    // disabled bot strip) so we don't need to drill an error UI in.
    retry: 1,
  });
}
