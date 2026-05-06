import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Plus,
  X,
  Wallet as WalletIcon,
  ShieldAlert,
  Activity,
} from "lucide-react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import { Layout } from "@/components/layout";

// ─────────────────────────────────────────────────────────────────────
// Live market catalog — Binance public REST + WebSocket (no API key)
// ─────────────────────────────────────────────────────────────────────
type Pair = {
  symbol: string;       // display: "BTC/USDT"
  binance: string;      // "BTCUSDT"
  digits: number;       // price decimals
  step: number;         // min price tick
  contract: number;     // 1 unit = 1 coin
  minLots: number;
  lotStep: number;
  defLots: number;
};

const PAIRS: Pair[] = [
  { symbol: "BTC/USDT",  binance: "BTCUSDT",  digits: 2, step: 0.01, contract: 1, minLots: 0.001, lotStep: 0.001, defLots: 0.01 },
  { symbol: "ETH/USDT",  binance: "ETHUSDT",  digits: 2, step: 0.01, contract: 1, minLots: 0.01,  lotStep: 0.01,  defLots: 0.1  },
  { symbol: "BNB/USDT",  binance: "BNBUSDT",  digits: 2, step: 0.01, contract: 1, minLots: 0.01,  lotStep: 0.01,  defLots: 0.5  },
  { symbol: "SOL/USDT",  binance: "SOLUSDT",  digits: 2, step: 0.01, contract: 1, minLots: 0.1,   lotStep: 0.1,   defLots: 1    },
  { symbol: "XRP/USDT",  binance: "XRPUSDT",  digits: 4, step: 0.0001, contract: 1, minLots: 1,   lotStep: 1,     defLots: 10   },
  { symbol: "DOGE/USDT", binance: "DOGEUSDT", digits: 5, step: 0.00001, contract: 1, minLots: 10, lotStep: 10,    defLots: 100  },
];

type TF = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";
const TF_LIST: TF[] = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"];
const TF_SECONDS: Record<TF, number> = {
  "1m": 60, "5m": 300, "15m": 900, "30m": 1800, "1h": 3600, "4h": 14400, "1d": 86400,
};

// ─────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────
type Position = {
  id: string;
  pair: string;
  side: "BUY" | "SELL";
  lots: number;
  entry: number;
  sl: number | null;
  tp: number | null;
  openedAt: number;
  contract: number;
};
type ClosedPosition = Position & { closedAt: number; exit: number; pnl: number; reason: "manual" | "sl" | "tp" };

const fmtMoney = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPx = (n: number, d: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ─────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────
export default function SelfTradePage() {
  const [pair, setPair] = useState<Pair>(PAIRS[0]);
  const [tf, setTf] = useState<TF>("1m");
  const [pairOpen, setPairOpen] = useState(false);

  // Live data
  const [candles, setCandles] = useState<CandlestickData[]>([]);
  const [livePx, setLivePx] = useState<number>(0);
  const [stats, setStats] = useState<{ o: number; h: number; l: number; c: number; chg: number; chgPct: number }>({
    o: 0, h: 0, l: 0, c: 0, chg: 0, chgPct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch initial candles + open WS ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);

    fetch(`https://api.binance.com/api/v3/klines?symbol=${pair.binance}&interval=${tf}&limit=500`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows: any[]) => {
        if (cancelled) return;
        const cs: CandlestickData[] = rows.map((k) => ({
          time: Math.floor(k[0] / 1000) as UTCTimestamp,
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
        }));
        setCandles(cs);
        const last = cs[cs.length - 1];
        const first = cs[0];
        if (last && first) {
          const chg = last.close - first.open;
          setStats({
            o: first.open,
            h: Math.max(...cs.map((c) => c.high)),
            l: Math.min(...cs.map((c) => c.low)),
            c: last.close,
            chg,
            chgPct: (chg / first.open) * 100,
          });
          setLivePx(last.close);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setErr(e?.message || "Failed to load market data");
          setLoading(false);
        }
      });

    // WebSocket live kline
    try {
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/${pair.binance.toLowerCase()}@kline_${tf}`
      );
      wsRef.current = ws;
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const k = msg?.k;
          if (!k) return;
          const c: CandlestickData = {
            time: Math.floor(k.t / 1000) as UTCTimestamp,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          };
          setLivePx(c.close);
          if (seriesRef.current) {
            seriesRef.current.update(c);
          }
          setCandles((prev) => {
            if (!prev.length) return [c];
            const last = prev[prev.length - 1];
            if ((last.time as number) === (c.time as number)) {
              const next = prev.slice();
              next[next.length - 1] = c;
              return next;
            }
            return [...prev, c];
          });
          setStats((s) => ({
            ...s,
            c: c.close,
            h: Math.max(s.h, c.high),
            l: s.l ? Math.min(s.l, c.low) : c.low,
            chg: c.close - s.o,
            chgPct: s.o > 0 ? ((c.close - s.o) / s.o) * 100 : 0,
          }));
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}

    return () => {
      cancelled = true;
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, [pair.binance, tf]);

  // ── Mount lightweight-chart ──
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const chart = createChart(el, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255,255,255,0.65)",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        textColor: "rgba(255,255,255,0.85)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 8,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(99,179,237,0.45)", style: 2, labelBackgroundColor: "#1e3a5f" },
        horzLine: { color: "rgba(99,179,237,0.45)", style: 2, labelBackgroundColor: "#1e3a5f" },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22d3ee",
      downColor: "#f43f5e",
      borderUpColor: "#22d3ee",
      borderDownColor: "#f43f5e",
      wickUpColor: "#67e8f9",
      wickDownColor: "#fb7185",
      priceFormat: { type: "price", precision: pair.digits, minMove: pair.step },
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [pair.binance, pair.digits, pair.step]);

  // ── Push candles to series whenever data is reset ──
  useEffect(() => {
    if (seriesRef.current && candles.length) {
      seriesRef.current.setData(candles);
      chartRef.current?.timeScale().fitContent();
    }
  }, [pair.binance, tf]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Order ticket state ──
  const [lots, setLots] = useState<number>(pair.defLots);
  const [slPx, setSlPx] = useState<string>("");
  const [tpPx, setTpPx] = useState<string>("");

  useEffect(() => {
    setLots(pair.defLots);
    setSlPx("");
    setTpPx("");
  }, [pair.symbol, pair.defLots]);

  // ── Account ──
  const [balance, setBalance] = useState<number>(() => {
    try {
      const v = localStorage.getItem("qx-self-trade-balance");
      return v ? +v : 10000;
    } catch { return 10000; }
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [closed, setClosed] = useState<ClosedPosition[]>([]);
  const [tab, setTab] = useState<"open" | "closed">("open");

  useEffect(() => {
    try { localStorage.setItem("qx-self-trade-balance", String(balance)); } catch {}
  }, [balance]);

  // floating P&L per position
  const pnlOf = useCallback(
    (p: Position) => {
      if (!livePx) return 0;
      const dir = p.side === "BUY" ? 1 : -1;
      return +(dir * (livePx - p.entry) * p.lots * p.contract).toFixed(2);
    },
    [livePx]
  );

  const openPnl = useMemo(
    () => positions.reduce((s, p) => s + pnlOf(p), 0),
    [positions, pnlOf]
  );
  const equity = +(balance + openPnl).toFixed(2);

  // ── Auto-close on SL/TP hit (real price triggers) ──
  useEffect(() => {
    if (!livePx || positions.length === 0) return;
    const now = Date.now();
    const toClose: { p: Position; reason: "sl" | "tp"; exit: number }[] = [];
    for (const p of positions) {
      if (p.side === "BUY") {
        if (p.sl !== null && livePx <= p.sl) toClose.push({ p, reason: "sl", exit: p.sl });
        else if (p.tp !== null && livePx >= p.tp) toClose.push({ p, reason: "tp", exit: p.tp });
      } else {
        if (p.sl !== null && livePx >= p.sl) toClose.push({ p, reason: "sl", exit: p.sl });
        else if (p.tp !== null && livePx <= p.tp) toClose.push({ p, reason: "tp", exit: p.tp });
      }
    }
    if (toClose.length === 0) return;
    setPositions((ps) => ps.filter((x) => !toClose.find((c) => c.p.id === x.id)));
    setClosed((cs) => [
      ...toClose.map(({ p, reason, exit }) => {
        const dir = p.side === "BUY" ? 1 : -1;
        const pnl = +(dir * (exit - p.entry) * p.lots * p.contract).toFixed(2);
        return { ...p, closedAt: now, exit, pnl, reason };
      }),
      ...cs,
    ]);
    setBalance((b) =>
      +(b + toClose.reduce((s, { p, exit }) => {
        const dir = p.side === "BUY" ? 1 : -1;
        return s + dir * (exit - p.entry) * p.lots * p.contract;
      }, 0)).toFixed(2)
    );
  }, [livePx, positions]);

  // ── Place / close orders ──
  const placeOrder = (side: "BUY" | "SELL") => {
    if (!livePx) return;
    const entry = livePx;
    const slRaw = parseFloat(slPx);
    const tpRaw = parseFloat(tpPx);
    const sl = isFinite(slRaw) && slRaw > 0 ? +slRaw.toFixed(pair.digits) : null;
    const tp = isFinite(tpRaw) && tpRaw > 0 ? +tpRaw.toFixed(pair.digits) : null;
    setPositions((ps) => [
      ...ps,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pair: pair.symbol,
        side,
        lots,
        entry,
        sl,
        tp,
        openedAt: Date.now(),
        contract: pair.contract,
      },
    ]);
  };

  const closePosition = (id: string, reason: ClosedPosition["reason"] = "manual") => {
    const p = positions.find((x) => x.id === id);
    if (!p || !livePx) return;
    const dir = p.side === "BUY" ? 1 : -1;
    const pnl = +(dir * (livePx - p.entry) * p.lots * p.contract).toFixed(2);
    setPositions((ps) => ps.filter((x) => x.id !== id));
    setClosed((cs) => [{ ...p, closedAt: Date.now(), exit: livePx, pnl, reason }, ...cs]);
    setBalance((b) => +(b + pnl).toFixed(2));
  };

  const closeAll = () => positions.forEach((p) => closePosition(p.id, "manual"));

  const resetBalance = () => {
    if (positions.length > 0) return;
    setBalance(10000);
    setClosed([]);
  };

  // ── Render ──
  return (
    <Layout>
      <div className="min-h-screen px-3 py-4 sm:px-5 sm:py-6 max-w-[1500px] mx-auto">
        {/* Beta banner */}
        <div className="mb-3 rounded-xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3 py-2 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-300" />
          <div className="text-[11px] sm:text-xs text-amber-200/90 font-mono leading-tight">
            <span className="font-semibold">BETA — Demo trading only.</span>{" "}
            <span className="text-amber-100/70">
              Real-time market prices · Virtual ${balance.toLocaleString()} balance · No real funds at risk.
            </span>
          </div>
        </div>

        {/* Top bar: pair selector + TF + stats */}
        <div className="mb-3 rounded-2xl border border-white/8 bg-white/[0.02] p-2 sm:p-3 flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative">
            <button
              onClick={() => setPairOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 hover:border-cyan-400/40"
            >
              <span className="font-mono font-semibold text-sm">{pair.symbol}</span>
              <ChevronDown />
            </button>
            <AnimatePresence>
              {pairOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-30 mt-1 w-48 rounded-xl border border-white/10 bg-[#0a1628] shadow-xl shadow-black/40 overflow-hidden"
                >
                  {PAIRS.map((p) => (
                    <button
                      key={p.symbol}
                      onClick={() => { setPair(p); setPairOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm font-mono hover:bg-white/[0.04] ${
                        p.symbol === pair.symbol ? "text-cyan-300 bg-cyan-500/5" : "text-white/85"
                      }`}
                    >
                      {p.symbol}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* TF selector */}
          <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1">
            {TF_LIST.map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition ${
                  tf === t
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-400/30"
                    : "text-white/55 hover:text-white/85"
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>

          {/* OHLC + change */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4 text-[11px] font-mono tabular-nums">
            <Stat label="O" value={fmtPx(stats.o, pair.digits)} />
            <Stat label="H" value={fmtPx(stats.h, pair.digits)} tone="emerald" />
            <Stat label="L" value={fmtPx(stats.l, pair.digits)} tone="rose" />
            <Stat label="C" value={fmtPx(stats.c, pair.digits)} tone="cyan" />
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                stats.chg >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
              }`}
            >
              {stats.chg >= 0 ? "+" : ""}{fmtPx(stats.chg, pair.digits)} ({stats.chgPct >= 0 ? "+" : ""}{stats.chgPct.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_300px] gap-3">
          {/* Chart + positions */}
          <div className="flex flex-col gap-3">
            {/* Live price big */}
            <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.03] to-transparent p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">Live Price</div>
                <div className="font-mono tabular-nums text-2xl sm:text-3xl font-bold text-white">
                  {livePx ? fmtPx(livePx, pair.digits) : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${err ? "bg-rose-400" : loading ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`} />
                  <span className="text-white/55">
                    {err ? "Disconnected" : loading ? "Loading…" : "Live · Binance"}
                  </span>
                </span>
              </div>
            </div>

            {/* Chart container */}
            <div className="rounded-2xl border border-white/8 bg-[#070c16] overflow-hidden">
              <div ref={containerRef} className="w-full h-[420px] sm:h-[500px]" />
            </div>

            {/* Positions */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTab("open")}
                    className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded-lg ${
                      tab === "open" ? "bg-white/10 text-white" : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    Open ({positions.length})
                  </button>
                  <button
                    onClick={() => setTab("closed")}
                    className={`px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider rounded-lg ${
                      tab === "closed" ? "bg-white/10 text-white" : "text-white/45 hover:text-white/75"
                    }`}
                  >
                    History ({closed.length})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {tab === "open" && positions.length > 0 && (
                    <>
                      <span className={`text-[11px] font-mono font-semibold ${openPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        Net {fmtMoney(openPnl)}
                      </span>
                      <button
                        onClick={closeAll}
                        className="px-2.5 py-1 rounded-md text-[10.5px] font-mono uppercase tracking-wider border border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
                      >
                        Close All
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
                {tab === "open" && positions.length === 0 && (
                  <div className="px-3 py-8 text-center text-[12px] font-mono text-white/35">No open positions</div>
                )}
                {tab === "open" && positions.map((p) => {
                  const pnl = pnlOf(p);
                  return (
                    <div key={p.id} className="px-3 py-2 grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-[11.5px] font-mono">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        p.side === "BUY" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
                      }`}>{p.side}</span>
                      <div>
                        <div className="text-white/85">{p.pair} · {p.lots} lot</div>
                        <div className="text-[10px] text-white/40">
                          @ {fmtPx(p.entry, pair.digits)}
                          {p.sl !== null && <span className="text-rose-300/70"> · SL {fmtPx(p.sl, pair.digits)}</span>}
                          {p.tp !== null && <span className="text-emerald-300/70"> · TP {fmtPx(p.tp, pair.digits)}</span>}
                        </div>
                      </div>
                      <span className={`tabular-nums font-semibold ${pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                        {fmtMoney(pnl)}
                      </span>
                      <button
                        onClick={() => closePosition(p.id)}
                        className="px-2 py-0.5 rounded text-[10px] uppercase border border-white/15 text-white/65 hover:bg-white/5"
                      >
                        Close
                      </button>
                    </div>
                  );
                })}
                {tab === "closed" && closed.length === 0 && (
                  <div className="px-3 py-8 text-center text-[12px] font-mono text-white/35">No history yet</div>
                )}
                {tab === "closed" && closed.map((p) => (
                  <div key={p.id} className="px-3 py-2 grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-[11.5px] font-mono">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      p.side === "BUY" ? "bg-emerald-500/10 text-emerald-300/80" : "bg-rose-500/10 text-rose-300/80"
                    }`}>{p.side}</span>
                    <div>
                      <div className="text-white/75">{p.pair} · {p.lots} lot</div>
                      <div className="text-[10px] text-white/40">
                        {fmtPx(p.entry, pair.digits)} → {fmtPx(p.exit, pair.digits)} · {p.reason.toUpperCase()}
                      </div>
                    </div>
                    <span className={`tabular-nums font-semibold ${p.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {fmtMoney(p.pnl)}
                    </span>
                    <span className="text-[10px] text-white/35">{new Date(p.closedAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Order ticket sidebar */}
          <div className="space-y-3">
            {/* Account */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-2">
                <WalletIcon className="w-3.5 h-3.5 text-cyan-300" />
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">Demo Account</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <Snap label="Balance" value={fmtMoney(balance)} />
                <Snap label="Equity" value={fmtMoney(equity)} tone={openPnl >= 0 ? "emerald" : "rose"} />
                <Snap label="Floating" value={fmtMoney(openPnl)} tone={openPnl >= 0 ? "emerald" : "rose"} />
                <Snap label="Positions" value={String(positions.length)} />
              </div>
              {positions.length === 0 && balance !== 10000 && (
                <button
                  onClick={resetBalance}
                  className="mt-2 w-full text-[10px] font-mono uppercase tracking-wider py-1 rounded-md border border-white/10 text-white/55 hover:text-white/85 hover:border-white/25"
                >
                  Reset Demo Balance
                </button>
              )}
            </div>

            {/* Ticket */}
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/45">New Order</span>
                <span className="text-[10px] font-mono text-white/45">{pair.symbol}</span>
              </div>

              {/* Lots */}
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-white/45 mb-1.5">Volume (lots)</div>
                <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                  <button
                    onClick={() => setLots((v) => Math.max(pair.minLots, +(v - pair.lotStep).toFixed(4)))}
                    className="px-3 py-2 text-white/65 hover:bg-white/5"
                  ><Minus className="w-3.5 h-3.5" /></button>
                  <input
                    type="number"
                    step={pair.lotStep}
                    min={pair.minLots}
                    value={lots}
                    onChange={(e) => setLots(Math.max(pair.minLots, +e.target.value || pair.minLots))}
                    className="flex-1 bg-transparent text-center text-sm font-mono tabular-nums outline-none"
                  />
                  <button
                    onClick={() => setLots((v) => +(v + pair.lotStep).toFixed(4))}
                    className="px-3 py-2 text-white/65 hover:bg-white/5"
                  ><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* SL / TP price inputs with autofill on focus */}
              <div className="grid grid-cols-2 gap-2">
                <SlTpInput label="Stop Loss" value={slPx} onChange={setSlPx} tone="rose" live={livePx} digits={pair.digits} />
                <SlTpInput label="Take Profit" value={tpPx} onChange={setTpPx} tone="emerald" live={livePx} digits={pair.digits} />
              </div>

              {/* Buy / Sell */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => placeOrder("SELL")}
                  disabled={!livePx}
                  className="rounded-xl py-2.5 font-bold text-sm bg-rose-500/15 text-rose-300 border border-rose-400/30 hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center"
                >
                  <span className="flex items-center gap-1"><ArrowDown className="w-3.5 h-3.5" /> SELL</span>
                  <span className="text-[10px] font-mono opacity-80">{livePx ? fmtPx(livePx, pair.digits) : "—"}</span>
                </button>
                <button
                  onClick={() => placeOrder("BUY")}
                  disabled={!livePx}
                  className="rounded-xl py-2.5 font-bold text-sm bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center"
                >
                  <span className="flex items-center gap-1"><ArrowUp className="w-3.5 h-3.5" /> BUY</span>
                  <span className="text-[10px] font-mono opacity-80">{livePx ? fmtPx(livePx, pair.digits) : "—"}</span>
                </button>
              </div>

              <div className="text-[9.5px] font-mono text-white/35 leading-snug">
                Orders execute instantly at live price · SL/TP auto-close when crossed.
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────
function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" | "cyan" }) {
  const c = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : tone === "cyan" ? "text-cyan-300" : "text-white/85";
  return (
    <span className="hidden sm:inline-flex items-center gap-1">
      <span className="text-white/40">{label}</span>
      <span className={`font-semibold ${c}`}>{value}</span>
    </span>
  );
}

function Snap({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  const c = tone === "emerald" ? "text-emerald-300" : tone === "rose" ? "text-rose-300" : "text-white/90";
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/5 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.14em] text-white/40">{label}</div>
      <div className={`tabular-nums font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function SlTpInput({
  label,
  value,
  onChange,
  tone,
  live,
  digits,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  tone: "rose" | "emerald";
  live: number;
  digits: number;
}) {
  const color =
    tone === "rose"
      ? "text-rose-300/90 border-rose-400/30 focus-within:border-rose-400/70"
      : "text-emerald-300/90 border-emerald-400/30 focus-within:border-emerald-400/70";
  return (
    <div>
      <div className={`text-[10px] font-mono uppercase tracking-[0.14em] mb-1.5 ${color.split(" ")[0]}`}>
        {label}
      </div>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onFocus={(e) => {
          if ((!value || value === "0") && live > 0) {
            const px = live.toFixed(digits);
            onChange(px);
            const el = e.currentTarget;
            requestAnimationFrame(() => {
              try { el.setSelectionRange(0, px.length); } catch {}
            });
          }
        }}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        placeholder={live > 0 ? live.toFixed(digits) : "—"}
        className={`w-full rounded-xl bg-white/[0.03] border outline-none px-3 py-2 text-sm font-mono tabular-nums ${color}`}
      />
    </div>
  );
}
