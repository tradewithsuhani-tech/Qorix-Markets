import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Bar,
} from "recharts";
import { Layout } from "@/components/layout";
import { useGetWallet } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { useInrRate } from "@/hooks/use-inr-rate";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import { TrendingUp, TrendingDown, RefreshCw, Plus } from "lucide-react";
import { Link } from "wouter";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(p: string) { return `${BASE_URL}/api${p}`; }
async function apiFetch(p: string, o: RequestInit = {}) { return authFetch(apiUrl(p), o); }

// ─── Candle generation ────────────────────────────────────────────────────────
type Candle = { time: string; open: number; high: number; low: number; close: number; vol: number };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function makeCandles(baseRate: number, count: number, interval: "1m" | "5m" | "15m" | "1h" | "1d"): Candle[] {
  const r = rng(Math.floor(baseRate * 100));
  const vol = interval === "1d" ? 0.012 : interval === "1h" ? 0.007 : interval === "15m" ? 0.005 : interval === "5m" ? 0.003 : 0.002;
  const candles: Candle[] = [];
  let price = baseRate;
  const now = Date.now();
  const msPerCandle = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "1d": 86_400_000 }[interval];

  for (let i = count; i >= 0; i--) {
    const change = (r() - 0.48) * vol;
    const open = price;
    price = +(price * (1 + change)).toFixed(2);
    const close = price;
    const swing = Math.abs(open - close) * (1 + r() * 0.8);
    const high = +(Math.max(open, close) + swing * r()).toFixed(2);
    const low  = +(Math.min(open, close) - swing * r()).toFixed(2);
    const ts = new Date(now - i * msPerCandle);
    const label = interval === "1d"
      ? ts.toLocaleDateString([], { day: "numeric", month: "short" })
      : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    candles.push({ time: label, open, high, low, close, vol: +(r() * 500 + 100).toFixed(0) });
  }
  return candles;
}

// ─── Recharts custom candlestick shape ───────────────────────────────────────
function CandleShape(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const { open, close, high, low } = payload;
  const isUp = close >= open;
  const color = isUp ? "#22c55e" : "#f43f5e";
  const bodyTop    = Math.min(y, y + height);
  const bodyBottom = Math.max(y, y + height);
  const bodyH = Math.max(Math.abs(height), 1);
  const cx = x + width / 2;

  // We'll get the y-scale values from the chart; approximate wick positions
  // The YAxis range is embedded in the chart via the domain. We pass highY/lowY as extras.
  const highY = props.highY ?? bodyTop - 4;
  const lowY  = props.lowY  ?? bodyBottom + 4;

  return (
    <g>
      {/* Wick */}
      <line x1={cx} y1={highY} x2={cx} y2={bodyTop}  stroke={color} strokeWidth={1} />
      <line x1={cx} y1={bodyBottom} x2={cx} y2={lowY} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect
        x={x + 1}
        y={bodyTop}
        width={Math.max(width - 2, 2)}
        height={bodyH}
        fill={isUp ? color : color}
        opacity={isUp ? 0.85 : 0.85}
        rx={1}
      />
    </g>
  );
}

// Custom tooltip
function CandleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as Candle;
  if (!d) return null;
  const isUp = d.close >= d.open;
  return (
    <div className="text-[11px] bg-[#0c0e14] border border-white/10 rounded-xl p-3 shadow-xl space-y-0.5 min-w-[140px]">
      <div className="text-muted-foreground font-medium mb-1">{d.time}</div>
      {[["O", d.open], ["H", d.high], ["L", d.low], ["C", d.close]].map(([k, v]) => (
        <div key={k as string} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{k}</span>
          <span className={`font-bold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
            ₹{(v as number).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── OHLC bar data for recharts ComposedChart ─────────────────────────────────
// We encode each candle as two stacked bars: from low→open (transparent), open→close (colored)
// Plus a separate dataset for wicks.
type BarDatum = {
  time: string;
  base: number;         // low (invisible bottom)
  body: number;         // |close - open|
  wickTop: number;      // high - max(open, close)
  wickBottom: number;   // min(open, close) - low
  isUp: boolean;
  open: number; high: number; low: number; close: number; vol: number;
};

function toBarData(candles: Candle[]): BarDatum[] {
  return candles.map(c => ({
    time: c.time,
    base: c.low,
    body: Math.abs(c.close - c.open) || 0.01,
    wickTop: c.high - Math.max(c.open, c.close),
    wickBottom: Math.min(c.open, c.close) - c.low,
    isUp: c.close >= c.open,
    open: c.open, high: c.high, low: c.low, close: c.close, vol: c.vol,
  }));
}

// Bar fill by direction
function BodyBar(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const color = payload.isUp ? "#22c55e" : "#f43f5e";
  const h = Math.max(height, 1);
  const cx = x + width / 2;
  return (
    <g>
      <rect x={x + 1} y={y} width={Math.max(width - 2, 2)} height={h} fill={color} rx={1} opacity={0.88} />
      {/* Approximate wick lines using relative offsets */}
      <line x1={cx} y1={y} x2={cx} y2={y - (height > 0 ? height * 0.3 : 0)} stroke={color} strokeWidth={1} opacity={0.7} />
      <line x1={cx} y1={y + h} x2={cx} y2={y + h + (height > 0 ? height * 0.3 : 0)} stroke={color} strokeWidth={1} opacity={0.7} />
    </g>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Interval = "1m" | "5m" | "15m" | "1h" | "1d";
type Side     = "buy" | "sell";
type OrdType  = "market" | "limit";

export default function UsdtMarketPage() {
  const { data: wallet, isLoading: walletLoading } = useGetWallet();
  const adminRate = useInrRate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [liveRate, setLiveRate]   = useState<number | null>(null);
  const [high24h, setHigh24h]     = useState<number | null>(null);
  const [low24h, setLow24h]       = useState<number | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(true);

  const [interval, setInterval] = useState<Interval>("1m");
  const [side, setSide]         = useState<Side>("buy");
  const [ordType, setOrdType]   = useState<OrdType>("market");
  const [amount, setAmount]     = useState("");
  const [limitPx, setLimitPx]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rateRef = useRef(adminRate);

  const rate = liveRate ?? adminRate;
  const displayRate = lastPrice ?? rate;

  // Fetch live rate on mount + every 15s
  const fetchRate = async () => {
    try {
      const d = await apiFetch("/usdt-market/rate") as any;
      setLiveRate(d.rate);
      setLastPrice(d.lastPrice);
      setHigh24h(d.high24h);
      setLow24h(d.low24h);
    } catch {
      setLiveRate(adminRate);
    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    rateRef.current = adminRate;
    fetchRate();
    const t = setInterval(fetchRate, 15_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRate]);

  // Candles regenerate when rate or interval changes
  const COUNTS: Record<Interval, number> = { "1m": 60, "5m": 60, "15m": 48, "1h": 48, "1d": 30 };
  const candles = useMemo(() => makeCandles(rate, COUNTS[interval], interval), [rate, interval]);
  const barData = useMemo(() => toBarData(candles), [candles]);

  const domainMin = useMemo(() => Math.floor(Math.min(...candles.map(c => c.low)) * 0.998), [candles]);
  const domainMax = useMemo(() => Math.ceil(Math.max(...candles.map(c => c.high)) * 1.002), [candles]);

  // Balances
  const mainBal = Number(wallet?.mainBalance) || 0;
  const usdtBal = Number((wallet as any)?.usdtBalance) || 0;
  const avbl     = side === "buy" ? mainBal : usdtBal;
  const avblUnit  = side === "buy" ? "INR" : "USDT";

  const numAmt  = parseFloat(amount) || 0;
  const effRate = ordType === "limit" && parseFloat(limitPx) > 0 ? parseFloat(limitPx) : rate;
  const estTotal = side === "buy" ? numAmt * effRate : numAmt * effRate;

  const setPercent = (pct: number) => {
    if (side === "buy") {
      setAmount(((mainBal / effRate) * pct).toFixed(4));
    } else {
      setAmount((usdtBal * pct).toFixed(4));
    }
  };

  const handleSubmit = async () => {
    if (!amount || numAmt <= 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/usdt-market/swap", {
        method: "POST",
        body: JSON.stringify({ direction: side, amount: numAmt, type: ordType }),
      });
      toast({
        title: side === "buy" ? "USDT Purchased!" : "USDT Sold!",
        description: side === "buy"
          ? `${numAmt.toFixed(4)} USDT added to your wallet.`
          : `₹${estTotal.toFixed(2)} added to your main balance.`,
      });
      setAmount("");
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const prevClose = candles.length > 1 ? candles[candles.length - 2]?.close ?? rate : rate;
  const isUp = displayRate >= prevClose;

  return (
    <Layout>
      <div className="space-y-0 max-w-2xl mx-auto">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-600/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <span className="text-base font-extrabold text-amber-300">₮</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-white tracking-tight">USDT / INR</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  INTERNAL MARKET
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Buy or sell USDT with your INR balance</p>
            </div>
          </div>

          {/* 24h stats */}
          <div className="flex items-center gap-4 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">LAST PRICE</div>
              <div className={`font-bold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                {rateLoading ? "—" : displayRate.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">24H HIGH</div>
              <div className="font-bold text-emerald-400 tabular-nums">{rateLoading ? "—" : (high24h ?? "—")}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">24H LOW</div>
              <div className="font-bold text-rose-400 tabular-nums">{rateLoading ? "—" : (low24h ?? "—")}</div>
            </div>
            <button
              onClick={fetchRate}
              className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 text-muted-foreground ${rateLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </motion.div>

        {/* ── Chart area ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="rounded-2xl border border-white/8 bg-[#0a0d14] overflow-hidden"
        >
          {/* Interval tabs */}
          <div className="flex items-center gap-1 px-4 pt-3 pb-1 border-b border-white/5">
            <span className="text-[11px] font-bold text-muted-foreground mr-2">USDT/INR</span>
            {(["1m", "5m", "15m", "1h", "1d"] as Interval[]).map(iv => (
              <button
                key={iv}
                onClick={() => setInterval(iv)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  interval === iv
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {iv}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="h-[220px] px-1 py-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.floor(barData.length / 6)}
                />
                <YAxis
                  domain={[domainMin, domainMax]}
                  tick={{ fontSize: 9, fill: "rgba(255,255,255,0.35)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₹${v}`}
                  width={48}
                />
                <Tooltip content={<CandleTooltip />} cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }} />
                <ReferenceLine y={rate} stroke="rgba(251,191,36,0.4)" strokeDasharray="4 3" strokeWidth={1} />
                {/* Invisible base (low) */}
                <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
                {/* Body */}
                <Bar
                  dataKey="body"
                  stackId="c"
                  isAnimationActive={false}
                  shape={<BodyBar />}
                  maxBarSize={10}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Current price pill */}
          <div className="flex justify-end px-4 pb-3">
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold border ${
              isUp
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              ₹{displayRate.toFixed(2)}
            </div>
          </div>
        </motion.div>

        {/* ── Trading Form ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-3 rounded-2xl border border-white/8 bg-[#0a0d14] overflow-hidden"
        >
          {/* BUY / SELL tabs */}
          <div className="grid grid-cols-2">
            <button
              onClick={() => setSide("buy")}
              className={`py-3 text-sm font-bold transition-all border-b-2 ${
                side === "buy"
                  ? "text-emerald-400 border-emerald-400 bg-emerald-500/5"
                  : "text-muted-foreground border-transparent hover:text-white"
              }`}
            >
              BUY
            </button>
            <button
              onClick={() => setSide("sell")}
              className={`py-3 text-sm font-bold transition-all border-b-2 ${
                side === "sell"
                  ? "text-rose-400 border-rose-400 bg-rose-500/5"
                  : "text-muted-foreground border-transparent hover:text-white"
              }`}
            >
              SELL
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">
            {/* Market / Limit */}
            <div className="flex items-center gap-2">
              {(["market", "limit"] as OrdType[]).map(ot => (
                <button
                  key={ot}
                  onClick={() => setOrdType(ot)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-all uppercase ${
                    ordType === ot
                      ? "bg-white/10 border-white/20 text-white"
                      : "border-white/8 text-muted-foreground hover:text-white hover:border-white/15"
                  }`}
                >
                  {ot}
                </button>
              ))}
            </div>

            {/* Available */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Avbl</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tabular-nums">
                  {walletLoading ? "—" : avbl.toLocaleString("en-IN", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {avblUnit}
                </span>
                <Link href="/deposit">
                  <span className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center hover:border-amber-500/50 hover:text-amber-300 transition-colors cursor-pointer">
                    <Plus className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            </div>

            {/* Limit price (only for limit orders) */}
            <AnimatePresence initial={false}>
              {ordType === "limit" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div>
                    <label className="text-[10px] text-muted-foreground font-medium mb-1 block uppercase tracking-wider">
                      Limit Price (₹ per USDT)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">₹</span>
                      <input
                        type="number"
                        value={limitPx}
                        onChange={e => setLimitPx(e.target.value)}
                        placeholder={rate.toFixed(2)}
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Amount */}
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-1 block uppercase tracking-wider">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.0000"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-bold text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>

            {/* Quick % buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[0.25, 0.5, 0.75, 1].map(pct => (
                <button
                  key={pct}
                  onClick={() => setPercent(pct)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                    side === "buy"
                      ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      : "border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                  }`}
                >
                  {pct === 1 ? "MAX" : `${pct * 100}%`}
                </button>
              ))}
            </div>

            {/* Est. Total */}
            <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
              <span className="text-muted-foreground">Est. Total</span>
              <span className="font-bold text-white tabular-nums">
                {numAmt > 0 ? `₹${estTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
              </span>
            </div>

            {/* Rate info */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Rate</span>
              <span className="tabular-nums">1 USDT = ₹{effRate.toFixed(2)}</span>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || !amount || numAmt <= 0}
              className={`w-full py-3.5 rounded-xl text-sm font-extrabold tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                side === "buy"
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                  : "bg-rose-500 hover:bg-rose-400 text-white shadow-[0_0_20px_rgba(244,63,94,0.3)]"
              }`}
            >
              {submitting
                ? "Processing..."
                : side === "buy"
                  ? "BUY USDT"
                  : "SELL USDT"
              }
            </button>

            {/* Disclaimer */}
            <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
              Internal market · Rate set by platform · Instant settlement
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
