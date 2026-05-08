import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetWallet, useGetDashboardSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ArrowLeft, ArrowRight, Shield, AlertTriangle, Info } from "lucide-react";
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
          <p className="text-[13px] text-white/55 leading-relaxed pl-12">
            {isUsdt
              ? `Send USDT to your TRC20 wallet. Reviewed within 24 hours.`
              : "INR payouts to your bank or UPI within 24 hours of approval."}
          </p>
        </div>

        {/* Available Balance card */}
        <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] text-white/65">Available Balance</span>
          <div className="text-right">
            <div className={cn("text-[18px] font-semibold tabular-nums", isUsdt ? "text-white" : "text-emerald-400")}>
              {isUsdt
                ? `$${mainBal.toFixed(2)}`
                : limits ? `₹${maxInr.toLocaleString("en-IN", { maximumFractionDigits: 3 })}` : "—"}
            </div>
            {!isUsdt && limits && (
              <div className="text-[11px] text-white/45 tabular-nums mt-0.5">
                ≈ ${mainBal.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Withdrawal Amount label + currency toggle */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] text-white/65">Withdrawal Amount</span>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.07]">
            <button
              onClick={() => setCurrency("inr")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors",
                !isUsdt
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                  : "text-white/55 hover:text-white/80 border border-transparent"
              )}
              data-testid="tab-inr"
            >
              <span>₹</span><span>INR</span>
            </button>
            <button
              onClick={() => setCurrency("usdt")}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors",
                isUsdt
                  ? "bg-amber-500/15 text-amber-300 border border-amber-400/40"
                  : "text-white/55 hover:text-white/80 border border-transparent"
              )}
              data-testid="tab-usdt"
            >
              <span>₮</span><span>USDT</span>
            </button>
          </div>
        </div>

        {/* Amount box — big */}
        <div
          className={cn(
            "rounded-2xl border bg-white/[0.025] px-4 py-4 transition-colors flex items-center gap-3",
            numAmount > 0 && !valid
              ? "border-rose-500/45"
              : valid
              ? isUsdt ? "border-amber-400/45" : "border-emerald-400/45"
              : "border-white/[0.10]"
          )}
        >
          <span className={cn("text-[28px] font-bold leading-none select-none shrink-0", isUsdt ? "text-amber-400" : "text-emerald-400")}>
            {symbol}
          </span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className="flex-1 bg-transparent border-0 outline-none text-[30px] font-bold tracking-[-0.02em] tabular-nums placeholder:text-white/25 min-w-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            data-testid="input-amount"
          />
          {numAmount > 0 && (
            <span className="text-[12px] text-white/45 font-mono tabular-nums shrink-0">
              {isUsdt
                ? `≈ ₹${Math.round(inrEquiv).toLocaleString("en-IN")}`
                : `≈ $${usdEquiv.toFixed(2)}`}
            </span>
          )}
        </div>
        <div className="min-h-[14px] mt-1.5 text-[11px] text-rose-400">
          {amountHint}
        </div>

        {/* Percentage chips */}
        <div className="grid grid-cols-4 gap-2 mb-6 mt-2">
          {[
            { label: "25%", pct: 0.25 },
            { label: "50%", pct: 0.5 },
            { label: "75%", pct: 0.75 },
            { label: "MAX", pct: 1 },
          ].map((q) => (
            <button
              key={q.label}
              onClick={() => {
                const base = isUsdt ? sourceBalance : (limits ? maxInr : 0);
                if (base <= 0) return;
                const v = base * q.pct;
                setAmount(isUsdt ? v.toFixed(2) : String(Math.floor(v)));
              }}
              disabled={isUsdt ? sourceBalance <= 0 : !limits || maxInr <= 0}
              className="text-[12px] py-2.5 rounded-lg border border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.06] hover:border-white/20 font-semibold text-white/70 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-white/[0.025] disabled:hover:border-white/[0.07]"
              data-testid={`pct-${q.label}`}
            >
              {q.label}
            </button>
          ))}
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

