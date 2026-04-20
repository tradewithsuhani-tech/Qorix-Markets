import { useGetWallet, useWithdraw, useTransferToTrading, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wallet as WalletIcon, ArrowUpFromLine,
  ArrowRightLeft, Info, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { VipBadge } from "@/components/vip-badge";

function BalanceSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="skeleton-shimmer h-3 w-24 rounded" />
      <div className="skeleton-shimmer h-9 w-36 rounded" />
      <div className="skeleton-shimmer h-3 w-40 rounded" />
    </div>
  );
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function WalletPage() {
  const { data: wallet, isLoading } = useGetWallet();
  const { data: summary } = useGetDashboardSummary();
  const queryClient = useQueryClient();

  const vip = summary?.vip;
  const vipTier = (vip?.tier ?? "none") as "none" | "silver" | "gold" | "platinum";
  const withdrawalFee = vip?.withdrawalFee ?? 0.02;
  const withdrawalFeePercent = (withdrawalFee * 100).toFixed(1);
  const { toast } = useToast();

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const withdrawMutation = useWithdraw({
    mutation: {
      onSuccess: () => {
        toast({ title: "Withdrawal requested", description: "Your request is pending admin approval." });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setWithdrawAmount("");
        setWithdrawAddress("");
      },
      onError: (err: any) => {
        toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const transferMutation = useTransferToTrading({
    mutation: {
      onSuccess: () => {
        toast({ title: "Transfer successful", description: "Funds moved to your trading balance." });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setTransferAmount("");
      },
      onError: (err: any) => {
        toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const netWithdraw = Number(withdrawAmount) * (1 - withdrawalFee);
  const feeAmount = Number(withdrawAmount) * withdrawalFee;

  return (
    <Layout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-5 md:space-y-6"
      >
        {/* Header */}
        <motion.div variants={item}>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">Wallet</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage your balances and funding.</p>
        </motion.div>

        {/* Balance Cards */}
        <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          {/* Main Balance */}
          <div className="glass-card balance-card-blue p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-400 rounded-t-2xl" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Main Balance</span>
              <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                <WalletIcon style={{ width: 14, height: 14 }} />
              </div>
            </div>
            {isLoading ? <BalanceSkeleton /> : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-white">
                  <AnimatedCounter value={wallet?.mainBalance || 0} prefix="$" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Available to transfer or withdraw</p>
              </>
            )}
          </div>

          {/* Trading Balance */}
          <div className="glass-card balance-card-indigo p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-400 rounded-t-2xl" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Trading Balance</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/15 text-indigo-400">
                <ArrowRightLeft style={{ width: 14, height: 14 }} />
              </div>
            </div>
            {isLoading ? <BalanceSkeleton /> : (
              <>
                <div className="text-2xl md:text-3xl font-bold text-white">
                  <AnimatedCounter value={wallet?.tradingBalance || 0} prefix="$" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Allocated to active investments</p>
              </>
            )}
          </div>

          {/* Profit Balance */}
          <div className="glass-card balance-card-emerald p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-green-400 rounded-t-2xl" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Profit Balance</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                <ArrowUpFromLine style={{ width: 14, height: 14 }} />
              </div>
            </div>
            {isLoading ? <BalanceSkeleton /> : (
              <>
                <div className="text-2xl md:text-3xl font-bold profit-text">
                  <AnimatedCounter value={wallet?.profitBalance || 0} prefix="$" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Withdrawable earnings</p>
              </>
            )}
          </div>
        </motion.div>

        {/* Transfer + Withdraw */}
        <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

          {/* Transfer */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
                <ArrowRightLeft style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <div className="font-semibold text-sm">Transfer to Trading</div>
                <div className="text-xs text-muted-foreground">Fund your investment balance</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount (USD)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="field-input pr-14"
                    placeholder="500"
                    min="0"
                  />
                  <button
                    onClick={() => setTransferAmount(String(wallet?.mainBalance || 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-blue-400 font-bold px-2 py-1 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>
              {wallet && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Available</span>
                  <span className="font-medium text-white">${(wallet.mainBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</span>
                </div>
              )}
              <button
                onClick={() => transferMutation.mutate({ data: { amount: Number(transferAmount) } })}
                disabled={transferMutation.isPending || !transferAmount || Number(transferAmount) <= 0}
                className="btn w-full"
                style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", boxShadow: "0 4px 18px rgba(99,102,241,0.3)" }}
              >
                {transferMutation.isPending ? "Processing…" : "Transfer Funds"}
              </button>
            </div>
          </div>

          {/* Withdraw */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <ArrowUpFromLine style={{ width: 16, height: 16 }} />
                </div>
                <div>
                  <div className="font-semibold text-sm">Withdraw Profits</div>
                  <div className="text-xs text-muted-foreground">Send to USD wallet</div>
                </div>
              </div>
              <VipBadge tier={vipTier} size="xs" />
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount (USD)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="field-input pr-14"
                    placeholder="100"
                    min="0"
                  />
                  <button
                    onClick={() => setWithdrawAmount(String(wallet?.profitBalance || 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-blue-400 font-bold px-2 py-1 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {Number(withdrawAmount) > 0 && (
                <div className="bg-black/20 border border-white/8 rounded-xl px-3 py-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Info style={{ width: 11, height: 11 }} />
                      Fee ({withdrawalFeePercent}% · {vip?.label ?? "Standard"})
                    </span>
                    <span className="text-red-400">−${feeAmount.toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-muted-foreground">You receive</span>
                    <span className="text-emerald-400">${netWithdraw.toFixed(2)} USD</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">USD Wallet Address</label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="field-input font-mono text-sm"
                  placeholder="T…"
                />
              </div>

              <button
                onClick={() => withdrawMutation.mutate({ data: { amount: Number(withdrawAmount), walletAddress: withdrawAddress } })}
                disabled={withdrawMutation.isPending || !withdrawAmount || !withdrawAddress || Number(withdrawAmount) <= 0}
                className="btn btn-success w-full"
              >
                {withdrawMutation.isPending ? "Processing…" : "Request Withdrawal"}
              </button>
            </div>
          </div>

        </motion.div>

        {/* Info Banner */}
        <motion.div variants={item}>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/8 border border-blue-500/15 text-xs text-muted-foreground">
            <AlertCircle style={{ width: 14, height: 14 }} className="text-blue-400 shrink-0 mt-0.5" />
            <span>Withdrawals are reviewed within 24 hours. Ensure your wallet address is correct — funds sent to wrong addresses cannot be recovered.</span>
          </div>
        </motion.div>

      </motion.div>
    </Layout>
  );
}
