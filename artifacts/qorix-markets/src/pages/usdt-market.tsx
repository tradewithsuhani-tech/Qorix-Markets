import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Bar,
} from "recharts";
import { Layout } from "@/components/layout";
import { useGetWallet } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { useInrRate } from "@/hooks/use-inr-rate";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-fetch";
import {
  TrendingUp, TrendingDown, RefreshCw, Plus, X, Clock, CheckCircle2,
} from "lucide-react";
import { Link } from "wouter";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(p: string) { return `${BASE_URL}/api${p}`; }
async function apiFetch(p: string, o: RequestInit = {}) { return authFetch(apiUrl(p), o); }

// ─── Types ─────────────────────────────────────────────────────────────────────
type Interval = "1m" | "5m" | "15m" | "1h" | "1d";
type Side     = "buy" | "sell";
type OrdType  = "market" | "limit";

interface OpenOrder {
  id: number;
  direction: "buy" | "sell";
  usdt: number;
  limitPrice: number | null;
  inr: number | null;
  createdAt: string;
  status: string;
}

// ─── Candle generation ─────────────────────────────────────────────────────────
type Candle = { time: string; open: number; high: number; low: number; close: number };
type BarDatum = {
  time: string; base: number; body: number;
  isUp: boolean; open: number; high: number; low: number; close: number;
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

function makeCandles(baseRate: number, count: number, interval: Interval): Candle[] {
  const r = rng(Math.floor(baseRate * 100) + interval.charCodeAt(0));
  const vol = interval === "1d" ? 0.012 : interval === "1h" ? 0.007 : interval === "15m" ? 0.005 : interval === "5m" ? 0.003 : 0.002;
  const candles: Candle[] = [];
  let price = baseRate;
  const now = Date.now();
  const ms = { "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "1d": 86_400_000 }[interval];
  for (let i = count; i >= 0; i--) {
    const change = (r() - 0.48) * vol;
    const open = price;
    price = +(price * (1 + change)).toFixed(2);
    const close = price;
    const swing = Math.abs(open - close) * (1 + r() * 0.8);
    const high  = +(Math.max(open, close) + swing * r()).toFixed(2);
    const low   = +(Math.min(open, close) - swing * r()).toFixed(2);
    const ts = new Date(now - i * ms);
    const label = interval === "1d"
      ? ts.toLocaleDateString([], { day: "numeric", month: "short" })
      : ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    candles.push({ time: label, open, high, low, close });
  }
  return candles;
}

function toBarData(candles: Candle[]): BarDatum[] {
  return candles.map(c => ({
    time: c.time,
    base: c.low,
    body: Math.max(Math.abs(c.close - c.open), 0.01),
    isUp: c.close >= c.open,
    open: c.open, high: c.high, low: c.low, close: c.close,
  }));
}

function BodyBar(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;
  const color = payload.isUp ? "#22c55e" : "#f43f5e";
  const h = Math.max(height, 1);
  const cx = x + width / 2;
  const wickH = Math.max(h * 0.35, 2);
  return (
    <g>
      <rect x={x + 1} y={y} width={Math.max(width - 2, 2)} height={h} fill={color} rx={1} opacity={0.88} />
      <line x1={cx} y1={y} x2={cx} y2={Math.max(y - wickH, 0)} stroke={color} strokeWidth={1} opacity={0.65} />
      <line x1={cx} y1={y + h} x2={cx} y2={y + h + wickH} stroke={color} strokeWidth={1} opacity={0.65} />
    </g>
  );
}

function CandleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as BarDatum;
  if (!d) return null;
  const isUp = d.close >= d.open;
  return (
    <div className="text-[11px] bg-[#0c0e14] border border-white/10 rounded-xl p-3 shadow-xl space-y-0.5 min-w-[130px]">
      <div className="text-muted-foreground font-medium mb-1">{d.time}</div>
      {([["O", d.open], ["H", d.high], ["L", d.low], ["C", d.close]] as [string, number][]).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4">
          <span className="text-muted-foreground">{k}</span>
          <span className={`font-bold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>₹{v.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Order Book row ────────────────────────────────────────────────────────────
interface OrderRow { price: number; qty: number; total: number; depth: number }

function makeOrderBook(rate: number, side: "ask" | "bid", count: number): OrderRow[] {
  const r = rng(Math.floor(rate * 10) + (side === "ask" ? 1 : 2));
  const rows: OrderRow[] = [];
  let runTotal = 0;
  for (let i = 0; i < count; i++) {
    const spread = side === "ask"
      ? rate * (0.0005 + i * 0.0003 + r() * 0.0002)
      : rate * (0.0005 + i * 0.0003 + r() * 0.0002);
    const price = side === "ask"
      ? +(rate + spread).toFixed(2)
      : +(rate - spread).toFixed(2);
    const qty = +(r() * 200 + 10).toFixed(2);
    runTotal += qty;
    rows.push({ price, qty, total: +runTotal.toFixed(2), depth: 0 });
  }
  const max = rows[rows.length - 1]?.total || 1;
  rows.forEach(r2 => { r2.depth = +(r2.total / max * 100).toFixed(1); });
  return rows;
}

function OrderBookRow({ row, side }: { row: OrderRow; side: "ask" | "bid" }) {
  const isAsk = side === "ask";
  return (
    <div className="relative flex items-center text-[11px] tabular-nums py-[2px] px-2 group hover:bg-white/[0.03]">
      <div
        className={`absolute inset-y-0 ${isAsk ? "right-0" : "left-0"} opacity-10`}
        style={{ width: `${row.depth}%`, background: isAsk ? "#f43f5e" : "#22c55e" }}
      />
      <span className={`w-1/3 font-medium ${isAsk ? "text-rose-400" : "text-emerald-400"}`}>
        {row.price.toFixed(2)}
      </span>
      <span className="w-1/3 text-center text-white/70">{row.qty.toFixed(2)}</span>
      <span className="w-1/3 text-right text-white/50">{row.total.toFixed(0)}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
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

  const [chartInterval, setChartInterval] = useState<Interval>("1m");
  const [side, setSide]           = useState<Side>("buy");
  const [ordType, setOrdType]     = useState<OrdType>("market");
  const [amount, setAmount]       = useState("");
  const [limitPx, setLimitPx]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openTab, setOpenTab]     = useState<"open" | "history">("open");
  const rateRef = useRef(adminRate);

  const rate = liveRate ?? adminRate;
  const displayRate = lastPrice ?? rate;

  const fetchRate = useCallback(async () => {
    try {
      const d = await apiFetch("/usdt-market/rate") as any;
      setLiveRate(d.rate); setLastPrice(d.lastPrice);
      setHigh24h(d.high24h); setLow24h(d.low24h);
    } catch { setLiveRate(adminRate); }
    finally { setRateLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRate]);

  useEffect(() => {
    rateRef.current = adminRate;
    fetchRate();
    const t = setInterval(fetchRate, 15_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRate]);

  // Open orders query
  const { data: openOrdersData, refetch: refetchOrders } = useQuery({
    queryKey: ["usdt-market-open-orders"],
    queryFn: async () => {
      const d = await apiFetch("/usdt-market/open-orders") as any;
      return d.orders as OpenOrder[];
    },
    refetchInterval: 15_000,
  });
  const openOrders = openOrdersData ?? [];

  // Cancel order mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiFetch(`/usdt-market/open-orders/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      toast({ title: "Order cancelled", description: "Funds have been refunded." });
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    },
    onError: () => toast({ title: "Cancel failed", variant: "destructive" }),
  });

  // Candles
  const COUNTS: Record<Interval, number> = { "1m": 60, "5m": 60, "15m": 48, "1h": 48, "1d": 30 };
  const candles = useMemo(() => makeCandles(rate, COUNTS[chartInterval], chartInterval), [rate, chartInterval]);
  const barData  = useMemo(() => toBarData(candles), [candles]);
  const domainMin = useMemo(() => Math.floor(Math.min(...candles.map(c => c.low)) * 0.998), [candles]);
  const domainMax = useMemo(() => Math.ceil(Math.max(...candles.map(c => c.high)) * 1.002), [candles]);

  // Order book (simulated, regenerate on rate change)
  const asks = useMemo(() => makeOrderBook(rate, "ask", 10).reverse(), [rate]);
  const bids  = useMemo(() => makeOrderBook(rate, "bid", 10), [rate]);

  // Balances
  const mainBal = Number(wallet?.mainBalance) || 0;
  const usdtBal = Number((wallet as any)?.usdtBalance) || 0;
  const avbl    = side === "buy" ? mainBal : usdtBal;
  const avblUnit = side === "buy" ? "INR" : "USDT";

  const numAmt  = parseFloat(amount) || 0;
  const effRate = ordType === "limit" && parseFloat(limitPx) > 0 ? parseFloat(limitPx) : rate;
  const estTotal = numAmt * effRate;

  const setPercent = (pct: number) => {
    if (side === "buy") setAmount(((mainBal / effRate) * pct).toFixed(4));
    else setAmount((usdtBal * pct).toFixed(4));
  };

  const prevClose = candles.length > 1 ? candles[candles.length - 2]?.close ?? rate : rate;
  const isUp = displayRate >= prevClose;

  const handleSubmit = async () => {
    if (!amount || numAmt <= 0) { toast({ title: "Enter an amount", variant: "destructive" }); return; }
    if (ordType === "limit" && (!limitPx || parseFloat(limitPx) <= 0)) {
      toast({ title: "Enter a limit price", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/usdt-market/swap", {
        method: "POST",
        body: JSON.stringify({
          direction: side, amount: numAmt, type: ordType,
          ...(ordType === "limit" ? { limitPrice: parseFloat(limitPx) } : {}),
        }),
      });

      const isLimitOrder = ordType === "limit";
      toast({
        title: isLimitOrder
          ? `Limit ${side === "buy" ? "Buy" : "Sell"} placed`
          : side === "buy" ? "USDT Purchased!" : "USDT Sold!",
        description: isLimitOrder
          ? `Order placed @ ₹${limitPx}. Funds locked until filled or cancelled.`
          : side === "buy"
            ? `${numAmt.toFixed(4)} USDT added to your wallet.`
            : `₹${estTotal.toFixed(2)} added to your main balance.`,
      });

      setAmount("");
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      refetchOrders();
    } catch (err: any) {
      toast({ title: "Order failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-3 max-w-5xl mx-auto">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-600/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-extrabold text-amber-300">₮</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">USDT / INR</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  INTERNAL MARKET
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Buy or sell USDT with your INR balance</p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs">
            <div>
              <div className="text-muted-foreground text-[10px]">LAST PRICE</div>
              <div className={`font-bold tabular-nums text-sm ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                {rateLoading ? "—" : displayRate.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">24H HIGH</div>
              <div className="font-bold text-emerald-400 tabular-nums">{rateLoading ? "—" : (high24h ?? "—")}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-[10px]">24H LOW</div>
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

        {/* ── Chart + Order Book row ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.06 }}
          className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-3"
        >
          {/* Chart */}
          <div className="rounded-2xl border border-white/8 bg-[#0a0d14] overflow-hidden">
            <div className="flex items-center gap-1 px-3 pt-3 pb-1 border-b border-white/5">
              <span className="text-[11px] font-bold text-muted-foreground mr-2">USDT/INR</span>
              {(["1m", "5m", "15m", "1h", "1d"] as Interval[]).map(iv => (
                <button
                  key={iv}
                  onClick={() => setChartInterval(iv)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                    chartInterval === iv
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {iv}
                </button>
              ))}
            </div>
            <div className="h-[200px] px-1 py-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={barData} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} interval={Math.floor(barData.length / 6)} />
                  <YAxis domain={[domainMin, domainMax]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} width={46} />
                  <Tooltip content={<CandleTooltip />} cursor={{ stroke: "rgba(255,255,255,0.07)", strokeWidth: 1 }} />
                  <ReferenceLine y={rate} stroke="rgba(251,191,36,0.35)" strokeDasharray="4 3" strokeWidth={1} />
                  <Bar dataKey="base" stackId="c" fill="transparent" isAnimationActive={false} />
                  <Bar dataKey="body" stackId="c" isAnimationActive={false} shape={<BodyBar />} maxBarSize={9} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-end px-3 pb-2">
              <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                isUp ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                ₹{displayRate.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Order Book */}
          <div className="rounded-2xl border border-white/8 bg-[#0a0d14] overflow-hidden flex flex-col">
            <div className="px-3 pt-3 pb-1 border-b border-white/5 shrink-0">
              <span className="text-[11px] font-bold text-white">Order Book</span>
            </div>
            {/* Column headers */}
            <div className="flex text-[10px] text-muted-foreground px-2 pt-1.5 pb-0.5 shrink-0">
              <span className="w-1/3">Price(₹)</span>
              <span className="w-1/3 text-center">Qty(USDT)</span>
              <span className="w-1/3 text-right">Total</span>
            </div>

            {/* Asks (sell orders) — prices above current */}
            <div className="flex-1 overflow-hidden flex flex-col justify-end">
              {asks.map((row, i) => <OrderBookRow key={i} row={row} side="ask" />)}
            </div>

            {/* Current price spread */}
            <div className={`flex items-center justify-between px-2 py-1.5 border-y border-white/8 shrink-0 ${
              isUp ? "bg-emerald-500/5" : "bg-rose-500/5"
            }`}>
              <span className={`text-sm font-extrabold tabular-nums ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
                ₹{displayRate.toFixed(2)}
              </span>
              <span className="text-[10px] text-muted-foreground">≈ $1.000</span>
            </div>

            {/* Bids (buy orders) — prices below current */}
            <div className="flex-1 overflow-hidden">
              {bids.map((row, i) => <OrderBookRow key={i} row={row} side="bid" />)}
            </div>
          </div>
        </motion.div>

        {/* ── Trading Form ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="rounded-2xl border border-white/8 bg-[#0a0d14] overflow-hidden"
        >
          {/* BUY / SELL */}
          <div className="grid grid-cols-2">
            {(["buy", "sell"] as Side[]).map(s => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`py-3 text-sm font-bold transition-all border-b-2 ${
                  side === s
                    ? s === "buy"
                      ? "text-emerald-400 border-emerald-400 bg-emerald-500/5"
                      : "text-rose-400 border-rose-400 bg-rose-500/5"
                    : "text-muted-foreground border-transparent hover:text-white"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="px-4 py-4 space-y-3">
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

            {/* Avbl */}
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

            {/* Limit price */}
            <AnimatePresence initial={false}>
              {ordType === "limit" && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                  <label className="text-[10px] text-muted-foreground font-medium mb-1 block uppercase tracking-wider">Limit Price (₹/USDT)</label>
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Amount */}
            <div>
              <label className="text-[10px] text-muted-foreground font-medium mb-1 block uppercase tracking-wider">Amount (USDT)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.0000"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm font-bold text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/40 transition-colors"
              />
            </div>

            {/* Quick % */}
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

            {/* Est. Total + Rate */}
            <div className="space-y-1 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Est. Total</span>
                <span className="font-bold text-white tabular-nums">
                  {numAmt > 0 ? `₹${estTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Rate</span>
                <span className="tabular-nums">1 USDT = ₹{effRate.toFixed(2)}</span>
              </div>
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
              {submitting ? "Processing…" : side === "buy" ? "BUY USDT" : "SELL USDT"}
            </button>

            <p className="text-[10px] text-muted-foreground text-center">
              Internal market · Rate set by platform · Instant settlement
            </p>
          </div>
        </motion.div>

        {/* ── Open Orders / History ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="rounded-2xl border border-white/8 bg-[#0a0d14] overflow-hidden"
        >
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-white/5">
            {[
              { key: "open", label: "Open Orders", count: openOrders.length },
              { key: "history", label: "Order History" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setOpenTab(tab.key as "open" | "history")}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-all ${
                  openTab === tab.key
                    ? "text-white border-amber-400"
                    : "text-muted-foreground border-transparent hover:text-white"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {openTab === "open" ? (
              <motion.div key="open" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {openOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <Clock className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No open orders</p>
                    <p className="text-xs opacity-60">Place a limit order to see it here</p>
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div className="grid grid-cols-5 text-[10px] text-muted-foreground px-4 pt-3 pb-1">
                      <span>Type</span>
                      <span className="text-center">Amount</span>
                      <span className="text-center">Limit Price</span>
                      <span className="text-center">Total (INR)</span>
                      <span className="text-right">Action</span>
                    </div>
                    {openOrders.map(order => (
                      <div key={order.id} className="grid grid-cols-5 items-center px-4 py-2.5 border-t border-white/5 text-xs hover:bg-white/[0.02] transition-colors">
                        <div className="flex flex-col">
                          <span className={`font-bold uppercase ${order.direction === "buy" ? "text-emerald-400" : "text-rose-400"}`}>
                            {order.direction === "buy" ? "Limit Buy" : "Limit Sell"}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <span className="text-center font-medium text-white tabular-nums">
                          {order.usdt.toFixed(4)} USDT
                        </span>
                        <span className="text-center tabular-nums text-amber-300 font-medium">
                          ₹{order.limitPrice?.toFixed(2) ?? "—"}
                        </span>
                        <span className="text-center tabular-nums text-white/70">
                          {order.inr ? `₹${order.inr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                        </span>
                        <div className="flex justify-end">
                          <button
                            onClick={() => cancelMutation.mutate(order.id)}
                            disabled={cancelMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[11px] font-medium transition-all disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <CheckCircle2 className="w-8 h-8 opacity-30" />
                  <p className="text-sm">View your full order history</p>
                  <Link href="/transactions">
                    <span className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer transition-colors">
                      Go to Transaction History →
                    </span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      </div>
    </Layout>
  );
}
