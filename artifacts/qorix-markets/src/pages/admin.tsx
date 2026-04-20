import { useGetAdminStats, useGetPendingWithdrawals, useApproveWithdrawal, useRejectWithdrawal, useSetDailyProfit, useSetInvestorSlots } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { motion } from "framer-motion";
import {
  Users, Activity, Wallet, CheckCircle, XCircle, ArrowUpFromLine, Layers,
  Server, Cpu, HardDrive, Zap, Bell, Globe, Shield, TrendingUp, MessageCircle, Brain,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetPendingWithdrawalsQueryKey, getGetAdminStatsQueryKey } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

function useSystemHealth() {
  return useQuery({
    queryKey: ["admin-system-health"],
    queryFn: async () => {
      const t = localStorage.getItem("qorix_token");
      const res = await fetch("/api/admin/system-health", { headers: t ? { Authorization: `Bearer ${t}` } : {} });
      if (!res.ok) throw new Error("failed");
      return res.json();
    },
    refetchInterval: 30000,
  });
}

const QUICK_LINKS = [
  { href: "/admin/users", icon: Users, label: "Users", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { href: "/admin/deposits", icon: ArrowUpFromLine, label: "Deposits", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { href: "/admin/withdrawals", icon: Wallet, label: "Withdrawals", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { href: "/admin/intelligence", icon: Brain, label: "Intelligence", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  { href: "/admin/communication", icon: Bell, label: "Communication", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  { href: "/admin/content", icon: Globe, label: "Content", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { href: "/admin/fraud", icon: Shield, label: "Fraud Monitor", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  { href: "/admin/chats", icon: MessageCircle, label: "Support", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
];

export default function AdminPage() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: withdrawals, isLoading: wLoading } = useGetPendingWithdrawals();
  const { data: health } = useSystemHealth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [profitInput, setProfitInput] = useState("");
  const [slotsInput, setSlotsInput] = useState("");

  const slotsMutation = useSetInvestorSlots({
    mutation: {
      onSuccess: () => {
        toast({ title: "Investor slots updated" });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        setSlotsInput("");
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const approveMutation = useApproveWithdrawal({
    mutation: {
      onSuccess: () => {
        toast({ title: "Withdrawal approved" });
        queryClient.invalidateQueries({ queryKey: getGetPendingWithdrawalsQueryKey() });
      }
    }
  });

  const rejectMutation = useRejectWithdrawal({
    mutation: {
      onSuccess: () => {
        toast({ title: "Withdrawal rejected" });
        queryClient.invalidateQueries({ queryKey: getGetPendingWithdrawalsQueryKey() });
      }
    }
  });

  const profitMutation = useSetDailyProfit({
    mutation: {
      onSuccess: () => {
        toast({ title: "Daily profit distributed", description: "All active users have been credited." });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
        setProfitInput("");
      },
      onError: (err: any) => {
        toast({ title: "Failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const healthChecks = [
    { key: "database", label: "DB", icon: HardDrive },
    { key: "api", label: "API", icon: Server },
    { key: "profit_worker", label: "Worker", icon: Cpu },
    { key: "blockchain_listener", label: "Chain", icon: Zap },
  ];

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Admin Control Panel</h1>
            <p className="text-muted-foreground">System overview and operations.</p>
          </div>
          {health && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/8 bg-white/3">
              {healthChecks.map(({ key, label, icon: Icon }) => {
                const ok = health?.checks?.[key]?.status === "ok";
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${ok ? "text-emerald-400" : "text-red-400"}`} />
                    <span className={`text-xs font-medium ${ok ? "text-emerald-400" : "text-red-400"}`}>{label}</span>
                    {key !== "blockchain_listener" && <span className="text-white/10 text-xs ml-1">·</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-xl border-primary/20">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" /> Total Users
            </h3>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats?.activeInvestors || 0} active investors</p>
          </div>
          <div className="glass-card p-5 rounded-xl border-primary/20">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Total AUM
            </h3>
            <div className="text-2xl font-bold"><AnimatedCounter value={stats?.totalAUM || 0} prefix="$" /></div>
            <p className="text-xs text-muted-foreground mt-1">{stats?.dailyProfitPercent || 0}% daily rate</p>
          </div>
          <div className="glass-card p-5 rounded-xl border-primary/20">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Profit Paid Out
            </h3>
            <div className="text-2xl font-bold profit-text"><AnimatedCounter value={stats?.totalProfitPaid || 0} prefix="$" /></div>
            <p className="text-xs text-muted-foreground mt-1">all time</p>
          </div>
          <div className="glass-card p-5 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
              <ArrowUpFromLine className="w-4 h-4" /> Pending W/D
            </h3>
            <div className="text-2xl font-bold text-amber-500"><AnimatedCounter value={stats?.pendingWithdrawalAmount || 0} prefix="$" /></div>
            <p className="text-xs text-muted-foreground mt-1">{stats?.pendingWithdrawals || 0} requests pending</p>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Access Modules</div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {QUICK_LINKS.map(({ href, icon: Icon, label, color }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[11px] text-muted-foreground group-hover:text-white text-center leading-tight transition-colors">{label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="glass-card p-6 rounded-xl">
              <h2 className="text-xl font-bold mb-1">Distribute Daily Profit</h2>
              <p className="text-sm text-muted-foreground mb-4">Set the base profit percentage for today.</p>
              <div>
                <label className="text-sm text-muted-foreground">Base %</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    step="0.1"
                    value={profitInput}
                    onChange={(e) => setProfitInput(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-primary"
                    placeholder="e.g. 2.5"
                  />
                  <button
                    onClick={() => profitMutation.mutate({ data: { profitPercent: Number(profitInput) } })}
                    disabled={profitMutation.isPending || !profitInput}
                    className="bg-primary hover:bg-primary/90 text-white px-6 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    Execute
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl border border-amber-500/15">
              <div className="flex items-center gap-2 mb-1">
                <Layers className="w-4 h-4 text-amber-400" />
                <h2 className="text-xl font-bold">Investor Slots</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Limit the number of active investors. Set to 0 to disable the limit.</p>
              <div className="flex items-center justify-between mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/8">
                <div>
                  <div className="text-xs text-muted-foreground">Current status</div>
                  <div className="font-semibold text-sm mt-0.5">
                    {stats?.maxSlots === 0
                      ? <span className="text-green-400">Unlimited</span>
                      : stats?.isFull
                      ? <span className="text-red-400">Full — {stats.activeInvestors}/{stats.maxSlots}</span>
                      : <span className="text-amber-400">{stats?.availableSlots ?? "—"} of {stats?.maxSlots} remaining</span>
                    }
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Active</div>
                  <div className="text-xl font-bold">{stats?.activeInvestors ?? "—"}</div>
                </div>
              </div>
              {stats?.maxSlots !== undefined && stats.maxSlots > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Capacity</span>
                    <span>{stats.activeInvestors}/{stats.maxSlots} filled</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (stats.activeInvestors / stats.maxSlots) * 100)}%`,
                        background: stats.isFull ? "#ef4444" : "linear-gradient(90deg, #f59e0b, #f97316)"
                      }}
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground">New Max Slots</label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={slotsInput}
                    onChange={(e) => setSlotsInput(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-amber-500"
                    placeholder="e.g. 50 (0 = unlimited)"
                  />
                  <button
                    onClick={() => slotsMutation.mutate({ data: { maxSlots: parseInt(slotsInput) } })}
                    disabled={slotsMutation.isPending || slotsInput === ""}
                    className="bg-amber-500 hover:bg-amber-500/90 text-black px-4 rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                  >
                    {slotsMutation.isPending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden flex flex-col h-[480px]">
            <div className="p-6 border-b border-white/10 shrink-0 flex items-center justify-between">
              <h2 className="text-xl font-bold">Pending Withdrawals</h2>
              {stats?.pendingWithdrawals ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-semibold">
                  {stats.pendingWithdrawals} pending
                </span>
              ) : null}
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 border-b border-white/10 sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-4 py-3 font-medium text-muted-foreground">User</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Address</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {wLoading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : (!withdrawals || withdrawals.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <CheckCircle className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
                        <div className="text-muted-foreground text-sm">No pending requests.</div>
                      </td>
                    </tr>
                  ) : (
                    withdrawals.map((req) => (
                      <tr key={req.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium">{req.userFullName}</div>
                          <div className="text-xs text-muted-foreground">{format(new Date(req.requestedAt), "MMM dd, HH:mm")}</div>
                        </td>
                        <td className="px-4 py-3 font-bold font-mono text-amber-500">
                          ${req.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[150px]" title={req.walletAddress}>
                          {req.walletAddress}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => approveMutation.mutate({ id: req.id, data: {} })}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              className="p-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded disabled:opacity-50 transition-colors"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => rejectMutation.mutate({ id: req.id, data: {} })}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded disabled:opacity-50 transition-colors"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
