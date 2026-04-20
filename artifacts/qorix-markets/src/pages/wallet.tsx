import { useGetWallet, useWithdraw, useTransferToTrading, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine,
  ArrowRightLeft, Info, AlertCircle, Copy, CheckCheck,
  QrCode, ExternalLink, AlertTriangle, ChevronRight,
  CheckCircle2, Loader2, ShieldCheck, ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { VipBadge } from "@/components/vip-badge";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function getApiUrl(path: string) {
  return `${BASE_URL}api${path}`;
}

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

function QRCodeCanvas({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: 170,
      margin: 2,
      color: { dark: "#ffffff", light: "#0d1117" },
    });
  }, [value]);
  return (
    <canvas
      ref={canvasRef}
      className="rounded-xl border border-white/10"
      style={{ width: 170, height: 170 }}
    />
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0",
        copied
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
          : "bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10 border border-white/10",
      )}
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

type DepositStep = "amount" | "payment" | "confirmed";

interface DepositInfo {
  platformAddress: string;
}

function DepositCard({ onDepositConfirmed }: { onDepositConfirmed: () => void }) {
  const [step, setStep] = useState<DepositStep>("amount");
  const [amount, setAmount] = useState("");
  const [info, setInfo] = useState<DepositInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastDepositCount, setLastDepositCount] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDepositInfo = useCallback(async () => {
    setInfoLoading(true);
    const token = localStorage.getItem("qorix_token");
    try {
      const res = await fetch(getApiUrl("/deposit/address"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      setInfo({
        platformAddress: d.platformAddress ?? "",
      });
    } catch {
    } finally {
      setInfoLoading(false);
    }
  }, []);

  const fetchDepositCount = useCallback(async (): Promise<number> => {
    const token = localStorage.getItem("qorix_token");
    try {
      const res = await fetch(getApiUrl("/deposit/history?limit=50"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      return (d.deposits ?? []).filter((dep: any) => dep.status === "confirmed").length;
    } catch {
      return 0;
    }
  }, []);

  const handleProceed = async () => {
    if (!amount || Number(amount) <= 0) return;
    await fetchDepositInfo();
    const count = await fetchDepositCount();
    setLastDepositCount(count);
    setStep("payment");
  };

  useEffect(() => {
    if (step !== "payment" || lastDepositCount === null) return;

    setPolling(true);
    pollRef.current = setInterval(async () => {
      const count = await fetchDepositCount();
      if (count > lastDepositCount) {
        clearInterval(pollRef.current!);
        setPolling(false);
        setStep("confirmed");
        onDepositConfirmed();
      }
    }, 10000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [step, lastDepositCount, fetchDepositCount, onDepositConfirmed]);

  const reset = () => {
    setStep("amount");
    setAmount("");
    setInfo(null);
    setLastDepositCount(null);
    setPolling(false);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4 border-b border-white/8">
        {step !== "amount" && (
          <button
            onClick={reset}
            className="p-1.5 -ml-1 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
          <ArrowDownToLine style={{ width: 16, height: 16 }} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Deposit USDT</div>
          <div className="text-xs text-muted-foreground">TRC20 · TRON Network</div>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-1.5">
          {(["amount", "payment", "confirmed"] as DepositStep[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                "w-6 h-1 rounded-full transition-all duration-300",
                step === s ? "bg-blue-500" : i < ["amount", "payment", "confirmed"].indexOf(step) ? "bg-emerald-500/60" : "bg-white/10"
              )}
            />
          ))}
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <AnimatePresence mode="wait">
          {/* Step 1: Amount */}
          {step === "amount" && (
            <motion.div
              key="amount"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Amount (USDT)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="field-input"
                  placeholder="Enter amount"
                  min="1"
                />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[100, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(String(amt))}
                    className={cn(
                      "text-xs py-1.5 rounded-lg border font-medium transition-all",
                      amount === String(amt)
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                        : "bg-white/5 hover:bg-blue-500/15 hover:text-blue-400 border-white/8 hover:border-blue-500/25 text-muted-foreground"
                    )}
                  >
                    ${amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>

              <div className="flex items-start gap-2.5 bg-blue-500/6 border border-blue-500/15 rounded-xl px-3 py-2.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Send exactly <span className="text-white font-semibold">{amount ? `${amount} USDT` : "the entered amount"}</span> via <span className="text-white font-medium">TRON (TRC20)</span>. Deposits are auto-detected and credited within ~15 seconds.
                </p>
              </div>

              <button
                onClick={handleProceed}
                disabled={!amount || Number(amount) < 1}
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                Get Deposit Address
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Step 2: Payment */}
          {step === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Amount to send */}
              <div className="flex items-center justify-between bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
                <span className="text-xs text-muted-foreground">Send exactly</span>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{amount} USDT</span>
                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded-full uppercase tracking-wider">TRC20</span>
                </div>
              </div>

              {infoLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : info ? (
                <>
                  {/* QR Code + address */}
                  {info.platformAddress ? (
                    <div className="flex flex-col sm:flex-row items-center gap-5">
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="p-3 rounded-xl bg-[#0d1117] border border-white/10">
                          <QRCodeCanvas value={info.platformAddress} />
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <QrCode className="w-3 h-3" />
                          Scan to pay
                        </div>
                      </div>

                      <div className="flex-1 w-full space-y-3">
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">
                            Platform Deposit Address
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2">
                            <span className="text-xs font-mono text-white break-all leading-relaxed">{info.platformAddress}</span>
                            <CopyButton text={info.platformAddress} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2">
                            <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider">Network</div>
                            <div className="text-xs font-semibold text-emerald-400">TRON (TRC20)</div>
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2">
                            <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider">Token</div>
                            <div className="text-xs font-semibold text-white">USDT</div>
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2">
                            <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider">Min. Deposit</div>
                            <div className="text-xs font-semibold text-white">1 USDT</div>
                          </div>
                          <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2">
                            <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wider">Confirmations</div>
                            <div className="text-xs font-semibold text-white">~1–3 min</div>
                          </div>
                        </div>

                        <a
                          href={`https://tronscan.org/#/address/${info.platformAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on TronScan
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                      <WalletIcon className="w-7 h-7 opacity-30" />
                      <p className="text-sm">Platform address not configured</p>
                    </div>
                  )}
                </>
              ) : null}

              {/* Waiting indicator */}
              {polling && (
                <div className="flex items-center gap-3 bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-blue-400">Waiting for payment…</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Checking every 10 seconds. Do not close this page.</div>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex gap-2.5 bg-amber-500/6 border border-amber-500/20 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Send only <span className="font-semibold text-white">USDT (TRC20)</span> to this address. Other tokens or networks will be lost permanently.
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirmed */}
          {step === "confirmed" && (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <div className="text-base font-bold text-white">Deposit Confirmed!</div>
                <div className="text-sm text-muted-foreground mt-1">
                  <span className="text-emerald-400 font-semibold">{amount} USDT</span> has been credited to your main balance.
                </div>
              </div>
              <button onClick={reset} className="btn btn-primary mt-2 px-6">
                Make Another Deposit
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

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

  const handleDepositConfirmed = () => {
    queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    toast({ title: "Deposit confirmed!", description: "Funds have been credited to your main balance." });
  };

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

        {/* Deposit Card (2-step flow) */}
        <motion.div variants={item}>
          <DepositCard onDepositConfirmed={handleDepositConfirmed} />
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
