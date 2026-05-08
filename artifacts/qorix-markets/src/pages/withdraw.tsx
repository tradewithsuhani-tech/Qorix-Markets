import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useGetWallet, useGetDashboardSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ArrowLeft, ArrowRight, Shield, AlertTriangle } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { newIdemKey, patchWithdrawState, readWithdrawState } from "@/lib/withdraw-flow-state";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (p: string) => `${BASE_URL}/api${p}`;
const apiFetch = (p: string, init?: RequestInit) => authFetch(apiUrl(p), init);

const FX_RATE = 83.42;

type Limits = {
  rate: number;
  mainBalance: number;
  inrChannelMaxInr: number;
};

export default function WithdrawPage() {
  const [, navigate] = useLocation();
  const { data: wallet } = useGetWallet();
  const { data: summary } = useGetDashboardSummary();
  const vip = (summary as any)?.vip;
  const withdrawalFeePercent = (((vip?.withdrawalFee ?? 0.02) as number) * 100).toFixed(1);

  const prev = useMemo(() => readWithdrawState(), []);
  const [currency, setCurrency] = useState<"usdt" | "inr">(prev?.currency ?? "usdt");
  const source: "main" = "main";
  const [amount, setAmount] = useState<string>(prev?.amount ?? "");
  const [showAmtError, setShowAmtError] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const mainBal = Number(wallet?.mainBalance) || 0;
  const sourceBalance = mainBal;

  // KYC
  const { data: kycData } = useQuery<any>({
    queryKey: ["kyc-status"],
    queryFn: () => apiFetch("/kyc/status"),
    staleTime: 30_000,
    retry: 1,
  });
  const kycApproved = !kycData ? true : kycData.kycStatus === "approved";

  // INR limits
  const { data: limits } = useQuery<Limits>({
    queryKey: ["withdrawal-limits"],
    queryFn: () => apiFetch("/withdrawal-limits"),
    enabled: currency === "inr",
    staleTime: 15_000,
  });

  const numAmount = Number(amount) || 0;
  const minUsd = 5;
  const minInr = 100;
  const min = currency === "usdt" ? minUsd : minInr;
  const maxInr = limits?.inrChannelMaxInr ?? 0;

  const exceedsBalance = currency === "usdt" ? numAmount > sourceBalance : false;
  const exceedsCap = currency === "inr" && limits ? numAmount > maxInr : false;
  const exceedsMain =
    currency === "inr" && limits
      ? numAmount / (limits.rate || FX_RATE) > limits.mainBalance
      : false;

  const valid =
    numAmount >= min && !exceedsBalance && !exceedsCap && !exceedsMain;

  useEffect(() => {
    if (valid && showAmtError) setShowAmtError(false);
  }, [valid, showAmtError]);

  const handleContinue = () => {
    if (!kycApproved) { navigate("/kyc"); return; }
    if (!valid) { setShowAmtError(true); amountRef.current?.focus(); return; }
    const next = patchWithdrawState({
      currency,
      source: "main",
      amount,
      idempotencyKey: newIdemKey(),
      walletAddress: undefined,
      payoutMethod: undefined,
      upiId: undefined,
      accountHolder: undefined,
      accountNumber: undefined,
      ifsc: undefined,
      bankName: undefined,
      usePoints: false,
      pointsToSpend: 0,
    });
    if (next.currency === "usdt") navigate("/withdraw/usdt");
    else navigate("/withdraw/inr");
  };

  const isUsdt = currency === "usdt";
  const symbol = isUsdt ? "$" : "₹";
  const inrEquiv = isUsdt ? numAmount * FX_RATE : 0;
  const usdEquiv = !isUsdt && limits ? numAmount / (limits.rate || FX_RATE) : 0;
  const quick = isUsdt ? [10, 50, 100, 500] : [500, 2000, 10000, 25000];

  let amountHint = "";
  if (numAmount > 0 && numAmount < min) amountHint = `Minimum ${symbol}${min.toLocaleString(isUsdt ? "en-US" : "en-IN")}`;
  else if (exceedsBalance) amountHint = `Above main balance of $${sourceBalance.toFixed(2)}`;
  else if (exceedsMain) amountHint = `Not enough USDT in main balance`;
  else if (exceedsCap) amountHint = `Above your INR channel cap`;

  return (
    <Layout>
      <div className="max-w-md mx-auto px-5 pt-3 pb-28">
        {/* Header + Title */}
        <div className="flex items-center gap-3 mb-1.5">
          <button
            onClick={() => navigate("/wallet")}
            className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight">
            Withdraw Funds
          </h1>
        </div>
        <div className="space-y-1.5 mb-5">
          <p className="text-[13px] text-white/55 leading-relaxed">
            {isUsdt
              ? `Send USDT to your TRC20 wallet. Reviewed within 24 hours.`
              : "INR payouts to your bank or UPI within 24 hours of approval."}
          </p>
        </div>

        {/* Currency segmented control */}
        <div className="relative grid grid-cols-2 p-1 rounded-2xl border border-white/[0.07] bg-white/[0.025] mb-5">
          <motion.div
            layout
            transition={{ type: "spring", stiffness: 480, damping: 36 }}
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl",
              isUsdt ? "left-1 bg-amber-400/[0.14] border border-amber-400/35" : "left-[calc(50%+1px)] bg-emerald-400/[0.14] border border-emerald-400/35"
            )}
            style={{
              boxShadow: isUsdt
                ? "inset 0 1px 0 rgba(245,158,11,0.18)"
                : "inset 0 1px 0 rgba(16,185,129,0.18)",
            }}
          />
          <button
            onClick={() => setCurrency("usdt")}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-semibold transition-colors",
              isUsdt ? "text-amber-200" : "text-white/55 hover:text-white/80"
            )}
            data-testid="tab-usdt"
          >
            <span className="text-[14px] leading-none">$</span>
            <span>USDT</span>
            <span className="text-[10px] font-medium opacity-60">TRC20</span>
          </button>
          <button
            onClick={() => setCurrency("inr")}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-semibold transition-colors",
              !isUsdt ? "text-emerald-200" : "text-white/55 hover:text-white/80"
            )}
            data-testid="tab-inr"
          >
            <span className="text-[14px] leading-none">₹</span>
            <span>INR</span>
            <span className="text-[10px] font-medium opacity-60">UPI · Bank</span>
          </button>
        </div>

        {/* Available balance — single card */}
        <div className="mb-5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-3 flex items-center justify-between">
          <span className="text-[12px] text-white/55">Available balance</span>
          <div className="text-right">
            <div className={cn("text-[15px] font-semibold tabular-nums", isUsdt ? "text-white" : "text-emerald-300")}>
              {isUsdt
                ? `$${mainBal.toFixed(2)}`
                : limits ? `₹${maxInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
            </div>
            {!isUsdt && limits && (
              <div className="text-[10px] text-white/40 tabular-nums mt-0.5">
                ≈ ${mainBal.toFixed(2)} · 1 USDT = ₹{limits.rate.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Amount — hero input */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase tracking-[0.14em] text-white/40 font-semibold">
              Amount in {isUsdt ? "USD" : "INR"}
            </label>
            <button
              onClick={() => {
                if (isUsdt) setAmount(String(sourceBalance.toFixed(2)));
                else if (limits) setAmount(String(Math.floor(maxInr)));
              }}
              className="text-[10px] font-bold tracking-wider text-white/55 hover:text-white px-2 py-0.5 rounded-md border border-white/10 hover:border-white/25 transition-colors"
              data-testid="button-max"
            >
              MAX
            </button>
          </div>
          <div
            className={cn(
              "rounded-2xl border bg-white/[0.025] px-4 py-3.5 transition-colors",
              numAmount > 0 && !valid
                ? "border-rose-500/45"
                : valid
                ? isUsdt ? "border-amber-400/40" : "border-emerald-400/40"
                : "border-white/[0.07]"
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className={cn("text-[26px] font-semibold leading-none select-none", isUsdt ? "text-amber-300/80" : "text-emerald-300/80")}>
                {symbol}
              </span>
              <input
                ref={amountRef}
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent border-0 outline-none text-[34px] font-semibold tracking-[-0.02em] tabular-nums placeholder:text-white/15 min-w-0"
                data-testid="input-amount"
              />
            </div>
            {numAmount > 0 && (
              <div className="text-[11px] text-white/40 font-mono tabular-nums mt-1.5">
                {isUsdt
                  ? `≈ ₹${Math.round(inrEquiv).toLocaleString("en-IN")}`
                  : `≈ $${usdEquiv.toFixed(2)}`}
              </div>
            )}
          </div>
          <div className="min-h-[14px] mt-1.5 text-[11px] text-rose-400">
            {amountHint}
          </div>
        </div>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-1.5 mb-6">
          {quick.map((a) => {
            const ok = isUsdt ? a <= sourceBalance : a <= (maxInr || a);
            return (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                disabled={!ok}
                className="text-[11px] py-2 rounded-lg border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/15 font-semibold text-white/65 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white/[0.025] disabled:hover:border-white/[0.07] tabular-nums"
                data-testid={`quick-${a}`}
              >
                {isUsdt ? `$${a}` : a >= 1000 ? `₹${a / 1000}K` : `₹${a}`}
              </button>
            );
          })}
        </div>

        {/* Trust strip */}
        <div className="flex items-center gap-2 text-[11px] text-white/45 mb-5">
          <Shield className="w-3 h-3 text-emerald-400/80" />
          <span>
            {isUsdt
              ? `${vip?.label ?? "Standard"} tier · ${withdrawalFeePercent}% fee · OTP confirmed`
              : "Capped per channel · OTP confirmed · 24 hr review"}
          </span>
        </div>

        {/* KYC pill — shown above CTA when needed */}
        {!kycApproved && (
          <button
            onClick={() => navigate("/kyc")}
            className="w-full mb-3 flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 hover:bg-amber-500/[0.10] transition-colors text-left"
            data-testid="kyc-banner"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="flex-1 text-[12px] text-amber-100/90">
              <span className="font-semibold text-amber-300">KYC required</span>
              <span className="text-amber-200/60"> · finish verification to unlock withdrawals</span>
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          </button>
        )}

        {/* CTA */}
        <button
          onClick={handleContinue}
          disabled={!kycApproved || !valid}
          className={cn(
            "w-full h-12 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            isUsdt
              ? "bg-amber-400 hover:bg-amber-300 text-black shadow-[0_4px_18px_-4px_rgba(245,158,11,0.55)]"
              : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_4px_18px_-4px_rgba(16,185,129,0.55)]"
          )}
          data-testid="button-continue"
        >
          {!kycApproved ? "Complete KYC to continue" : "Continue"}
          {kycApproved && <ArrowRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </Layout>
  );
}

