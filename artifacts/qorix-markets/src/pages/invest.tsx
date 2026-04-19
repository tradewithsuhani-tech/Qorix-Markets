import { useGetInvestment, useStartInvestment, useStopInvestment, useToggleCompounding, useGetWallet, getGetWalletQueryKey, getGetInvestmentQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldAlert, Zap, Settings, Play, Square, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

export default function InvestPage() {
  const { data: investment, isLoading } = useGetInvestment();
  const { data: wallet } = useGetWallet();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [riskLevel, setRiskLevel] = useState("MEDIUM");

  const startMutation = useStartInvestment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Investment Started", description: "Your automated trading has begun." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setAmount("");
      },
      onError: (err: any) => {
        toast({ title: "Failed to start", description: err.message, variant: "destructive" });
      }
    }
  });

  const stopMutation = useStopInvestment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Investment Stopped", description: "Funds returned to trading balance." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Failed to stop", description: err.message, variant: "destructive" });
      }
    }
  });

  const compoundMutation = useToggleCompounding({
    mutation: {
      onSuccess: () => {
        toast({ title: "Compounding updated" });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
      }
    }
  });

  const riskProfiles = [
    { id: "LOW", name: "Conservative", target: "~3% daily", icon: Shield, color: "text-blue-400", bg: "bg-blue-400/20", border: "border-blue-400/50" },
    { id: "MEDIUM", name: "Balanced", target: "~5% daily", icon: Settings, color: "text-primary", bg: "bg-primary/20", border: "border-primary/50" },
    { id: "HIGH", name: "Aggressive", target: "~10% daily", icon: Zap, color: "text-red-400", bg: "bg-red-400/20", border: "border-red-400/50" },
  ];

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investment Center</h1>
          <p className="text-muted-foreground">Configure and monitor your automated trading algorithms.</p>
        </div>

        {isLoading ? (
          <div>Loading...</div>
        ) : investment?.isActive ? (
          <div className="space-y-6">
            <div className="glass-card-glow p-8 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <span className="flex items-center gap-2 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Trading Active
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Invested Capital</div>
                  <div className="text-4xl font-bold"><AnimatedCounter value={investment.amount} prefix="$" /></div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total Profit Generated</div>
                  <div className="text-4xl font-bold profit-text"><AnimatedCounter value={investment.totalProfit} prefix="$" /></div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Current Risk Profile</div>
                  <div className="text-2xl font-bold mt-1.5">{investment.riskLevel}</div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={investment.autoCompound} 
                      onCheckedChange={(checked) => compoundMutation.mutate({ data: { autoCompound: checked } })}
                    />
                    <label className="text-sm font-medium flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" /> Auto-Compound Profits
                    </label>
                  </div>
                </div>
                
                <button 
                  onClick={() => stopMutation.mutate({})}
                  disabled={stopMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 rounded-lg font-medium transition-colors"
                >
                  <Square className="w-4 h-4" /> Stop Trading
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="glass-card p-6 rounded-xl">
                <h2 className="text-xl font-bold mb-6">Select Strategy Profile</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {riskProfiles.map(profile => (
                    <div 
                      key={profile.id}
                      onClick={() => setRiskLevel(profile.id)}
                      className={`cursor-pointer border p-5 rounded-xl transition-all duration-200 ${riskLevel === profile.id ? `${profile.bg} ${profile.border} shadow-[0_0_15px_rgba(255,255,255,0.05)]` : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                    >
                      <profile.icon className={`w-8 h-8 mb-3 ${profile.color}`} />
                      <div className="font-bold text-lg">{profile.name}</div>
                      <div className={`text-sm mt-1 ${profile.color}`}>{profile.target}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-6 rounded-xl">
                <h2 className="text-xl font-bold mb-4">Allocation</h2>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount to Invest</span>
                  <span className="text-primary font-medium">Available: ${wallet?.tradingBalance?.toFixed(2) || 0}</span>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-4 text-xl font-bold text-white focus:ring-2 focus:ring-primary focus:outline-none pr-20"
                    placeholder="0.00"
                  />
                  <div className="absolute right-4 top-4 text-muted-foreground font-medium">USDT</div>
                  <button 
                    onClick={() => setAmount(String(wallet?.tradingBalance || 0))}
                    className="absolute right-16 top-3 text-xs text-primary font-medium px-2 py-1.5 bg-primary/10 rounded hover:bg-primary/20 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl border-primary/20">
                <h3 className="font-bold text-lg mb-4">Summary</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Capital</span>
                    <span className="font-medium">${amount || "0.00"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Strategy</span>
                    <span className="font-medium">{riskProfiles.find(r => r.id === riskLevel)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Daily</span>
                    <span className="font-medium profit-text">{riskProfiles.find(r => r.id === riskLevel)?.target}</span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <button 
                    onClick={() => startMutation.mutate({ data: { amount: Number(amount), riskLevel } })}
                    disabled={startMutation.isPending || !amount || Number(amount) <= 0 || Number(amount) > (wallet?.tradingBalance || 0)}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    Deploy Capital
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}