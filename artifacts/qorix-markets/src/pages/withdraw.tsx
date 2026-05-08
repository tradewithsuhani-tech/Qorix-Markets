import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetWallet, useGetDashboardSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ArrowLeft, ArrowUpFromLine, Shield, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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
  const [source, setSource] = useState<"main" | "profit">(prev?.source ?? "profit");
  const [amount, setAmount] = useState<string>(prev?.amount ?? "");
  const [showAmtError, setShowAmtError] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const mainBal = Number(wallet?.mainBalance) || 0;
  const profitBal = Number(wallet?.profitBalance) || 0;
  const sourceBalance = source === "main" ? mainBal : profitBal;

  // KYC
  const { data: kycData } = useQuery<any>({
    queryKey: ["kyc-status"],
    queryFn: () => apiFetch("/kyc/status"),
    staleTime: 30_000,
    retry: 1,
  });
  const kycApproved = !kycData ? true : kycData.kycStatus === "approved";

  // INR limits — only fetched if needed for display/validation
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
    numAmount >= min &&
    !exceedsBalance &&
    !exceedsCap &&
    !exceedsMain;

  useEffect(() => {
    if (valid && showAmtError) setShowAmtError(false);
  }, [valid, showAmtError]);

  const handleContinue = () => {
    if (!kycApproved) {
      navigate("/kyc");
      return;
    }
    if (!valid) {
      setShowAmtError(true);
      amountRef.current?.focus();
      return;
    }
    const next = patchWithdrawState({
      currency,
      source: currency === "usdt" ? source : "main",
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
    });
    if (next.currency === "usdt") navigate("/withdraw/usdt");
    else navigate("/withdraw/inr");
  };

  const symbol = currency === "usdt" ? "$" : "₹";
  const inrEquiv = currency === "usdt" ? numAmount * FX_RATE : 0;
  const usdEquiv = currency === "inr" && limits ? numAmount / (limits.rate || FX_RATE) : 0;

  const quick = currency === "usdt" ? [10, 50, 100, 500] : [500, 2000, 10000, 25000];

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <button
          onClick={() => navigate("/wallet")}
          className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Withdraw Funds</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {currency === "usdt"
              ? "Send USDT to your TRC20 wallet. Reviewed within 24 hours."
              : "Receive INR directly to your UPI ID or bank account."}
          </p>
        </div>

        {!kycApproved && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">KYC required</div>
              <div className="text-amber-200/80 mt-0.5">Complete KYC verification to enable withdrawals.</div>
            </div>
            <button
              onClick={() => navigate("/kyc")}
              className="text-amber-200 font-bold underline shrink-0"
            >
              Complete now
            </button>
          </div>
        )}

        {/* Currency toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl border border-white/10 bg-white/5">
          <button
            onClick={() => setCurrency("usdt")}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
              currency === "usdt"
                ? "bg-amber-500/90 text-amber-950 shadow"
                : "text-white/70 hover:bg-white/5"
            )}
            data-testid="tab-usdt"
          >
            <span className="text-base">$</span> USDT (TRC20)
          </button>
          <button
            onClick={() => setCurrency("inr")}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all",
              currency === "inr"
                ? "bg-emerald-500/90 text-emerald-950 shadow"
                : "text-white/70 hover:bg-white/5"
            )}
            data-testid="tab-inr"
          >
            <span className="text-base">₹</span> INR (UPI / Bank)
          </button>
        </div>

        {/* Source picker — USDT only */}
        {currency === "usdt" && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">From</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setSource("profit"); setAmount(""); }}
                className={cn(
                  "rounded-xl px-3 py-2.5 border text-left transition-all",
                  source === "profit"
                    ? "bg-emerald-500/15 border-emerald-500/50"
                    : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                )}
                data-testid="source-profit"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From Profit</div>
                <div className={cn("text-sm font-bold", source === "profit" ? "text-emerald-400" : "text-white/80")}>
                  ${profitBal.toFixed(2)}
                </div>
              </button>
              <button
                onClick={() => { setSource("main"); setAmount(""); }}
                className={cn(
                  "rounded-xl px-3 py-2.5 border text-left transition-all",
                  source === "main"
                    ? "bg-emerald-500/15 border-emerald-500/50"
                    : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
                )}
                data-testid="source-main"
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">From Main</div>
                <div className={cn("text-sm font-bold", source === "main" ? "text-emerald-400" : "text-white/80")}>
                  ${mainBal.toFixed(2)}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Available — INR */}
        {currency === "inr" && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Main Balance</span>
              <span className="text-sm font-bold text-emerald-400">${mainBal.toFixed(2)}</span>
            </div>
            {limits && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Available to withdraw (INR)</span>
                  <span className="font-bold text-white">
                    ₹{maxInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>Rate</span>
                  <span>1 USDT = ₹{limits.rate.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-muted-foreground">
              Amount ({currency === "usdt" ? "USD" : "INR"})
            </label>
            <button
              onClick={() => {
                if (currency === "usdt") setAmount(String(sourceBalance.toFixed(2)));
                else if (limits) setAmount(String(Math.floor(maxInr)));
              }}
              className="text-[11px] text-amber-200 font-bold px-2 py-1 bg-amber-500/15 rounded-lg hover:bg-amber-500/25 transition"
              data-testid="button-max"
            >
              MAX
            </button>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 h-16 bg-white/5 border transition-colors",
              numAmount > 0 && !valid
                ? "border-rose-500"
                : valid
                ? "border-emerald-500"
                : "border-white/10"
            )}
          >
            <span className="text-2xl font-bold text-emerald-400 select-none">{symbol}</span>
            <input
              ref={amountRef}
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 bg-transparent border-0 outline-none text-3xl font-bold placeholder:text-muted-foreground/50 min-w-0"
              data-testid="input-amount"
            />
            {numAmount > 0 && currency === "usdt" && (
              <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                ≈ ₹{Math.round(inrEquiv).toLocaleString("en-IN")}
              </span>
            )}
            {numAmount > 0 && currency === "inr" && limits && (
              <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                ≈ ${usdEquiv.toFixed(2)}
              </span>
            )}
          </div>

          <div className="mt-1.5 min-h-[16px] text-[11px]">
            {numAmount > 0 && numAmount < min && (
              <span className="text-rose-400">
                Minimum is {symbol}{min.toLocaleString(currency === "inr" ? "en-IN" : "en-US")}.
              </span>
            )}
            {exceedsBalance && (
              <span className="text-rose-400">Amount exceeds your {source} balance (${sourceBalance.toFixed(2)}).</span>
            )}
            {exceedsMain && !exceedsBalance && (
              <span className="text-rose-400">Not enough USDT in main balance for this INR amount.</span>
            )}
            {exceedsCap && !exceedsMain && (
              <span className="text-rose-400">
                Above your INR cap (₹{maxInr.toLocaleString(undefined, { maximumFractionDigits: 0 })}).
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {quick.map((a) => {
            const ok = currency === "usdt" ? a <= sourceBalance : a <= (maxInr || a);
            return (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                disabled={!ok}
                className="text-xs py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 font-semibold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid={`quick-${a}`}
              >
                {currency === "usdt" ? `$${a}` : `₹${(a / 1000).toFixed(0)}K`}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            {currency === "usdt"
              ? `Network fee ${withdrawalFeePercent}% (${vip?.label ?? "Standard"}). Reviewed within 24 hrs.`
              : "Direct INR payout · Capped per channel · OTP-confirmed"}
          </span>
        </div>

        <button
          onClick={handleContinue}
          disabled={!kycApproved || !valid}
          className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background:
              currency === "usdt"
                ? "linear-gradient(135deg,#f59e0b,#d97706)"
                : "linear-gradient(135deg,#10b981,#059669)",
            color: currency === "usdt" ? "#0b0b0b" : "#fff",
            boxShadow:
              currency === "usdt"
                ? "0 6px 22px rgba(245,158,11,0.30)"
                : "0 6px 22px rgba(16,185,129,0.30)",
          }}
          data-testid="button-continue"
        >
          {!kycApproved ? "Complete KYC for Withdrawal" : "Continue"}
          <ArrowUpFromLine className="w-4 h-4" />
        </button>

        {showAmtError && !valid && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-[11px] text-rose-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Enter a valid amount to continue.
          </div>
        )}
      </div>
    </Layout>
  );
}
