import { useGetWallet, useTransferToTrading, useGetDashboardSummary, useGetTransactions, useGetInvestment } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Wallet as WalletIcon, ArrowUpFromLine, ArrowDownToLine,
  ArrowRightLeft, Info, AlertCircle, Mail, ShieldCheck, X,
  CheckCircle2, Clock, Landmark, Eye, EyeOff, TrendingUp, TrendingDown,
  ChevronRight, ChevronDown, ArrowDownCircle, ArrowUpCircle, DollarSign,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { VipBadge } from "@/components/vip-badge";
import { AddressDisplay, maskAddress } from "@/components/address-display";
import { InrWithdrawTab } from "@/components/inr-withdraw-tab";
import { WalletTransferPanel } from "@/components/wallet-transfer-panel";
import { authFetch } from "@/lib/auth-fetch";
import { format } from "date-fns";
import { useInrRate } from "@/hooks/use-inr-rate";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api${path}`; }
async function apiFetch(path: string, options: RequestInit = {}) {
  return authFetch(apiUrl(path), options);
}

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
  const { data: investment } = useGetInvestment();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const FX_RATE = useInrRate();

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
  const [transferSource, setTransferSource] = useState<"usdt" | "main">("usdt");
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

  // Note: usdtBal/mainBal computed below after wallet data is available
  const _usdtBal = Number((wallet as any)?.usdtBalance) || 0;
  const _mainBal = Number(wallet?.mainBalance) || 0;
  const sourceBalance = withdrawSource === ("usdt" as any) ? _usdtBal : withdrawSource === "main" ? _mainBal : (wallet?.profitBalance || 0);

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
            : "Funds moved to your funding balance.",
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
  // mainBalance = INR (legacy users had USDT here, displayed at $1=₹98)
  // usdtBalance = new USDT wallet (TRC20 deposits, P2P buys)
  const INR_DISPLAY_RATE = 98; // legacy main_balance display rate
  const mainBal = Number(wallet?.mainBalance) || 0; // INR amount
  const usdtBal = Number((wallet as any)?.usdtBalance) || 0; // USDT amount
  const tradingBal = Number(wallet?.tradingBalance) || 0;
  const profitBal = Number(wallet?.profitBalance) || 0;
  // Total in USD: main (INR/98) + usdt + trading + profit
  const mainBalUsd = mainBal / INR_DISPLAY_RATE;
  const totalUsd = mainBalUsd + usdtBal + tradingBal + profitBal;
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

  const openTransferModal = () => {
    setTransferAmount("");
    setTransferDirection("toTrading");
    // INR-only accounts: default to Main source (USDT wallet empty).
    setTransferSource(usdtBal > 0 ? "usdt" : "main");
    setActiveModal("transfer");
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
            pnlUsd={dailyPnlUsd}
            pnlPct={dailyPnlPct}
            isUp={isUp}
            isHidden={hideBalance}
            isLoading={isLoading}
            vipTier={vipTier}
            onToggleHide={() => setHideBalance(h => !h)}
            onDeposit={() => navigate("/deposit")}
            onWithdraw={() => navigate("/withdraw")}
            onTransfer={openTransferModal}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <BreakdownTile
                    label="Main Balance (INR)"
                    amount={mainBal}
                    icon={WalletIcon}
                    accent="emerald"
                    sub={`≈ $${(mainBal / FX_RATE).toFixed(2)} USDT · live rate ₹${FX_RATE.toFixed(2)}/$`}
                    hide={hideBalance}
                    isInr
                  />
                  <BreakdownTile
                    label="USDT Wallet"
                    amount={usdtBal}
                    icon={DollarSign}
                    accent="amber"
                    sub="TRC20 deposits & P2P buys"
                    hide={hideBalance}
                  />
                  <BreakdownTile
                    label="Funding Balance"
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
              transactions.slice(0, 6).map((tx: any) => <TxRow key={tx.id} tx={tx} fxRate={FX_RATE} />)
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
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => { setWithdrawSource("usdt" as any); setWithdrawAmount(""); }}
                    className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
                      withdrawSource === ("usdt" as any)
                        ? "bg-amber-500/15 border-amber-500/50"
                        : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">USDT Wallet</div>
                    <div className={`text-sm font-bold ${withdrawSource === ("usdt" as any) ? "text-amber-400" : "text-white/80"}`}>
                      ${usdtBal.toFixed(2)}
                    </div>
                  </button>
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
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Main (INR)</div>
                    <div className={`text-sm font-bold ${withdrawSource === "main" ? "text-emerald-400" : "text-white/80"}`}>
                      ₹{mainBal.toFixed(0)}
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
        <WalletTransferPanel
          fxRate={FX_RATE}
          mainBalInr={mainBal}
          usdtBal={usdtBal}
          tradingBal={tradingBal}
          investment={investment as any}
          transferAmount={transferAmount}
          transferDirection={transferDirection}
          transferSource={transferSource}
          onTransferAmountChange={setTransferAmount}
          onSwapDirection={() => {
            setTransferDirection((d) => (d === "toTrading" ? "toMain" : "toTrading"));
            setTransferAmount("");
          }}
          onSelectSource={(source) => {
            setTransferSource(source);
            setTransferAmount("");
          }}
          transferMutation={transferMutation}
        />
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

/* ─────────────── INR ↔ USDT Exchange Rate Widget ─────────────── */

function InrUsdtRateWidget({
  inrRate,
  mainBalInr,
  usdtBal,
}: {
  inrRate: number;
  mainBalInr: number;
  usdtBal: number;
}) {
  const [inrInput, setInrInput] = useState("");
  const [usdtInput, setUsdtInput] = useState("");
  const [refreshed, setRefreshed] = useState(false);
  const rate = inrRate > 0 ? inrRate : 99;

  const handleInrChange = (val: string) => {
    setInrInput(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      setUsdtInput((n / rate).toFixed(2));
    } else {
      setUsdtInput("");
    }
  };

  const handleUsdtChange = (val: string) => {
    setUsdtInput(val);
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      setInrInput((n * rate).toFixed(2));
    } else {
      setInrInput("");
    }
  };

  const handleRefresh = () => {
    setRefreshed(true);
    setTimeout(() => setRefreshed(false), 1200);
  };

  const canBuyUsdt = mainBalInr > 0 ? (mainBalInr / rate).toFixed(2) : null;

  return (
    <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.05] to-orange-500/[0.03] p-4 relative overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-400 rounded-t-2xl" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/25 flex items-center justify-center shrink-0">
            <span className="text-[13px] font-bold text-amber-300">₹</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white">USDT Markets</div>
            <div className="text-[10px] text-muted-foreground">INR ↔ USDT live rate</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Live rate badge */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="relative inline-flex w-1.5 h-1.5">
              <span className="absolute inset-0 rounded-full bg-amber-400 opacity-60 animate-ping" />
              <span className="relative w-1 h-1 m-auto rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] font-bold text-amber-300 tabular-nums">1 USDT = ₹{rate.toFixed(2)}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="Rate is live"
          >
            <RefreshCw
              className={`w-3 h-3 text-muted-foreground transition-transform ${refreshed ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Converter */}
      <div className="space-y-2">
        {/* INR input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <span className="text-sm font-bold text-emerald-400">₹</span>
            <span className="text-[10px] text-muted-foreground font-semibold">INR</span>
          </div>
          <input
            type="number"
            value={inrInput}
            onChange={(e) => handleInrChange(e.target.value)}
            placeholder="Enter INR amount"
            className="w-full pl-14 pr-16 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.06] transition-colors"
          />
          {mainBalInr > 0 && (
            <button
              onClick={() => handleInrChange(String(mainBalInr.toFixed(2)))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-300 font-bold px-2 py-1 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition"
            >
              MAX
            </button>
          )}
        </div>

        {/* Swap divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-white/8" />
          <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-3 h-3 text-amber-400" />
          </div>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* USDT input */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <span className="text-sm font-bold text-amber-400">$</span>
            <span className="text-[10px] text-muted-foreground font-semibold">USDT</span>
          </div>
          <input
            type="number"
            value={usdtInput}
            onChange={(e) => handleUsdtChange(e.target.value)}
            placeholder="Enter USDT amount"
            className="w-full pl-16 pr-16 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.06] transition-colors"
          />
          {usdtBal > 0 && (
            <button
              onClick={() => handleUsdtChange(String(usdtBal.toFixed(2)))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-300 font-bold px-2 py-1 bg-amber-500/10 rounded-lg hover:bg-amber-500/20 transition"
            >
              MAX
            </button>
          )}
        </div>
      </div>

      {/* Info strip */}
      {canBuyUsdt && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/8 text-xs text-muted-foreground">
          <Info style={{ width: 11, height: 11 }} className="text-amber-400 shrink-0" />
          <span>
            Your main balance (₹{mainBalInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}) ≈{" "}
            <span className="text-amber-300 font-semibold">{canBuyUsdt} USDT</span> at today's rate
          </span>
        </div>
      )}
    </div>
  );
}

/* ─────────────── PortfolioBalanceHero (web port of mobile BalanceCardPro) ─────────────── */

function PortfolioBalanceHero({
  balanceInr, balanceUsd, pnlInr, pnlUsd, pnlPct, isUp, isHidden, isLoading,
  onToggleHide, onDeposit, onWithdraw, onTransfer,
}: {
  balanceInr: number;
  balanceUsd: number;
  pnlInr: number;
  pnlUsd: number;
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
  // Default USD, user can toggle to INR
  const [ccy, setCcy] = useState<"USD" | "INR">("USD");
  const [openCcy, setOpenCcy] = useState(false);
  const isInr = ccy === "INR";
  const heroValue = isInr ? balanceInr : balanceUsd;
  const heroPrefix = isInr ? "₹" : "$";
  const subValue = isInr
    ? `≈ $${balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `≈ ₹${balanceInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const pnlAbs = isInr ? Math.abs(pnlInr) : Math.abs(pnlUsd);
  const pnlStr = isInr
    ? `${isUp ? "+" : "-"}₹${pnlAbs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
    : `${isUp ? "+" : "-"}$${pnlAbs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

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
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenCcy(o => !o)}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              aria-haspopup="listbox"
              aria-expanded={openCcy}
              data-testid="button-currency-toggle"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold tracking-wider text-white">{ccy}</span>
              <ChevronDown className={`w-2.5 h-2.5 text-muted-foreground transition-transform ${openCcy ? "rotate-180" : ""}`} />
            </button>
            {openCcy && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setOpenCcy(false)} />
                <div className="absolute z-30 mt-1 left-0 min-w-[88px] rounded-md border border-white/10 bg-[#0c0d10] shadow-xl overflow-hidden">
                  {(["USD", "INR"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCcy(c); setOpenCcy(false); }}
                      className={`w-full px-3 py-1.5 text-left text-[11px] font-bold tracking-wider transition-colors ${
                        ccy === c ? "bg-emerald-500/15 text-emerald-300" : "text-white hover:bg-white/5"
                      }`}
                      data-testid={`option-currency-${c.toLowerCase()}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
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
              <AnimatedCounter value={heroValue} prefix={heroPrefix} decimals={2} />
            </div>
          )}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isHidden
              ? `≈ ${isInr ? "$" : "₹"}•••• · Updated just now`
              : `${subValue} · Updated just now`}
          </p>
        </div>

        {/* PNL row */}
        <div className="mt-4 flex items-center gap-2 min-w-0">
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border whitespace-nowrap shrink-0"
            style={{
              backgroundColor: `${trendColor}1F`,
              borderColor: `${trendColor}66`,
            }}
          >
            {isUp
              ? <TrendingUp style={{ width: 10, height: 10, color: trendColor }} />
              : <TrendingDown style={{ width: 10, height: 10, color: trendColor }} />}
            <span className="text-[11px] font-bold tabular-nums" style={{ color: trendColor }}>
              {isHidden ? "••••" : pnlStr}
            </span>
            <span className="text-[10px] font-bold opacity-80 tabular-nums" style={{ color: trendColor }}>
              {isUp ? "+" : ""}{pnlPct.toFixed(2)}%
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">Today's PNL</span>
          <div className="ml-auto shrink-0">
            <MiniSparkline width={64} height={28} color={trendColor} isUp={isUp} />
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
    emerald: { fg: "text-emerald-300", iconBg: "bg-emerald-500/12", iconBorder: "border-emerald-400/25", hover: "hover:border-emerald-400/40" },
    amber:   { fg: "text-amber-300",   iconBg: "bg-amber-500/12",   iconBorder: "border-amber-400/25",   hover: "hover:border-amber-400/40" },
    cyan:    { fg: "text-cyan-300",    iconBg: "bg-cyan-500/12",    iconBorder: "border-cyan-400/25",    hover: "hover:border-cyan-400/40" },
  }[color];

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center justify-center gap-1.5 px-2 py-3 rounded-xl bg-white/[0.03] border border-white/[0.08] ${palette.hover} hover:bg-white/[0.06] active:scale-[0.98] transition-all outline-none min-w-0`}
    >
      <span className={`w-9 h-9 rounded-lg ${palette.iconBg} border ${palette.iconBorder} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4 h-4 ${palette.fg}`} />
      </span>
      <span className="text-[12px] font-semibold text-white/90 tracking-tight leading-none">{label}</span>
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
  label, amount, icon: Icon, accent, sub, hide, profit, isInr,
}: {
  label: string;
  amount: number;
  icon: React.ElementType;
  accent: "emerald" | "cyan" | "amber";
  sub: string;
  hide: boolean;
  profit?: boolean;
  isInr?: boolean;
}) {
  const palette = accent === "emerald"
    ? { dot: "from-emerald-500 to-emerald-400", ic: "bg-emerald-500/15 text-emerald-400" }
    : accent === "amber"
    ? { dot: "from-amber-500 to-amber-400", ic: "bg-amber-500/15 text-amber-400" }
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
        {hide
          ? (isInr ? "₹••••" : "$••••")
          : isInr
          ? <AnimatedCounter value={amount} prefix="₹" decimals={0} />
          : <AnimatedCounter value={amount} prefix="$" />
        }
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
  investment:     { icon: TrendingUp,      color: "text-teal-300",    bg: "bg-teal-500/12 border-teal-500/25",       label: "Capital Deployed" },
  topup:          { icon: TrendingUp,      color: "text-teal-300",    bg: "bg-teal-500/12 border-teal-500/25",       label: "Capital Added" },
};

function TxRow({ tx, fxRate }: { tx: any; fxRate: number }) {
  const meta = TX_ICON[tx.type] || { icon: Clock, color: "text-muted-foreground", bg: "bg-white/5 border-white/10", label: tx.type };
  const Icon = meta.icon;
  const amount = Math.abs(Number(tx.amount) || 0);
  const inr = amount * fxRate;
  const isOut = tx.type === "withdrawal" || tx.type === "fee";
  const sign = isOut ? "−" : "+";
  const sStatus = String(tx.status || "").toLowerCase();
  const statusColor = sStatus === "completed" || sStatus === "approved" || sStatus === "success"
    ? "text-emerald-400"
    : sStatus === "rejected" || sStatus === "failed"
      ? "text-rose-400"
      : "text-amber-400";

  return (
    <Link
      href={`/transactions?focus=${tx.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors cursor-pointer"
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${meta.bg}`}>
        <Icon className={`w-4 h-4 ${meta.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{meta.label}</div>
        <div className="text-[11px] text-muted-foreground">
          {tx.createdAt ? format(new Date(tx.createdAt), "dd MMM yyyy · hh:mm a") : ""}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={`text-sm font-bold ${isOut ? "text-rose-400" : "text-emerald-400"}`}>
          {sign}₹{inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </div>
        <div className={`text-[10px] uppercase tracking-wider font-bold ${statusColor}`}>
          {tx.status}
        </div>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-white/30 shrink-0 ml-1" />
    </Link>
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
  iconTone: "emerald" | "cyan" | "amber";
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
    amber: {
      iconBg: "bg-amber-500/15 border-amber-400/30 text-amber-400",
      badge: "border-amber-400/40 bg-amber-500/10 text-amber-300",
      ring: "border-amber-500/25 bg-gradient-to-br from-amber-500/[0.07] to-amber-500/[0.02]",
    },
  } as const;
  const t = tones[iconTone] ?? tones.emerald;
  const b = tones[badgeTone] ?? tones.emerald;
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
