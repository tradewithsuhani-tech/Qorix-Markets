import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import { AnimatedCounter } from "@/components/animated-counter";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  Tooltip,
} from "recharts";
import {
  X,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Zap,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { withRef } from "@/lib/referral";
import { trackCta } from "@/lib/analytics";

/**
 * DemoSandbox — client-side $10 trial.
 * - No signup, no backend.
 * - Persists for 24h in localStorage.
 * - Simulated trades with ~78% win rate, capital-protected losses.
 * - Conversion CTA always sticky at bottom.
 */

type Pair = { sym: string; base: number; vol: number };
const PAIRS: Pair[] = [
  { sym: "XAUUSD", base: 4702.2, vol: 4.2 },
  { sym: "BTCUSD", base: 67420, vol: 380 },
  { sym: "ETHUSD", base: 3512.6, vol: 22 },
  { sym: "SOLUSD", base: 184.5, vol: 2.4 },
  { sym: "EURUSD", base: 1.0921, vol: 0.0008 },
  { sym: "GBPUSD", base: 1.2784, vol: 0.0011 },
  { sym: "NAS100", base: 19442.1, vol: 38 },
];

type Trade = {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  entry: number;
  size: number;
  openedAt: number;
  closedAt?: number;
  pnl?: number;
  status: "open" | "win" | "loss";
};

type DemoState = {
  startedAt: number;
  expiresAt: number;
  balance: number;
  trades: Trade[];
  equity: { t: number; v: number }[];
};

const STORAGE_KEY = "qx_demo_v1";
const TRIAL_MS = 24 * 60 * 60 * 1000;
const START_BALANCE = 10;
const WIN_RATE = 0.78;

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function isValidState(s: unknown): s is DemoState {
  if (!s || typeof s !== "object") return false;
  const x = s as Record<string, unknown>;
  return (
    typeof x.startedAt === "number" &&
    typeof x.expiresAt === "number" &&
    typeof x.balance === "number" &&
    Number.isFinite(x.balance) &&
    Array.isArray(x.trades) &&
    Array.isArray(x.equity)
  );
}

function loadState(): DemoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function saveState(s: DemoState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore quota errors
  }
}

function freshState(): DemoState {
  const now = Date.now();
  return {
    startedAt: now,
    expiresAt: now + TRIAL_MS,
    balance: START_BALANCE,
    trades: [],
    equity: [{ t: now, v: START_BALANCE }],
  };
}

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "Trial ended";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

function timeAgo(ms: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

interface DemoSandboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoSandbox({ open, onOpenChange }: DemoSandboxProps) {
  const [state, setState] = useState<DemoState | null>(null);
  const [now, setNow] = useState(Date.now());
  const stateRef = useRef<DemoState | null>(null);
  stateRef.current = state;

  // Initialize on open
  useEffect(() => {
    if (!open) return;
    const existing = loadState();
    setState(existing ?? freshState());
  }, [open]);

  // Tick clock for "time left" + time-ago labels
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Trade simulation engine — opens new trades + closes existing on schedule
  useEffect(() => {
    if (!open || !state) return;

    const tick = () => {
      const cur = stateRef.current;
      if (!cur) return;
      const t = Date.now();
      const trades = [...cur.trades];
      let balance = cur.balance;

      // Close trades that have been open >12-25s
      for (let i = 0; i < trades.length; i++) {
        const tr = trades[i];
        if (tr.status !== "open") continue;
        const age = t - tr.openedAt;
        const targetAge = 12_000 + (parseInt(tr.id, 36) % 13_000);
        if (age >= targetAge) {
          const isWin = Math.random() < WIN_RATE;
          const pct = isWin
            ? 0.005 + Math.random() * 0.02 // 0.5–2.5%
            : -(0.003 + Math.random() * 0.009); // -0.3 to -1.2% (capital protected)
          const pnl = +(tr.size * pct).toFixed(4);
          trades[i] = {
            ...tr,
            status: isWin ? "win" : "loss",
            closedAt: t,
            pnl,
          };
          balance = +(balance + pnl).toFixed(4);
        }
      }

      // Open new trade if <2 open and balance permits
      const openCount = trades.filter((x) => x.status === "open").length;
      if (openCount < 2 && balance > 0.5 && Math.random() < 0.55) {
        const p = PAIRS[Math.floor(Math.random() * PAIRS.length)];
        const drift = (Math.random() - 0.5) * p.vol * 2;
        const size = +(0.8 + Math.random() * 2.4).toFixed(2);
        if (size <= balance * 0.4) {
          trades.unshift({
            id: uid(),
            pair: p.sym,
            side: Math.random() > 0.5 ? "BUY" : "SELL",
            entry: +(p.base + drift).toFixed(p.base < 10 ? 4 : 2),
            size,
            openedAt: t,
            status: "open",
          });
        }
      }

      // Cap closed history to last 30
      const closed = trades.filter((x) => x.status !== "open").slice(0, 30);
      const open = trades.filter((x) => x.status === "open");
      const next: DemoState = {
        ...cur,
        balance,
        trades: [...open, ...closed],
        equity: [...cur.equity.slice(-119), { t, v: balance }],
      };
      stateRef.current = next;
      setState(next);
      saveState(next);
    };

    const id = setInterval(tick, 2500);
    return () => clearInterval(id);
  }, [open, state !== null]); // re-arm only when open or state init flips

  if (!state) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogPrimitive.Content className="sr-only">
            <DialogPrimitive.Title>Loading demo</DialogPrimitive.Title>
            Loading demo…
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    );
  }

  const totalPnL = +(state.balance - START_BALANCE).toFixed(4);
  const pnlPct = (totalPnL / START_BALANCE) * 100;
  const timeLeft = state.expiresAt - now;
  const closedTrades = state.trades.filter((t) => t.status !== "open");
  const openTrades = state.trades.filter((t) => t.status === "open");
  const wins = closedTrades.filter((t) => t.status === "win").length;
  const winRate = closedTrades.length
    ? (wins / closedTrades.length) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:p-4 overflow-y-auto outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Free $10 demo trading account
          </DialogPrimitive.Title>
          <div
            className="relative w-full sm:max-w-3xl sm:rounded-2xl overflow-hidden flex flex-col"
            style={{
              background:
                "radial-gradient(ellipse at top, #0a1628 0%, #050a18 60%, #03060f 100%)",
              border: "1px solid rgba(16,185,129,0.2)",
              boxShadow: "0 30px 80px -20px rgba(16,185,129,0.35)",
              minHeight: "100vh",
            }}
            data-testid="demo-sandbox"
          >
            {/* HEADER */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/[0.06] bg-[#050a18]/80 backdrop-blur-md">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #22c55e)",
                    boxShadow: "0 4px 14px rgba(16,185,129,0.4)",
                  }}
                >
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white leading-tight">
                    Free Demo Account
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Live · No signup
                  </div>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-slate-300 transition-colors shrink-0"
                aria-label="Close demo"
                data-testid="button-close-demo"
              >
                <X size={18} />
              </button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="flex-1 px-4 sm:px-6 py-4 space-y-4 pb-32">
              {/* BALANCE CARD */}
              <div
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(16,185,129,0.14), rgba(20,184,166,0.04))",
                  border: "1px solid rgba(16,185,129,0.28)",
                }}
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                      Demo balance
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums mt-1">
                      $<AnimatedCounter value={state.balance} decimals={4} />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 justify-end">
                      <Clock size={10} />
                      {formatTimeLeft(timeLeft)}
                    </div>
                    <div
                      className={`text-base sm:text-lg font-bold tabular-nums mt-1 ${
                        totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(4)}
                    </div>
                    <div
                      className={`text-[11px] font-semibold ${
                        pnlPct >= 0 ? "text-emerald-400/80" : "text-rose-400/80"
                      }`}
                    >
                      {pnlPct >= 0 ? "+" : ""}
                      {pnlPct.toFixed(2)}%
                    </div>
                  </div>
                </div>

                {/* Equity sparkline */}
                <div className="h-[80px] -mx-2 mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={state.equity.map((e, i) => ({ i, v: e.v }))}
                      margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="qx-demo-fill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#10b981"
                            stopOpacity={0.45}
                          />
                          <stop
                            offset="100%"
                            stopColor="#10b981"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <YAxis hide domain={["dataMin - 0.05", "dataMax + 0.05"]} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(5,10,24,0.95)",
                          border: "1px solid rgba(16,185,129,0.3)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        formatter={(v: number) => [`$${v.toFixed(4)}`, "Balance"]}
                        labelFormatter={() => ""}
                      />
                      <Area
                        type="monotone"
                        dataKey="v"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#qx-demo-fill)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MINI STATS */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Trades
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                    {closedTrades.length}
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Win rate
                  </div>
                  <div className="text-lg font-bold text-emerald-300 tabular-nums mt-0.5">
                    {winRate.toFixed(0)}%
                  </div>
                </div>
                <div className="rounded-xl p-3 bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                    Open
                  </div>
                  <div className="text-lg font-bold text-white tabular-nums mt-0.5">
                    {openTrades.length}
                  </div>
                </div>
              </div>

              {/* OPEN TRADES */}
              {openTrades.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1.5">
                    <Zap size={11} /> Open trades · managed by AI
                  </div>
                  <div className="space-y-1.5">
                    {openTrades.map((tr) => (
                      <div
                        key={tr.id}
                        className="rounded-xl p-2.5 flex items-center justify-between"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(16,185,129,0.08), rgba(255,255,255,0.02))",
                          border: "1px solid rgba(16,185,129,0.18)",
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`w-1 h-8 rounded-full ${
                              tr.side === "BUY"
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-white">
                                {tr.pair}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  tr.side === "BUY"
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-amber-500/15 text-amber-300"
                                }`}
                              >
                                {tr.side}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Entry ${tr.entry} · ${tr.size.toFixed(2)} · running
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold shrink-0">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          live
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RECENT CLOSED */}
              {closedTrades.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Recent results
                  </div>
                  <div className="space-y-1.5">
                    {closedTrades.slice(0, 8).map((tr) => {
                      const win = tr.status === "win";
                      return (
                        <div
                          key={tr.id}
                          className="rounded-lg p-2.5 flex items-center justify-between bg-white/[0.025] border border-white/[0.05]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {win ? (
                              <TrendingUp
                                size={14}
                                className="text-emerald-400 shrink-0"
                              />
                            ) : (
                              <TrendingDown
                                size={14}
                                className="text-rose-400 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white">
                                {tr.pair}{" "}
                                <span className="text-slate-500 font-normal">
                                  · {tr.side}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {tr.closedAt ? timeAgo(tr.closedAt) : ""} ·
                                ${tr.size.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`text-sm font-bold tabular-nums ${
                              win ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {win ? "+" : ""}${(tr.pnl ?? 0).toFixed(4)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HOW IT WORKS BLURB */}
              {closedTrades.length < 3 && (
                <div className="rounded-xl p-3.5 bg-white/[0.025] border border-white/[0.06] flex gap-3">
                  <ShieldCheck
                    size={18}
                    className="text-emerald-400 shrink-0 mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-bold text-white mb-1">
                      Same engine. Smaller stakes.
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      Watch our AI desks place real-style trades on a $10
                      sandbox. Risk-capped, capital-protected. Trades close
                      every 12–25 seconds.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* STICKY CTA */}
            <div
              className="sticky bottom-0 left-0 right-0 z-10 px-4 sm:px-6 py-3.5 border-t border-emerald-500/20"
              style={{
                background:
                  "linear-gradient(180deg, rgba(5,10,24,0.5), rgba(5,10,24,0.95) 40%)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-bold">
                    {totalPnL > 0 ? "Ready to scale up?" : "Like what you see?"}
                  </div>
                  <div className="text-xs text-slate-300 leading-tight mt-0.5">
                    Open a real account to keep your profits.
                  </div>
                </div>
                <Link
                  href={withRef("/signup")}
                  onClick={() => {
                    trackCta("demo_sandbox_signup");
                    onOpenChange(false);
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white whitespace-nowrap shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #10b981, #22c55e)",
                    boxShadow: "0 8px 24px -6px rgba(16,185,129,0.55)",
                  }}
                  data-testid="button-demo-signup"
                >
                  Open real account
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
