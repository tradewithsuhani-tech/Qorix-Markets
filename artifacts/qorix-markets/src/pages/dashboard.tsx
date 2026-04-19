import { useGetDashboardSummary, useGetEquityChart, useGetTrades } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter, BigBalanceCounter } from "@/components/animated-counter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, Clock, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
  type ChartData,
  type ChartOptions
} from "chart.js";
import { Line } from "react-chartjs-2";

Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, ChartTooltip);

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary({ 
    query: { refetchInterval: 5000 } 
  });
  const { data: equity, isLoading: equityLoading } = useGetEquityChart();
  const { data: tradesData, isLoading: tradesLoading } = useGetTrades(
    { limit: 5 },
    { query: { refetchInterval: 5000 } }
  );

  const trades = Array.isArray(tradesData) ? tradesData : [];
  const equityArr = Array.isArray(equity) ? equity : [];

  const chartData: ChartData<"line"> = {
    labels: equityArr.map(e => format(new Date(e.date), "MMM dd")),
    datasets: [
      {
        data: equityArr.map(e => e.equity),
        borderColor: "rgba(96, 165, 250, 1)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: "rgba(96, 165, 250, 1)",
        fill: true,
        backgroundColor: (ctx: any) => {
          const canvas = ctx.chart.ctx;
          const gradient = canvas.createLinearGradient(0, 0, 0, ctx.chart.height);
          gradient.addColorStop(0, "rgba(96, 165, 250, 0.25)");
          gradient.addColorStop(1, "rgba(96, 165, 250, 0.00)");
          return gradient;
        },
        tension: 0.4,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(9, 11, 28, 0.95)",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        titleColor: "#94a3b8",
        bodyColor: "#fff",
        padding: 12,
        callbacks: {
          label: (ctx) => ` $${ctx.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 11 }, maxRotation: 0 },
        border: { display: false },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: { 
          color: "#64748b", 
          font: { size: 11 }, 
          callback: (v) => `$${Number(v).toLocaleString()}` 
        },
        border: { display: false },
      },
    },
  };

  const dailyPL = summary?.dailyProfitLoss || 0;
  const dailyPct = summary?.dailyProfitPercent || 0;
  const isPositive = dailyPL >= 0;

  const statCards = [
    {
      label: "Total Equity",
      icon: <Wallet style={{ width: 15, height: 15 }} />,
      value: <BigBalanceCounter value={summary?.totalBalance || 0} className="text-2xl" />,
      sub: null,
      accent: "blue",
    },
    {
      label: "Daily P&L",
      icon: isPositive 
        ? <TrendingUp style={{ width: 15, height: 15 }} className="text-green-400" />
        : <TrendingDown style={{ width: 15, height: 15 }} className="text-red-400" />,
      value: (
        <span className={`text-2xl font-bold ${isPositive ? "profit-text" : "loss-text"}`}>
          {isPositive ? "+" : ""}<AnimatedCounter value={Math.abs(dailyPL)} prefix="$" />
        </span>
      ),
      sub: (
        <span className={`text-xs font-medium flex items-center gap-1 ${isPositive ? "profit-text" : "loss-text"}`}>
          {isPositive ? <ArrowUpRight style={{ width: 12, height: 12 }} /> : <ArrowDownRight style={{ width: 12, height: 12 }} />}
          {isPositive ? "+" : ""}{dailyPct}% today
        </span>
      ),
      accent: isPositive ? "green" : "red",
    },
    {
      label: "Active Investment",
      icon: <Zap style={{ width: 15, height: 15 }} />,
      value: <BigBalanceCounter value={summary?.activeInvestment || 0} className="text-2xl" />,
      sub: summary?.isTrading ? (
        <span className="text-xs px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-full">
          {summary?.riskLevel} Risk
        </span>
      ) : <span className="text-xs text-muted-foreground">Not active</span>,
      accent: "blue",
    },
    {
      label: "Total Profit",
      icon: <Activity style={{ width: 15, height: 15 }} className="text-green-400" />,
      value: (
        <span className="text-2xl font-bold profit-text">
          +<AnimatedCounter value={summary?.totalProfit || 0} prefix="$" />
        </span>
      ),
      sub: <span className="text-xs text-muted-foreground">All time earnings</span>,
      accent: "green",
    },
  ];

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Portfolio performance dashboard</p>
          </div>
          <div className="flex items-center gap-2 text-sm bg-green-500/5 border border-green-500/15 rounded-full px-3 py-1.5 w-fit">
            <span className="live-dot" />
            <span className="text-green-400 font-medium text-xs">Live · Updates every 5s</span>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
              className="stat-card p-4 md:p-5 rounded-2xl space-y-2"
            >
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
                {card.icon}
              </div>
              {summaryLoading ? (
                <Skeleton className="h-7 w-28" />
              ) : (
                <div className="font-bold leading-tight">{card.value}</div>
              )}
              {card.sub && !summaryLoading && <div>{card.sub}</div>}
            </motion.div>
          ))}
        </div>

        {/* Chart + Trades */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="glass-card p-5 rounded-2xl col-span-1 lg:col-span-2 flex flex-col"
            style={{ minHeight: 360 }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-semibold">Equity Curve</h3>
                <p className="text-xs text-muted-foreground">30-day performance</p>
              </div>
              <div className="text-xs text-muted-foreground bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
                30D
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: 280 }}>
              {equityLoading ? (
                <div className="w-full h-full flex items-end gap-1 pb-2">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex-1 bg-white/5 rounded-t" style={{ height: `${30 + Math.random() * 60}%` }} />
                  ))}
                </div>
              ) : (
                <Line data={chartData} options={chartOptions} />
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.4 }}
            className="glass-card p-5 rounded-2xl flex flex-col"
            style={{ minHeight: 360 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Recent Trades</h3>
              <span className="text-[10px] text-muted-foreground bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">LIVE</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {tradesLoading ? (
                Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)
              ) : trades.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Clock style={{ width: 28, height: 28 }} className="mb-2 opacity-30" />
                  <p className="text-sm">No trades yet</p>
                </div>
              ) : (
                trades.map((trade, i) => (
                  <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-8 rounded-full ${trade.direction === 'LONG' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {trade.symbol}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${trade.direction === 'LONG' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
                            {trade.direction}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {format(new Date(trade.executedAt), "MMM dd, HH:mm")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold text-sm ${trade.profit >= 0 ? 'profit-text' : 'loss-text'} flex items-center justify-end gap-0.5`}>
                        {trade.profit >= 0 ? <ArrowUpRight style={{ width: 13, height: 13 }} /> : <ArrowDownRight style={{ width: 13, height: 13 }} />}
                        ${Math.abs(trade.profit).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {trade.profitPercent > 0 ? '+' : ''}{trade.profitPercent}%
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>

      </motion.div>
    </Layout>
  );
}
