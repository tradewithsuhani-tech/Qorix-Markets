import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Calendar, Users, DollarSign,
  ArrowLeft, ChevronDown, ChevronUp, Clock, RefreshCw, BarChart3,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { Link } from "wouter";

type RateMap = { low?: number; medium?: number; high?: number };

type RunRow = {
  id: number;
  runDate: string;
  totalAUM: number;
  totalProfitDistributed: number;
  investorsAffected: number;
  referralBonusPaid: number;
  createdAt: string;
  rates: RateMap;
};

type UpcomingDay = {
  date: string;
  rates: RateMap;
};

type InvestorRow = {
  userId: number;
  email: string;
  fullName: string;
  profitAmount: number;
  riskLevel: string;
  investmentAmount: number;
  referralBonus: number;
};

function RateBadge({ value, risk }: { value?: number; risk: string }) {
  if (value === undefined || value === null) return <span className="text-white/20">—</span>;
  const pos = value >= 0;
  const color =
    risk === "high"
      ? pos ? "text-emerald-400" : "text-red-400"
      : risk === "medium"
      ? pos ? "text-blue-400" : "text-orange-400"
      : pos ? "text-violet-400" : "text-pink-400";
  return (
    <span className={`font-mono text-xs ${color}`}>
      {pos ? "+" : ""}{value.toFixed(3)}%
    </span>
  );
}

function InvestorDrawer({ date, onClose }: { date: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["roi-investors", date],
    queryFn: () =>
      authFetch<{ date: string; investors: InvestorRow[] }>(
        `/api/admin/roi-runs/${date}/investors`,
      ),
  });

  const investors = data?.investors ?? [];
  const totalProfit = investors.reduce((s, i) => s + i.profitAmount, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="border border-white/10 rounded-xl bg-black/30 backdrop-blur-sm overflow-hidden"
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-sm font-medium text-white">Investor Breakdown — {date}</span>
          <span className="text-xs text-white/40">
            ({investors.length} investors · ${totalProfit.toFixed(2)} total)
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          ✕
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-white/30 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : investors.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-sm">
          No investor records found for {date}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] text-white/40 bg-white/3 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-center px-3 py-2">Risk</th>
                <th className="text-right px-3 py-2">Invested</th>
                <th className="text-right px-3 py-2">Profit</th>
                <th className="text-right px-3 py-2">Referral</th>
                <th className="text-right px-3 py-2">Return %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {investors.map((inv) => {
                const pct =
                  inv.investmentAmount > 0
                    ? (inv.profitAmount / inv.investmentAmount) * 100
                    : 0;
                const riskColor =
                  inv.riskLevel === "high"
                    ? "text-red-400"
                    : inv.riskLevel === "medium"
                    ? "text-blue-400"
                    : "text-violet-400";
                const profitPos = inv.profitAmount >= 0;
                return (
                  <tr
                    key={inv.userId}
                    className="text-white/80 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-xs font-medium">
                        {inv.fullName || inv.email.split("@")[0]}
                      </div>
                      <div className="text-[10px] text-white/40">
                        {inv.email} · #{inv.userId}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`text-[10px] font-semibold uppercase ${riskColor}`}>
                        {inv.riskLevel}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-white/60">
                      ${inv.investmentAmount.toFixed(2)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono text-xs font-semibold ${
                        profitPos ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {profitPos ? "+" : ""}${inv.profitAmount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-amber-300/80">
                      {inv.referralBonus > 0 ? `$${inv.referralBonus.toFixed(2)}` : "—"}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono text-xs ${
                        pct >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {pct >= 0 ? "+" : ""}{pct.toFixed(3)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

export default function AdminRoiLogPage() {
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-roi-runs"],
    queryFn: () =>
      authFetch<{ runs: RunRow[]; upcoming: UpcomingDay[] }>("/api/admin/roi-runs"),
    refetchInterval: 120_000,
  });

  const runs = data?.runs ?? [];
  const upcoming = data?.upcoming ?? [];

  const totalDistributed = runs.reduce((s, r) => s + r.totalProfitDistributed, 0);
  const positiveDays = runs.filter((r) => r.totalProfitDistributed >= 0).length;
  const avgDistributed = runs.length > 0 ? totalDistributed / runs.length : 0;
  const totalReferral = runs.reduce((s, r) => s + r.referralBonusPaid, 0);

  const toggleDate = (date: string) => {
    setExpandedDate((prev) => (prev === date ? null : date));
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <button className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30">
            <BarChart3 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">Daily ROI Run Log</h1>
            <p className="text-sm text-white/50">
              Profit distribution history · Cron: 00:05 UTC Mon–Fri (5:35 AM IST)
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Total Runs",
              value: `${runs.length} days`,
              icon: Calendar,
              color: "text-blue-400",
              bg: "bg-blue-500/10 border-blue-500/20",
            },
            {
              label: "Total Distributed",
              value: `$${totalDistributed.toFixed(0)} USDT`,
              icon: DollarSign,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10 border-emerald-500/20",
            },
            {
              label: "Avg / Day",
              value: `$${avgDistributed.toFixed(0)} USDT`,
              icon: TrendingUp,
              color: "text-violet-400",
              bg: "bg-violet-500/10 border-violet-500/20",
            },
            {
              label: "Positive Days",
              value: `${positiveDays} / ${runs.length}`,
              icon: TrendingUp,
              color: "text-amber-400",
              bg: "bg-amber-500/10 border-amber-500/20",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`border rounded-xl p-4 flex items-center gap-3 ${bg}`}>
              <div className={`p-2 rounded-lg bg-white/5 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
                <div className="text-base font-bold text-white">{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming Schedule */}
        {upcoming.length > 0 && (
          <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-300 text-sm font-medium">
              <Clock className="w-4 h-4" /> Upcoming Scheduled Rates
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {upcoming.map(({ date, rates }) => (
                <div key={date} className="border border-white/10 rounded-xl p-3 bg-white/3">
                  <div className="text-xs text-white/70 font-medium mb-2">
                    {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    <span className="text-white/30 ml-1 text-[10px]">{date}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40 uppercase">High</span>
                      <RateBadge value={rates.high} risk="high" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40 uppercase">Medium</span>
                      <RateBadge value={rates.medium} risk="medium" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40 uppercase">Low</span>
                      <RateBadge value={rates.low} risk="low" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Table */}
        <div className="border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 bg-white/3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-white/40" />
              <span className="text-sm font-medium text-white/80">Run History</span>
              {!isLoading && (
                <span className="text-xs text-white/30">({runs.length} records)</span>
              )}
            </div>
            <span className="text-xs text-white/30">Click any row → investor breakdown</span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-white/30 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading run history…
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-16 text-white/30 text-sm">
              No ROI runs recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[10px] text-white/40 bg-white/3 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-4 py-3">Date</th>
                    <th className="text-right px-3 py-3">High</th>
                    <th className="text-right px-3 py-3">Med</th>
                    <th className="text-right px-3 py-3">Low</th>
                    <th className="text-right px-3 py-3">AUM</th>
                    <th className="text-right px-3 py-3">Distributed</th>
                    <th className="text-right px-3 py-3">Investors</th>
                    <th className="text-right px-3 py-3">Referral</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {runs.map((run) => {
                    const isExpanded = expandedDate === run.runDate;
                    const isPos = run.totalProfitDistributed >= 0;
                    return (
                      <>
                        <tr
                          key={run.runDate}
                          onClick={() => toggleDate(run.runDate)}
                          className={`text-white/80 cursor-pointer transition-colors ${
                            isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium text-white">
                              {run.runDate}
                            </div>
                            <div className="text-[10px] text-white/30">
                              {new Date(run.runDate + "T00:00:00").toLocaleDateString(
                                "en-IN",
                                { weekday: "long" },
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            <RateBadge value={run.rates.high} risk="high" />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <RateBadge value={run.rates.medium} risk="medium" />
                          </td>
                          <td className="px-3 py-3 text-right">
                            <RateBadge value={run.rates.low} risk="low" />
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs text-white/60">
                            ${(run.totalAUM / 1000).toFixed(1)}K
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono text-xs font-semibold ${
                              isPos ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {isPos ? "+" : ""}${run.totalProfitDistributed.toFixed(2)}
                          </td>
                          <td className="px-3 py-3 text-right text-white/60">
                            {run.investorsAffected}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-xs text-amber-300/70">
                            {run.referralBonusPaid > 0
                              ? `$${run.referralBonusPaid.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-white/30">
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 inline" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 inline" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${run.runDate}-detail`}>
                            <td colSpan={9} className="px-4 py-3 bg-black/20">
                              <AnimatePresence>
                                <InvestorDrawer
                                  date={run.runDate}
                                  onClose={() => setExpandedDate(null)}
                                />
                              </AnimatePresence>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="text-center text-xs text-white/20 pb-2">
          Total referral bonuses paid across all runs: ${totalReferral.toFixed(2)} USDT
        </div>
      </div>
    </Layout>
  );
}
