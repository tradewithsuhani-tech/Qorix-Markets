import { useGetWallet, useTransferToTrading, useGetDashboardSummary, useGetTransactions } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Wallet as WalletIcon, ArrowUpFromLine, ArrowDownToLine,
  ArrowRightLeft, Info, AlertCircle, Mail, ShieldCheck, X,
  CheckCircle2, Clock, Landmark, Eye, EyeOff, TrendingUp, TrendingDown,
  ChevronRight, ChevronDown, ArrowDownCircle, ArrowUpCircle, DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { VipBadge } from "@/components/vip-badge";
import { AddressDisplay, maskAddress } from "@/components/address-display";
import { InrWithdrawTab } from "@/components/inr-withdraw-tab";
import { authFetch } from "@/lib/auth-fetch";
import { format } from "date-fns";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api${path}`; }
async function apiFetch(path: string, options: RequestInit = {}) {
  return authFetch(apiUrl(path), options);
}

// USD → INR display rate (mirrors mobile's FX_RATE in lib/tx-mapper)
const FX_RATE = 83.42;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

type ModalKind = null | "withdraw" | "transfer";

export default function WalletPage() {
  const { data: wallet, isLoading } = useGetWallet();
  const { data: summary } = useGetDashboardSummary();
  const { data: txData, isLoading: txLoading } = useGetTransactions({ page: 1, limit: 6 });
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const vip = summary?.vip;
  const vipTier = (vip?.tier ?? "none") as "none" | "silver" | "gold" | "platinum";
  const withdrawalFee = vip?.withdrawalFee ?? 0.02;
  const withdrawalFeePercent = (withdrawalFee * 100).toFixed(1);
  const { toast } = useToast();

  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [hideBalance, setHideBalance] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [withdrawTab, setWithdrawTab] = useState<"usdt" | "inr">("usdt");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawSource, setWithdrawSource] = useState<"profit" | "main">("profit");
  const [usePoints, setUsePoints] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<"toTrading" | "toMain">("toTrading");
  const userPoints = (wallet as any)?.points ?? 0;

  const [withdrawStep, setWithdrawStep] = useState<"form" | "review" | "otp" | "success">("form");
  const [withdrawOtp, setWithdrawOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawReceipt, setWithdrawReceipt] = useState<{
    id: number; netAmount: number; fee: number; source: string; address: string; at: string;
  } | null>(null);

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
      onSuccess: (_data, variables) => {
        const wasToMain = variables?.data?.direction === "to_main";
        toast({
          title: "Transfer successful",
          description: wasToMain
            ? "Funds moved back to your main balance."
            : "Funds moved to your trading balance.",
        });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setTransferAmount("");
        setActiveModal(null);
      },
      onError: (err: any) => {
        toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
      }
    }
  });

  const grossFee = Number(withdrawAmount) * withdrawalFee;
  const maxPointsByValue = Math.floor((grossFee * 0.5) * 100);
  const pointsToSpend = usePoints ? Math.min(userPoints, maxPointsByValue) : 0;
  const pointsDiscount = pointsToSpend * 0.01;
  const feeAmount = Math.max(0, grossFee - pointsDiscount);
  const netWithdraw = Number(withdrawAmount) - feeAmount;

  // Portfolio totals
  const mainBal = Number(wallet?.mainBalance) || 0;
  const tradingBal = Number(wallet?.tradingBalance) || 0;
  const profitBal = Number(wallet?.profitBalance) || 0;
  const totalUsd = mainBal + tradingBal + profitBal;
  const totalInr = totalUsd * FX_RATE;
  const dailyPnlUsd = Number((summary as any)?.dailyProfitLoss) || 0;
  const dailyPnlInr = dailyPnlUsd * FX_RATE;
  const dailyPnlPct = Number((summary as any)?.dailyProfitPercent) || 0;
  const isUp = dailyPnlUsd >= 0;

  // Body scroll lock when modal is open
  useEffect(() => {
    if (!activeModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [activeModal]);

  const closeModal = () => {
    setActiveModal(null);
    if (withdrawStep === "success") resetWithdrawForm();
  };

  // Escape key closes any open modal
  useEffect(() => {
    if (!activeModal && !showKycPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showKycPrompt) setShowKycPrompt(false);
      else closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal, showKycPrompt]);

  const transactions = (txData as any)?.data ?? [];

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
          <p className="text-muted-foreground text-sm mt-0.5">Your portfolio, all in one place.</p>
        </motion.div>

        {/* Portfolio Balance Hero */}
        <motion.div variants={item}>
          <PortfolioBalanceHero
            balanceInr={totalInr}
            balanceUsd={totalUsd}
            pnlInr={dailyPnlInr}
            pnlPct={dailyPnlPct}
            isUp={isUp}
            isHidden={hideBalance}
            isLoading={isLoading}
            vipTier={vipTier}
            onToggleHide={() => setHideBalance(h => !h)}
            onDeposit={() => navigate("/deposit")}
            onWithdraw={() => navigate("/withdraw")}
            onTransfer={() => setActiveModal("transfer")}
          />
        </motion.div>

        {/* Balance breakdown (collapsible) */}
        <motion.div variants={item}>
          <button
            onClick={() => setShowBreakdown(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.05] transition-colors"
          >
            <span className="text-sm font-semibold text-white">Balance Breakdown</span>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground transition-transform ${showBreakdown ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {showBreakdown && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <BreakdownTile
                    label="Main Balance"
                    amount={mainBal}
                    icon={WalletIcon}
                    accent="emerald"
                    sub="Available to transfer"
                    hide={hideBalance}
                  />
                  <BreakdownTile
                    label="Trading Balance"
                    amount={tradingBal}
                    icon={ArrowRightLeft}
                    accent="cyan"
                    sub="Allocated to active trading"
                    hide={hideBalance}
                  />
                  <BreakdownTile
                    label="Profit Balance"
                    amount={profitBal}
                    icon={ArrowUpFromLine}
                    accent="emerald"
                    sub="Withdrawable earnings"
                    hide={hideBalance}
                    profit
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Transaction History */}
        <motion.div variants={item}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-white">Transaction History</h2>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors"
            >
              See more
              <ChevronRight style={{ width: 13, height: 13 }} />
            </Link>
          </div>

          <div className="glass-card rounded-2xl divide-y divide-white/5 overflow-hidden">
            {txLoading ? (
              <>
                <TxRowSkeleton />
                <TxRowSkeleton />
                <TxRowSkeleton />
              </>
            ) : transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                <WalletIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              transactions.slice(0, 6).map((tx: any) => <TxRow key={tx.id} tx={tx} />)
            )}
          </div>
        </motion.div>

        {/* Info Banner */}
        <motion.div variants={item}>
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 text-xs text-muted-foreground">
            <AlertCircle style={{ width: 14, height: 14 }} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>Withdrawals are reviewed within 24 hours. Always double-check your destination wallet address or bank details — funds sent to wrong destinations cannot be recovered.</span>
          </div>
        </motion.div>
      </motion.div>

      {/* ═════════ MODALS ═════════ */}

      {/* Withdraw Modal */}
      <BottomSheet
        open={activeModal === "withdraw"}
        onClose={closeModal}
        title="Withdraw Funds"
        subtitle="Send to USDT wallet or Indian bank account"
        accent="amber"
        icon={ArrowUpFromLine}
        rightSlot={<VipBadge tier={vipTier} size="xs" />}
      >
        <div className="space-y-4">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-black/30 rounded-xl">
            <button
              onClick={() => setWithdrawTab("usdt")}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                withdrawTab === "usdt"
                  ? "bg-amber-500/20 text-amber-200 shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                withdrawTab === "usdt" ? "bg-amber-400 text-amber-950" : "bg-white/10 text-white/70"
              }`}>$</span>
              USDT (TRC20)
            </button>
            <button
              onClick={() => setWithdrawTab("inr")}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                withdrawTab === "inr"
                  ? "bg-amber-500/20 text-amber-200 shadow-sm"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
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
                        ? "bg-emerald-500/15 border-emerald-500/50"
                        : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From Main</div>
                    <div className={`text-sm font-bold ${withdrawSource === "main" ? "text-emerald-400" : "text-white/80"}`}>
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
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-amber-200 font-bold px-2 py-1 bg-amber-500/15 rounded-lg hover:bg-amber-500/25 transition"
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
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">USDT Wallet Address (TRC20)</label>
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
                      className="w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: "linear-gradient(135deg,#f59e0b,#d97706)",
                        color: "#0b0b0b",
                        boxShadow: "0 6px 22px rgba(245,158,11,0.30)",
                      }}
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
                          className="px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{
                            background: "linear-gradient(135deg,#f59e0b,#d97706)",
                            color: "#0b0b0b",
                          }}
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
                      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
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
                        className="w-full px-4 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                        style={{
                          background: "linear-gradient(135deg,#f59e0b,#d97706)",
                          color: "#0b0b0b",
                        }}
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
                          <AddressDisplay address={withdrawReceipt.address} />
                        </div>
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
                        <Link
                          href="/transactions"
                          onClick={closeModal}
                          className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-sm text-emerald-300 hover:bg-emerald-500/25 transition-colors text-center"
                        >
                          View Transactions
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Transfer Modal — Internal Transfer redesign */}
      <BottomSheet
        open={activeModal === "transfer"}
        onClose={closeModal}
        title="Internal Transfer"
        subtitle="Move funds between wallets"
        accent="emerald"
        icon={ArrowRightLeft}
        rightSlot={
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 text-[10px] font-bold tracking-wide text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            INSTANT
          </span>
        }
      >
        {(() => {
          const fromIsMain = transferDirection === "toTrading";
          const fromBal = fromIsMain ? mainBal : tradingBal;
          const toBal = fromIsMain ? tradingBal : mainBal;
          const numAmt = Number(transferAmount) || 0;
          const valid = numAmt > 0 && numAmt <= fromBal;
          const swap = () => {
            setTransferDirection(fromIsMain ? "toMain" : "toTrading");
            setTransferAmount("");
          };
          const setPct = (pct: number) => {
            const v = (fromBal * pct) / 100;
            setTransferAmount(v > 0 ? v.toFixed(2) : "");
          };
          const inrEquiv = numAmt * FX_RATE;
          return (
            <div className="space-y-4 pb-2">
              {/* FROM / TO cards with swap */}
              <div className="relative">
                <WalletCard
                  badge="FROM"
                  badgeTone="emerald"
                  icon={fromIsMain ? WalletIcon : TrendingUp}
                  iconTone="emerald"
                  name={fromIsMain ? "Main Wallet" : "Trading Wallet"}
                  sub={fromIsMain ? "Withdrawable balance" : "Deployed capital"}
                  amount={fromBal}
                />
                {/* Connecting line */}
                <div className="relative h-7 flex items-center justify-center">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />
                  <button
                    onClick={swap}
                    aria-label="Swap direction"
                    className="relative z-10 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-4 ring-[#0b0f12] active:scale-95 transition-all"
                  >
                    <ArrowRightLeft style={{ width: 15, height: 15 }} strokeWidth={2.5} />
                  </button>
                </div>
                <WalletCard
                  badge="TO"
                  badgeTone="cyan"
                  icon={fromIsMain ? TrendingUp : WalletIcon}
                  iconTone="cyan"
                  name={fromIsMain ? "Trading Wallet" : "Main Wallet"}
                  sub={fromIsMain ? "Deployed capital" : "Withdrawable balance"}
                  amount={toBal}
                  incoming={numAmt}
                />
              </div>

              {/* Transfer amount */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold tracking-[0.18em] text-white/45">TRANSFER AMOUNT</span>
                  <button
                    onClick={() => setPct(100)}
                    className="text-[10px] font-bold tracking-wide text-emerald-300 hover:text-emerald-200 px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 transition-colors"
                  >
                    MAX · ${fromBal.toFixed(2)}
                  </button>
                </div>
                <div
                  className={`rounded-2xl border bg-white/[0.025] transition-colors overflow-hidden ${
                    numAmt > 0 && !valid
                      ? "border-rose-500/45"
                      : valid
                      ? "border-emerald-400/45 shadow-[0_0_0_3px_rgba(16,185,129,0.08)]"
                      : "border-white/[0.10]"
                  }`}
                >
                  <div className="px-3.5 py-2 flex items-center gap-2">
                    <span className="text-[18px] font-semibold leading-none text-emerald-400 shrink-0 select-none">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={transferAmount}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9.]/g, "");
                        setTransferAmount(v);
                      }}
                      placeholder="0"
                      autoFocus
                      className="flex-1 bg-transparent border-0 outline-none text-[20px] font-semibold tracking-[-0.01em] tabular-nums placeholder:text-white/25 min-w-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    {numAmt > 0 && (
                      <span className="text-[11px] text-white/45 font-mono tabular-nums shrink-0">
                        ≈ ₹{Math.round(inrEquiv).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>
                {numAmt > fromBal && (
                  <div className="mt-1.5 text-[11px] text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Exceeds available balance
                  </div>
                )}
              </div>

              {/* Info card */}
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2.5">
                <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-white/70 leading-relaxed">
                  {fromIsMain
                    ? "Funds moved to Trading are deployed to your active bot in the next cycle."
                    : "Funds moved to Main are immediately available for withdrawal."}
                </p>
              </div>

              {/* CTA */}
              <button
                onClick={() => transferMutation.mutate({
                  data: {
                    amount: numAmt,
                    direction: fromIsMain ? "to_trading" : "to_main",
                  },
                })}
                disabled={transferMutation.isPending || !valid}
                className={`w-full h-12 rounded-2xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all ${
                  valid
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-black shadow-lg shadow-emerald-500/30 active:scale-[0.99]"
                    : "bg-white/[0.04] text-white/40 cursor-not-allowed"
                }`}
              >
                {transferMutation.isPending ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                    Processing…
                  </>
                ) : !numAmt ? (
                  "Enter Amount"
                ) : !valid ? (
                  "Insufficient Balance"
                ) : (
                  <>
                    <ArrowRightLeft style={{ width: 14, height: 14 }} strokeWidth={2.5} />
                    Transfer ${numAmt.toFixed(2)}
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-white/45">
                <ShieldCheck className="w-3 h-3 text-emerald-400/70" />
                Settled instantly · zero fees
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      {/* KYC required popup */}
      <AnimatePresence>
        {showKycPrompt && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-prompt-title"
            aria-describedby="kyc-prompt-desc"
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowKycPrompt(false)}
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

/* ─────────────── PortfolioBalanceHero (web port of mobile BalanceCardPro) ─────────────── */

function PortfolioBalanceHero({
  balanceInr, balanceUsd, pnlInr, pnlPct, isUp, isHidden, isLoading,
  onToggleHide, onDeposit, onWithdraw, onTransfer,
}: {
  balanceInr: number;
  balanceUsd: number;
  pnlInr: number;
  pnlPct: number;
  isUp: boolean;
  isHidden: boolean;
  isLoading: boolean;
  vipTier: string;
  onToggleHide: () => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onTransfer: () => void;
}) {
  const trendColor = isUp ? "#22c55e" : "#f43f5e"; // emerald / rose

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6 md:p-7"
      style={{
        background: "linear-gradient(135deg,#15192A 0%,#0E1220 50%,#0A0D17 100%)",
      }}
    >
      {/* Aurora glow corners (replaced purple → emerald) */}
      <div className="pointer-events-none absolute -top-24 -right-16 w-56 h-56 rounded-full opacity-[0.10]"
        style={{ background: "#3B82F6" }} />
      <div className="pointer-events-none absolute -bottom-20 -left-16 w-52 h-52 rounded-full opacity-[0.10]"
        style={{ background: "#10b981" }} />
      {/* Diagonal hairlines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-12 -left-24 w-[140%] h-px bg-white/[0.06] rotate-[20deg]" />
        <div className="absolute -bottom-5 -left-24 w-[140%] h-px bg-white/[0.04] rotate-[20deg]" />
      </div>
      {/* Shimmer sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-0 w-32 h-[400px] rotate-[16deg]"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            animation: "qx-sweep 5.5s linear infinite",
          }}
        />
      </div>
      <style>{`@keyframes qx-sweep { 0% { transform: translateX(-260px) rotate(16deg); opacity:0; } 50%{ opacity:0.7; } 100%{ transform: translateX(720px) rotate(16deg); opacity:0; } }`}</style>

      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground">PORTFOLIO BALANCE</span>
          <div className="flex items-center gap-1.5">
            <span className="relative inline-flex w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping" />
              <span className="relative w-1.5 h-1.5 m-auto rounded-full bg-emerald-400" />
            </span>
            <span className="text-[9px] font-bold tracking-[0.1em] text-emerald-400">LIVE</span>
          </div>
        </div>

        {/* Eye + currency chip */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onToggleHide}
            className="w-7 h-6 rounded-md border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors"
            aria-label={isHidden ? "Show balance" : "Hide balance"}
          >
            {isHidden
              ? <EyeOff className="w-3 h-3 text-muted-foreground" />
              : <Eye className="w-3 h-3 text-muted-foreground" />}
          </button>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold tracking-wider text-white">INR</span>
            <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
          </div>
        </div>

        {/* Hero balance */}
        <div className="mt-4">
          {isLoading ? (
            <div className="skeleton-shimmer h-10 w-56 rounded" />
          ) : isHidden ? (
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">••••••••</div>
          ) : (
            <div className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              <AnimatedCounter value={balanceInr} prefix="₹" decimals={2} />
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isHidden
              ? "≈ $•••• · Updated just now"
              : `≈ $${balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Updated just now`}
          </p>
        </div>

        {/* PNL row */}
        <div className="mt-4 flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border"
            style={{
              backgroundColor: `${trendColor}1F`,
              borderColor: `${trendColor}66`,
            }}
          >
            {isUp
              ? <TrendingUp style={{ width: 11, height: 11, color: trendColor }} />
              : <TrendingDown style={{ width: 11, height: 11, color: trendColor }} />}
            <span className="text-xs font-bold" style={{ color: trendColor }}>
              {isHidden
                ? "••••"
                : `${isUp ? "+" : ""}₹${Math.abs(pnlInr).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
            </span>
            <span className="text-[11px] font-bold" style={{ color: trendColor }}>
              {isUp ? "+" : ""}{pnlPct.toFixed(2)}%
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">Today's PNL</span>
          <div className="ml-auto">
            <MiniSparkline width={84} height={32} color={trendColor} isUp={isUp} />
          </div>
        </div>

        {/* Action tiles */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <ActionTile icon={ArrowDownToLine} label="Deposit" color="emerald" onClick={onDeposit} />
          <ActionTile icon={ArrowUpFromLine} label="Withdraw" color="amber" onClick={onWithdraw} />
          <ActionTile icon={ArrowRightLeft} label="Transfer" color="cyan" onClick={onTransfer} />
        </div>
      </div>
    </div>
  );
}

function ActionTile({
  icon: Icon, label, color, onClick,
}: {
  icon: React.ElementType;
  label: string;
  color: "emerald" | "amber" | "cyan";
  onClick?: () => void;
}) {
  const palette = {
    emerald: { hex: "#22c55e", ringTop: "rgba(34,197,94,0.30)", ringBot: "rgba(34,197,94,0.06)" },
    amber:   { hex: "#f59e0b", ringTop: "rgba(245,158,11,0.30)", ringBot: "rgba(245,158,11,0.06)" },
    cyan:    { hex: "#06b6d4", ringTop: "rgba(6,182,212,0.30)", ringBot: "rgba(6,182,212,0.06)" },
  }[color];

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-2 outline-none"
    >
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full opacity-25 blur-md group-hover:opacity-50 transition-opacity"
          style={{ backgroundColor: palette.hex }}
        />
        <div
          className="relative w-14 h-14 rounded-full flex items-center justify-center border transition-transform group-active:scale-95 group-hover:scale-[1.04]"
          style={{
            background: `linear-gradient(155deg, ${palette.ringTop}, ${palette.ringBot})`,
            borderColor: palette.hex,
            boxShadow: `0 6px 18px ${palette.hex}55`,
          }}
        >
          {/* Glossy highlight */}
          <div className="absolute top-0.5 left-0.5 right-0.5 h-6 rounded-full pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0))" }} />
          <Icon className="w-5 h-5 text-white relative" />
        </div>
      </div>
      <span className="text-xs font-semibold text-white/85 tracking-wide">{label}</span>
    </button>
  );
}

function MiniSparkline({ width, height, color, isUp }: { width: number; height: number; color: string; isUp: boolean }) {
  const { line, fill } = useMemo(() => {
    const n = 24;
    const points: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const trend = isUp ? t : -t;
      const noise =
        Math.sin(i * 1.7) * 0.28 + Math.cos(i * 2.3) * 0.18 + Math.sin(i * 0.9) * 0.12;
      points.push(trend + noise);
    }
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const padY = height * 0.12;
    const stepX = width / (points.length - 1);
    const ys = points.map(p => height - padY - ((p - min) / range) * (height - padY * 2));
    let l = "";
    for (let i = 0; i < points.length; i++) {
      const x = i * stepX;
      l += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)} `;
    }
    return { line: l, fill: `${l} L${width.toFixed(2)},${height} L0,${height} Z` };
  }, [width, height, isUp]);

  const gid = `qx-spark-${isUp ? "u" : "d"}-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.5" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gid})`} />
      <path d={line} stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────── Balance Breakdown Tile ─────────────── */

function BreakdownTile({
  label, amount, icon: Icon, accent, sub, hide, profit,
}: {
  label: string;
  amount: number;
  icon: React.ElementType;
  accent: "emerald" | "cyan";
  sub: string;
  hide: boolean;
  profit?: boolean;
}) {
  const palette = accent === "emerald"
    ? { dot: "from-emerald-500 to-emerald-400", ic: "bg-emerald-500/15 text-emerald-400" }
    : { dot: "from-cyan-500 to-cyan-400", ic: "bg-cyan-500/15 text-cyan-400" };
  return (
    <div className="glass-card p-4 rounded-2xl relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${palette.dot} rounded-t-2xl`} />
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`p-1.5 rounded-lg ${palette.ic}`}>
          <Icon style={{ width: 13, height: 13 }} />
        </div>
      </div>
      <div className={`text-xl font-bold ${profit ? "profit-text" : "text-white"}`}>
        {hide ? "$••••" : <AnimatedCounter value={amount} prefix="$" />}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

/* ─────────────── Transaction Row ─────────────── */

const TX_ICON: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  deposit:        { icon: ArrowDownCircle, color: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/25", label: "Deposit" },
  withdrawal:     { icon: ArrowUpCircle,   color: "text-amber-400",   bg: "bg-amber-500/12 border-amber-500/25",     label: "Withdrawal" },
  transfer:       { icon: ArrowRightLeft,  color: "text-cyan-300",    bg: "bg-cyan-500/12 border-cyan-500/25",       label: "Transfer" },
  profit:         { icon: TrendingUp,      color: "text-emerald-400", bg: "bg-emerald-500/12 border-emerald-500/25", label: "Profit" },
  fee:            { icon: DollarSign,      color: "text-rose-400",    bg: "bg-rose-500/12 border-rose-500/25",       label: "Fee" },
  referral_bonus: { icon: DollarSign,      color: "text-teal-300",    bg: "bg-teal-500/12 border-teal-500/25",       label: "Referral" },
  investment:     { icon: TrendingUp,      color: "text-teal-300",    bg: "bg-teal-500/12 border-teal-500/25",       label: "Investment" },
};

function TxRow({ tx }: { tx: any }) {
  const meta = TX_ICON[tx.type] || { icon: Clock, color: "text-muted-foreground", bg: "bg-white/5 border-white/10", label: tx.type };
  const Icon = meta.icon;
  const amount = Math.abs(Number(tx.amount) || 0);
  const inr = amount * FX_RATE;
  const isOut = tx.type === "withdrawal" || tx.type === "fee";
  const sign = isOut ? "−" : "+";
  const sStatus = String(tx.status || "").toLowerCase();
  const statusColor = sStatus === "completed" || sStatus === "approved" || sStatus === "success"
    ? "text-emerald-400"
    : sStatus === "rejected" || sStatus === "failed"
      ? "text-rose-400"
      : "text-amber-400";

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
      <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${meta.bg}`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{meta.label}</div>
        <div className="text-[11px] text-muted-foreground">
          {tx.createdAt ? format(new Date(tx.createdAt), "dd MMM yyyy · hh:mm a") : ""}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${isOut ? "text-rose-400" : "text-emerald-400"}`}>
          {sign}₹{inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </div>
        <div className={`text-[10px] uppercase tracking-wider font-bold ${statusColor}`}>
          {tx.status}
        </div>
      </div>
    </div>
  );
}

function TxRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="skeleton-shimmer w-10 h-10 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton-shimmer h-3 w-24 rounded" />
        <div className="skeleton-shimmer h-2.5 w-32 rounded" />
      </div>
      <div className="space-y-2 text-right">
        <div className="skeleton-shimmer h-3 w-16 rounded ml-auto" />
        <div className="skeleton-shimmer h-2.5 w-12 rounded ml-auto" />
      </div>
    </div>
  );
}

/* ─────────────── BottomSheet (responsive modal) ─────────────── */

function BottomSheet({
  open, onClose, title, subtitle, accent, icon: Icon, rightSlot, children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accent: "emerald" | "amber" | "cyan";
  icon: React.ElementType;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}) {
  const palette = {
    emerald: { ic: "bg-emerald-500/15 text-emerald-400", bar: "from-emerald-500 to-emerald-400" },
    amber:   { ic: "bg-amber-500/15  text-amber-300",    bar: "from-amber-500 to-amber-400" },
    cyan:    { ic: "bg-cyan-500/15   text-cyan-300",     bar: "from-cyan-500 to-cyan-400" },
  }[accent];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-card border border-white/10 shadow-2xl relative"
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden pt-2 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl ${palette.ic} shrink-0`}>
                  <Icon style={{ width: 16, height: 16 }} />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-white truncate">{title}</div>
                  {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rightSlot}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            </div>
            <div className="px-5 pb-[max(120px,env(safe-area-inset-bottom))] pt-2">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────── WalletCard helper (transfer modal) ─────────────── */

function WalletCard({
  badge, badgeTone, icon: Icon, iconTone, name, sub, amount, incoming,
}: {
  badge: string;
  badgeTone: "emerald" | "cyan";
  icon: React.ElementType;
  iconTone: "emerald" | "cyan";
  name: string;
  sub: string;
  amount: number;
  incoming?: number;
}) {
  const tones = {
    emerald: {
      iconBg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-400",
      badge: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
      ring: "border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.07] to-emerald-500/[0.02]",
    },
    cyan: {
      iconBg: "bg-cyan-500/15 border-cyan-400/30 text-cyan-400",
      badge: "border-cyan-400/40 bg-cyan-500/10 text-cyan-300",
      ring: "border-cyan-500/25 bg-gradient-to-br from-cyan-500/[0.07] to-cyan-500/[0.02]",
    },
  };
  const t = tones[iconTone];
  const b = tones[badgeTone];
  const showIncoming = !!incoming && incoming > 0;
  return (
    <div className={`rounded-2xl border ${t.ring} px-3.5 py-3 flex items-center gap-3`}>
      <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${t.iconBg}`}>
        <Icon style={{ width: 19, height: 19 }} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded border ${b.badge}`}>{badge}</span>
          <span className="text-[14px] font-semibold text-white truncate">{name}</span>
        </div>
        <div className="text-[11px] text-white/50 truncate">{sub}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[15px] font-semibold tabular-nums text-white leading-none">
          ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        {showIncoming ? (
          <div className="text-[10px] tabular-nums text-emerald-400 font-semibold mt-1">
            +${incoming!.toFixed(2)}
          </div>
        ) : (
          <div className="text-[10px] text-white/40 tabular-nums mt-1">USD</div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Row helper ─────────────── */

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
