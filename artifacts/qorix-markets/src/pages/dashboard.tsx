import { useGetDashboardSummary, useGetEquityChart, useGetTrades } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Wallet, Activity, Clock, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: equity, isLoading: equityLoading } = useGetEquityChart();
  const { data: tradesData, isLoading: tradesLoading } = useGetTrades({ limit: 5 });

  const trades = Array.isArray(tradesData) ? tradesData : [];

  return (
    <Layout>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">Welcome back. Here is your portfolio summary.</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <span className="text-muted-foreground">Live Data Feed Active</span>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">Total Equity</span>
              <Wallet className="w-4 h-4" />
            </div>
            {summaryLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold">
                <AnimatedCounter value={summary?.totalBalance || 0} prefix="$" />
              </div>
            )}
          </div>

          <div className="glass-card p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">Daily P&L</span>
              <Activity className="w-4 h-4" />
            </div>
            {summaryLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="flex items-end gap-2">
                <div className={`text-2xl font-bold ${(summary?.dailyProfitLoss || 0) >= 0 ? "profit-text" : "loss-text"}`}>
                  {(summary?.dailyProfitLoss || 0) >= 0 ? "+" : ""}
                  <AnimatedCounter value={summary?.dailyProfitLoss || 0} prefix="$" />
                </div>
                <div className={`text-sm mb-1 ${(summary?.dailyProfitPercent || 0) >= 0 ? "profit-text" : "loss-text"}`}>
                  ({(summary?.dailyProfitPercent || 0) >= 0 ? "+" : ""}{summary?.dailyProfitPercent || 0}%)
                </div>
              </div>
            )}
          </div>

          <div className="glass-card p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">Active Investment</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            {summaryLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold">
                <AnimatedCounter value={summary?.activeInvestment || 0} prefix="$" />
                {summary?.isTrading && (
                  <span className="ml-2 text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full align-middle">
                    {summary?.riskLevel} Risk
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="glass-card p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-sm font-medium">Total Profit</span>
              <Activity className="w-4 h-4" />
            </div>
            {summaryLoading ? <Skeleton className="h-8 w-32" /> : (
              <div className="text-2xl font-bold profit-text">
                +<AnimatedCounter value={summary?.totalProfit || 0} prefix="$" />
              </div>
            )}
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-5 rounded-xl col-span-1 lg:col-span-2 flex flex-col h-[400px]">
            <h3 className="font-semibold mb-4">Equity Curve</h3>
            <div className="flex-1 min-h-0">
              {equityLoading ? (
                <div className="w-full h-full flex items-center justify-center">
                  <Skeleton className="w-full h-full rounded-lg" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equity || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(val) => format(new Date(val), "MMM dd")} 
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={12} 
                      tickFormatter={(val) => `$${val}`} 
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
                      labelFormatter={(label) => format(new Date(label), "MMM dd, yyyy")}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="equity" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorEquity)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass-card p-5 rounded-xl flex flex-col h-[400px]">
            <h3 className="font-semibold mb-4">Recent Trades</h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {tradesLoading ? (
                Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
              ) : trades.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <p>No recent trades</p>
                </div>
              ) : (
                trades.map(trade => (
                  <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {trade.symbol}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm uppercase ${trade.direction === 'LONG' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                          {trade.direction}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(trade.executedAt), "MMM dd, HH:mm")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${trade.profit >= 0 ? 'profit-text' : 'loss-text'} flex items-center justify-end gap-1`}>
                        {trade.profit >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        ${Math.abs(trade.profit).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {trade.profitPercent > 0 ? '+' : ''}{trade.profitPercent}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </motion.div>
    </Layout>
  );
}
