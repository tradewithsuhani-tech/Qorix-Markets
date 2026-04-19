import { useGetWallet, useDeposit, useWithdraw, useTransferToTrading } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useState } from "react";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function WalletPage() {
  const { data: wallet, isLoading } = useGetWallet();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const depositMutation = useDeposit({
    mutation: {
      onSuccess: () => {
        toast({ title: "Deposit successful" });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setDepositAmount("");
      },
      onError: (err: any) => {
        toast({ title: "Deposit failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const withdrawMutation = useWithdraw({
    mutation: {
      onSuccess: () => {
        toast({ title: "Withdrawal requested", description: "Your request is pending admin approval" });
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
        toast({ title: "Transfer successful" });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setTransferAmount("");
      },
      onError: (err: any) => {
        toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
      }
    }
  });

  return (
    <Layout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">Manage your balances and funding.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-xl border-primary/20 bg-primary/5">
            <h3 className="text-muted-foreground font-medium mb-2 flex items-center gap-2">
              <WalletIcon className="w-4 h-4" /> Main Balance
            </h3>
            <div className="text-4xl font-bold">
              {isLoading ? "..." : <AnimatedCounter value={wallet?.mainBalance || 0} prefix="$" />}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Available for withdrawal or transfer</p>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-muted-foreground font-medium mb-2 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" /> Trading Balance
            </h3>
            <div className="text-4xl font-bold">
              {isLoading ? "..." : <AnimatedCounter value={wallet?.tradingBalance || 0} prefix="$" />}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Locked in active investments</p>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-muted-foreground font-medium mb-2 flex items-center gap-2">
              <ArrowUpFromLine className="w-4 h-4" /> Profit Balance
            </h3>
            <div className="text-4xl font-bold profit-text">
              {isLoading ? "..." : <AnimatedCounter value={wallet?.profitBalance || 0} prefix="$" />}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Available for withdrawal</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Deposit */}
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4 text-lg font-semibold">
              <div className="p-2 rounded bg-primary/20 text-primary"><ArrowDownToLine className="w-5 h-5" /></div>
              Deposit USDT
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Amount (USDT)</label>
                <input 
                  type="number" 
                  value={depositAmount} 
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-primary"
                  placeholder="1000"
                />
              </div>
              <button 
                onClick={() => depositMutation.mutate({ data: { amount: Number(depositAmount) } })}
                disabled={depositMutation.isPending || !depositAmount || Number(depositAmount) <= 0}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50"
              >
                Deposit
              </button>
            </div>
          </div>

          {/* Transfer */}
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4 text-lg font-semibold">
              <div className="p-2 rounded bg-blue-500/20 text-blue-500"><ArrowRightLeft className="w-5 h-5" /></div>
              Transfer to Trading
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Amount (USDT)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={transferAmount} 
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-primary pr-16"
                    placeholder="500"
                  />
                  <button 
                    onClick={() => setTransferAmount(String(wallet?.mainBalance || 0))}
                    className="absolute right-2 top-3 text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded hover:bg-primary/20 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <button 
                onClick={() => transferMutation.mutate({ data: { amount: Number(transferAmount) } })}
                disabled={transferMutation.isPending || !transferAmount || Number(transferAmount) <= 0}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50"
              >
                Transfer
              </button>
            </div>
          </div>

          {/* Withdraw */}
          <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center gap-2 mb-4 text-lg font-semibold">
              <div className="p-2 rounded bg-red-500/20 text-red-500"><ArrowUpFromLine className="w-5 h-5" /></div>
              Withdraw Profits
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground">Amount (USDT)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={withdrawAmount} 
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-primary pr-16"
                    placeholder="100"
                  />
                  <button 
                    onClick={() => setWithdrawAmount(String(wallet?.profitBalance || 0))}
                    className="absolute right-2 top-3 text-xs text-primary font-medium px-2 py-1 bg-primary/10 rounded hover:bg-primary/20 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">USDT Address (TRC20)</label>
                <input 
                  type="text" 
                  value={withdrawAddress} 
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-1 focus:ring-primary"
                  placeholder="T..."
                />
              </div>
              <button 
                onClick={() => withdrawMutation.mutate({ data: { amount: Number(withdrawAmount), walletAddress: withdrawAddress } })}
                disabled={withdrawMutation.isPending || !withdrawAmount || !withdrawAddress}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50"
              >
                Request Withdrawal
              </button>
            </div>
          </div>

        </div>
      </motion.div>
    </Layout>
  );
}