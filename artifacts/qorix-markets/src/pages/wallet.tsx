import { useGetWallet, useTransferToTrading, useGetDashboardSummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Wallet as WalletIcon, ArrowUpFromLine,
  ArrowRightLeft, Info, AlertCircle, Mail, ShieldCheck, X,
  CheckCircle2, Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { VipBadge } from "@/components/vip-badge";
import { AddressDisplay, maskAddress } from "@/components/address-display";
import { InrWithdrawTab } from "@/components/inr-withdraw-tab";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api${path}`; }
function getToken() { try { return localStorage.getItem("qorix_token"); } catch { return null; } }
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || "Request failed"), { data, status: res.status });
  return data;
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

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item: Variants = {
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

  const [withdrawTab, setWithdrawTab] = useState<"usdt" | "inr">("usdt");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawSource, setWithdrawSource] = useState<"profit" | "main">("profit");
  const [usePoints, setUsePoints] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const userPoints = (wallet as any)?.points ?? 0;

  // OTP withdrawal flow
  const [withdrawStep, setWithdrawStep] = useState<"form" | "review" | "otp" | "success">("form");
  const [withdrawOtp, setWithdrawOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawReceipt, setWithdrawReceipt] = useState<{
    id: number; netAmount: number; fee: number; source: string; address: string; at: string;
  } | null>(null);

  // Idempotency key for the in-flight withdrawal intent. Generated when the
  // user starts a fresh withdraw flow, reused across double-taps and network
  // retries of THIS attempt, regenerated on form reset (next intent). Pairs
  // with the backend's partial unique index on transactions(user_id, type,
  // idempotency_key) — server returns the same booked withdrawal on replay
  // instead of debiting the balance twice.
  const [withdrawIdemKey, setWithdrawIdemKey] = useState<string>(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `wd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const newIdemKey = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `wd-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const sourceBalance = withdrawSource === "main" ? (wallet?.mainBalance || 0) : (wallet?.profitBalance || 0);

  // KYC status — used to gate the withdrawal button.
  // If the request is still loading or fails, we optimistically allow the flow
  // (the backend still enforces KYC at /api/withdrawals).
  const { data: kycData, isLoading: kycLoading, isError: kycError } = useQuery<any>({
    queryKey: ["kyc-status"],
    queryFn: () => apiFetch("/kyc/status"),
    staleTime: 30_000,
    retry: 1,
  });
  const kycKnown = !kycLoading && !kycError && !!kycData;
  const kycApproved = !kycKnown || kycData?.kycStatus === "approved";
  const [showKycPrompt, setShowKycPrompt] = useState(false);
  const resetWithdrawForm = () => {
    setWithdrawAmount(""); setWithdrawAddress(""); setWithdrawOtp("");
    setWithdrawStep("form"); setWithdrawReceipt(null);
    // Fresh idempotency key for the next withdrawal intent.
    setWithdrawIdemKey(newIdemKey());
  };

  const requestWithdrawalOtp = async () => {
    setSendingOtp(true);
    try {
      await apiFetch("/auth/withdrawal-otp", { method: "POST" });
      setWithdrawStep("otp");
      toast({ title: "OTP sent!", description: "Enter the code from your email to confirm." });
    } catch (err: any) {
      toast({ title: "Failed to send OTP", description: err.message, variant: "destructive" });
    } finally {
      setSendingOtp(false);
    }
  };

  const confirmWithdrawal = async () => {
    if (!withdrawOtp.trim()) return;
    setWithdrawing(true);
    try {
      const res = await apiFetch("/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          walletAddress: withdrawAddress,
          otp: withdrawOtp,
          source: withdrawSource,
          usePoints: pointsToSpend,
          idempotencyKey: withdrawIdemKey,
        }),
      });
      // Prefer the server-canonical net amount over local form math — this
      // matters on idempotent replay where the server returns the ORIGINAL
      // booked withdrawal (which may differ from the current form state if
      // the user changed inputs between attempts using the same key).
      const serverNetAmount = typeof res.amount === "number" ? res.amount : Number(withdrawAmount) - feeAmount;
      const fee = feeAmount;
      setWithdrawReceipt({
        id: res.id,
        netAmount: serverNetAmount,
        fee,
        source: withdrawSource,
        address: withdrawAddress,
        at: res.createdAt ?? new Date().toISOString(),
      });
      setWithdrawStep("success");
      toast({ title: "Withdrawal requested", description: "Your request is pending admin approval." });
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    } catch (err: any) {
      toast({ title: "Withdrawal failed", description: err.message, variant: "destructive" });
    } finally {
      setWithdrawing(false);
    }
  };

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

  const grossFee = Number(withdrawAmount) * withdrawalFee;
  const maxPointsByValue = Math.floor((grossFee * 0.5) * 100); // 1pt = $0.01, max 50% off
  const pointsToSpend = usePoints ? Math.min(userPoints, maxPointsByValue) : 0;
  const pointsDiscount = pointsToSpend * 0.01;
  const feeAmount = Math.max(0, grossFee - pointsDiscount);
  const netWithdraw = Number(withdrawAmount) - feeAmount;

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
                <p className="text-xs text-muted-foreground mt-2">Allocated to active Trading</p>
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
                <div className="text-xs text-muted-foreground">Fund your Trading balance</div>
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
                  <div className="font-semibold text-sm">Withdraw Funds</div>
                  <div className="text-xs text-muted-foreground">Send to USD wallet</div>
                </div>
              </div>
              <VipBadge tier={vipTier} size="xs" />
            </div>

            {/* Tab switcher: USDT (TRC20) vs INR (UPI/Bank) */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-black/30 rounded-xl">
              <button
                onClick={() => setWithdrawTab("usdt")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  withdrawTab === "usdt"
                    ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                USDT (TRC20)
              </button>
              <button
                onClick={() => setWithdrawTab("inr")}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  withdrawTab === "inr"
                    ? "bg-violet-500/20 text-violet-300 shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                INR (UPI/Bank)
              </button>
            </div>

            {withdrawTab === "inr" ? (
              <InrWithdrawTab kycApproved={kycApproved} onKycRequired={() => setShowKycPrompt(true)} />
            ) : (
              <>
            {withdrawStep !== "success" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setWithdrawSource("profit"); setWithdrawAmount(""); }}
                  className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
                    withdrawSource === "profit"
                      ? "bg-emerald-500/15 border-emerald-500/50"
                      : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From Profit</div>
                  <div className={`text-sm font-bold ${withdrawSource === "profit" ? "text-emerald-400" : "text-white/80"}`}>
                    ${(wallet?.profitBalance || 0).toFixed(2)}
                  </div>
                </button>
                <button
                  onClick={() => { setWithdrawSource("main"); setWithdrawAmount(""); }}
                  className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
                    withdrawSource === "main"
                      ? "bg-blue-500/15 border-blue-500/50"
                      : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From Main</div>
                  <div className={`text-sm font-bold ${withdrawSource === "main" ? "text-blue-400" : "text-white/80"}`}>
                    ${(wallet?.mainBalance || 0).toFixed(2)}
                  </div>
                </button>
              </div>
            )}

            <div className="space-y-3">
              {withdrawStep !== "success" && (
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
                    disabled={withdrawStep === "otp"}
                  />
                  <button
                    onClick={() => setWithdrawAmount(String(sourceBalance))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-blue-400 font-bold px-2 py-1 bg-blue-500/10 rounded-lg hover:bg-blue-500/20 transition"
                  >
                    MAX
                  </button>
                </div>
              </div>
              )}

              {Number(withdrawAmount) > 0 && (
                <div className="bg-black/20 border border-white/8 rounded-xl px-3 py-2.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Info style={{ width: 11, height: 11 }} />
                      Fee ({withdrawalFeePercent}% · {vip?.label ?? "Standard"})
                    </span>
                    <span className="text-red-400">−${grossFee.toFixed(2)}</span>
                  </div>
                  {userPoints > 0 && maxPointsByValue > 0 && withdrawStep !== "otp" && (
                    <button
                      type="button"
                      onClick={() => setUsePoints(!usePoints)}
                      className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 border transition-colors ${
                        usePoints
                          ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                          : "bg-white/[0.02] border-white/10 text-muted-foreground hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${usePoints ? "bg-amber-400 border-amber-400" : "border-white/20"}`}>
                          {usePoints && <CheckCircle2 style={{ width: 10, height: 10 }} className="text-black" />}
                        </span>
                        Use {pointsToSpend > 0 ? pointsToSpend : "up to " + Math.min(userPoints, maxPointsByValue)} pts ({userPoints.toLocaleString()} avail)
                      </span>
                      {usePoints && pointsDiscount > 0 && (
                        <span className="text-emerald-400 font-semibold">−${pointsDiscount.toFixed(2)}</span>
                      )}
                    </button>
                  )}
                  <div className="h-px bg-white/5" />
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-muted-foreground">You receive</span>
                    <span className="text-emerald-400">${netWithdraw.toFixed(2)} USD</span>
                  </div>
                </div>
              )}

              {withdrawStep !== "success" && (
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 block">USD Wallet Address</label>
                  <input
                    type="text"
                    value={withdrawAddress}
                    onChange={(e) => setWithdrawAddress(e.target.value)}
                    className="field-input font-mono text-sm"
                    placeholder="T…"
                    disabled={withdrawStep === "otp"}
                  />
                </div>
              )}

              <AnimatePresence mode="wait">
                {withdrawStep === "form" && (
                  <motion.button
                    key="review-btn"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    onClick={() => {
                      if (!kycApproved) { setShowKycPrompt(true); return; }
                      setWithdrawStep("review");
                    }}
                    disabled={kycApproved && (!withdrawAmount || !withdrawAddress || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > sourceBalance)}
                    title={!kycApproved ? "Complete KYC to enable withdrawal" : undefined}
                    className="btn btn-success w-full flex items-center justify-center gap-2"
                  >
                    {!kycApproved
                      ? "Complete KYC for Withdrawal"
                      : Number(withdrawAmount) > sourceBalance
                        ? "Amount exceeds balance"
                        : "Review Withdrawal"}
                  </motion.button>
                )}

                {withdrawStep === "review" && (
                  <motion.div
                    key="review-step"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                      <AlertCircle style={{ width: 13, height: 13 }} />
                      Review carefully. Funds sent to a wrong address cannot be recovered.
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 divide-y divide-white/5 text-xs">
                      <Row label="From" value={withdrawSource === "main" ? "Main Balance" : "Profit Balance"} />
                      <Row label="Amount" value={`$${Number(withdrawAmount).toFixed(2)}`} />
                      <Row label={`Fee (${withdrawalFeePercent}% · ${vip?.label ?? "Standard"})`} value={`−$${feeAmount.toFixed(2)}`} />
                      <Row label="You'll Receive" value={`$${netWithdraw.toFixed(2)} USD`} highlight />
                      <div className="flex items-center justify-between px-3 py-2.5 gap-2">
                        <span className="text-muted-foreground shrink-0">To</span>
                        <AddressDisplay address={withdrawAddress} className="min-w-0" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => { setWithdrawStep("form"); setWithdrawIdemKey(newIdemKey()); }}
                        disabled={sendingOtp}
                        className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        Back
                      </button>
                      <button
                        onClick={requestWithdrawalOtp}
                        disabled={
                          sendingOtp ||
                          !withdrawAmount ||
                          !withdrawAddress ||
                          Number(withdrawAmount) <= 0 ||
                          Number(withdrawAmount) > sourceBalance
                        }
                        className="btn btn-success flex items-center justify-center gap-2"
                      >
                        <Mail style={{ width: 14, height: 14 }} />
                        {Number(withdrawAmount) > sourceBalance
                          ? "Balance changed — go back"
                          : sendingOtp ? "Sending…" : "Confirm & Send Code"}
                      </button>
                    </div>
                  </motion.div>
                )}

                {withdrawStep === "otp" && (
                  <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="space-y-2"
                  >
                    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sending</span>
                        <span className="text-emerald-400 font-bold">${netWithdraw.toFixed(2)} USD</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">To</span>
                        <span className="font-mono text-white truncate" title={withdrawAddress}>{maskAddress(withdrawAddress)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
                      <ShieldCheck style={{ width: 13, height: 13 }} />
                      Enter the 6-digit code sent to your email
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={withdrawOtp}
                        onChange={(e) => setWithdrawOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        className="flex-1 field-input text-center font-mono tracking-widest text-lg"
                        autoFocus
                      />
                      <button
                        onClick={() => { setWithdrawStep("form"); setWithdrawOtp(""); setWithdrawIdemKey(newIdemKey()); }}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 transition-colors"
                      >
                        <X style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                    <button
                      onClick={confirmWithdrawal}
                      disabled={withdrawing || withdrawOtp.length < 6}
                      className="btn btn-success w-full"
                    >
                      {withdrawing ? "Processing…" : "Confirm Withdrawal"}
                    </button>
                  </motion.div>
                )}

                {withdrawStep === "success" && withdrawReceipt && (
                  <motion.div
                    key="success-step"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-col items-center text-center py-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 18 }}
                        className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mb-3"
                      >
                        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                      </motion.div>
                      <div className="text-base font-bold text-white">Withdrawal Requested</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Your funds are on the way</div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/20 divide-y divide-white/5 text-xs">
                      <Row label="Reference ID" value={`#WD-${withdrawReceipt.id}`} mono />
                      <Row label="You'll Receive" value={`$${withdrawReceipt.netAmount.toFixed(2)} USD`} highlight />
                      <Row label="Network Fee" value={`$${withdrawReceipt.fee.toFixed(2)}`} />
                      <Row label="From" value={withdrawReceipt.source === "main" ? "Main Balance" : "Profit Balance"} />
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-muted-foreground">To Address</span>
                        <AddressDisplay address={withdrawReceipt.address} /></div>
                      <Row label="Submitted" value={new Date(withdrawReceipt.at).toLocaleString()} />
                    </div>

                    <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300/90">
                      <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Admin will review within <b>24 hours</b>. You'll receive a notification once approved and funds are dispatched to your wallet.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={resetWithdrawForm}
                        className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors"
                      >
                        New Withdrawal
                      </button>
                      <a
                        href="/transactions"
                        className="px-4 py-2.5 rounded-xl bg-blue-500/15 border border-blue-500/40 text-sm text-blue-300 hover:bg-blue-500/25 transition-colors text-center"
                      >
                        View Transactions
                      </a>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
              </>
            )}
          </div>

        </motion.div>

        {/* Info Banner */}
        <motion.div variants={item}>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-500/8 border border-blue-500/15 text-xs text-muted-foreground">
            <AlertCircle style={{ width: 14, height: 14 }} className="text-blue-400 shrink-0 mt-0.5" />
            {withdrawTab === "inr" ? (
              <span>INR withdrawals are processed within 24 hours after admin review. Double-check your UPI ID or bank account number &amp; IFSC — funds sent to wrong accounts cannot be recovered. Make sure the account holder name matches your KYC.</span>
            ) : (
              <span>Withdrawals are reviewed within 24 hours. Ensure your wallet address is correct — funds sent to wrong addresses cannot be recovered.</span>
            )}
          </div>
        </motion.div>

      </motion.div>

      {/* KYC required popup */}
      <AnimatePresence>
        {showKycPrompt && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-prompt-title"
            aria-describedby="kyc-prompt-desc"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowKycPrompt(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setShowKycPrompt(false); }}
            tabIndex={-1}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="w-full max-w-sm rounded-2xl bg-card border border-white/10 p-5 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck style={{ width: 18, height: 18 }} className="text-amber-300" />
                </div>
                <div className="flex-1">
                  <h3 id="kyc-prompt-title" className="text-base font-semibold mb-1">KYC Verification Required</h3>
                  <p id="kyc-prompt-desc" className="text-sm text-muted-foreground">
                    For your security, please complete KYC verification before making a withdrawal.
                  </p>
                </div>
                <button
                  onClick={() => setShowKycPrompt(false)}
                  aria-label="Close"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowKycPrompt(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <Link
                  href="/kyc"
                  onClick={() => setShowKycPrompt(false)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-sm text-emerald-300 hover:bg-emerald-500/25 transition-colors text-center"
                >
                  Complete KYC
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? "font-mono" : "font-medium"} ${highlight ? "text-emerald-400 font-bold" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
