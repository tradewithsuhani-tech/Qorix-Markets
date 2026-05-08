import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useGetWallet, useGetDashboardSummary } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { ArrowLeft, AlertCircle, Mail, ShieldCheck, CheckCircle2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { patchWithdrawState, readWithdrawState } from "@/lib/withdraw-flow-state";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (p: string) => `${BASE_URL}/api${p}`;
const apiFetch = (p: string, init?: RequestInit) => authFetch(apiUrl(p), init);

type Limits = { rate: number };

export default function WithdrawReviewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: wallet } = useGetWallet();
  const { data: summary } = useGetDashboardSummary();
  const vip = (summary as any)?.vip;
  const withdrawalFee = (vip?.withdrawalFee ?? 0.02) as number;
  const withdrawalFeePercent = (withdrawalFee * 100).toFixed(1);

  const state = useMemo(() => readWithdrawState(), []);
  const [usePoints, setUsePoints] = useState<boolean>(state?.usePoints ?? false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!state || !state.amount) { navigate("/withdraw"); return; }
    if (state.currency === "usdt" && !state.walletAddress) navigate("/withdraw/usdt");
    if (state.currency === "inr" && !state.payoutMethod) navigate("/withdraw/inr");
  }, [state, navigate]);

  const userPoints = (wallet as any)?.points ?? 0;

  const { data: limits } = useQuery<Limits>({
    queryKey: ["withdrawal-limits"],
    queryFn: () => apiFetch("/withdrawal-limits"),
    enabled: state?.currency === "inr",
  });

  if (!state) return null;

  const isUsdt = state.currency === "usdt";
  const numAmount = Number(state.amount) || 0;

  // Fee calc — only applies to USDT (INR has no points/fee in this view)
  const grossFee = isUsdt ? numAmount * withdrawalFee : 0;
  const maxPointsByValue = Math.floor(grossFee * 0.5 * 100);
  const pointsToSpend = isUsdt && usePoints ? Math.min(userPoints, maxPointsByValue) : 0;
  const pointsDiscount = pointsToSpend * 0.01;
  const feeAmount = isUsdt ? Math.max(0, grossFee - pointsDiscount) : 0;
  const netUsdt = isUsdt ? numAmount - feeAmount : 0;
  const usdtEquivForInr = !isUsdt && limits ? numAmount / limits.rate : 0;

  const sendOtp = async () => {
    setSending(true);
    try {
      await apiFetch("/auth/withdrawal-otp", { method: "POST" });
      patchWithdrawState({ usePoints, pointsToSpend });
      toast({ title: "OTP sent", description: "Enter the code from your email." });
      navigate("/withdraw/otp");
    } catch (err: any) {
      toast({
        title: "Failed to send OTP",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const goBack = () => {
    if (isUsdt) navigate("/withdraw/usdt");
    else navigate("/withdraw/inr");
  };

  const accent = isUsdt ? "amber" : "emerald";

  return (
    <Layout>
      <div className="max-w-md mx-auto px-5 pt-5 pb-28 space-y-5">
        <div className="flex items-center justify-between -mb-1">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-[10px] font-semibold tracking-[0.18em] text-white/45 uppercase">
            Withdraw · 3 / 4
          </div>
          <div className="w-9" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] leading-tight">
            Review your withdrawal
          </h1>
          <p className="text-[13px] text-white/55 leading-relaxed">
            Double-check everything · funds can't be recovered if sent to the wrong place
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Review carefully before sending the OTP.
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 divide-y divide-white/5 text-xs">
          <Row label="Currency" value={isUsdt ? "USDT (TRC20)" : "INR (Direct payout)"} />
          {isUsdt && (
            <Row label="From" value={state.source === "main" ? "Main Balance" : "Profit Balance"} />
          )}
          <Row label="Amount" value={isUsdt ? `$${numAmount.toFixed(2)}` : `₹${numAmount.toLocaleString("en-IN")}`} />

          {isUsdt && (
            <>
              <Row label={`Fee (${withdrawalFeePercent}% · ${vip?.label ?? "Standard"})`} value={`−$${grossFee.toFixed(2)}`} red />
              {userPoints > 0 && maxPointsByValue > 0 && (
                <div className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setUsePoints(!usePoints)}
                    className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 border transition-colors ${
                      usePoints
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                        : "bg-white/[0.02] border-white/10 text-muted-foreground hover:bg-white/[0.04]"
                    }`}
                    data-testid="toggle-points"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                        usePoints ? "bg-amber-400 border-amber-400" : "border-white/20"
                      }`}>
                        {usePoints && <CheckCircle2 className="w-2.5 h-2.5 text-black" />}
                      </span>
                      Use {pointsToSpend > 0 ? pointsToSpend : `up to ${Math.min(userPoints, maxPointsByValue)}`} pts
                      <span className="text-[10px] opacity-70">({userPoints.toLocaleString()} avail)</span>
                    </span>
                    {usePoints && pointsDiscount > 0 && (
                      <span className="text-emerald-400 font-semibold">−${pointsDiscount.toFixed(2)}</span>
                    )}
                  </button>
                </div>
              )}
              <Row label="You'll Receive" value={`$${netUsdt.toFixed(2)} USD`} highlight />
              <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                <span className="text-muted-foreground shrink-0">To Address</span>
                <span className="font-mono text-white text-right break-all" title={state.walletAddress}>
                  {state.walletAddress}
                </span>
              </div>
            </>
          )}

          {!isUsdt && (
            <>
              {limits && (
                <Row label={`Rate · ≈ USDT`} value={`1 USDT = ₹${limits.rate.toFixed(2)} · $${usdtEquivForInr.toFixed(2)}`} />
              )}
              <Row label="Method" value={state.payoutMethod === "upi" ? "UPI" : "Bank Account"} />
              {state.payoutMethod === "upi" ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-muted-foreground shrink-0">UPI ID</span>
                  <span className="font-mono text-white truncate">{state.upiId}</span>
                </div>
              ) : (
                <>
                  <Row label="Holder" value={state.accountHolder ?? "—"} />
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="text-muted-foreground shrink-0">A/C · IFSC</span>
                    <span className="font-mono text-white truncate text-right">
                      {state.accountNumber} · {state.ifsc}
                    </span>
                  </div>
                  {state.bankName && <Row label="Bank" value={state.bankName} />}
                </>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3 flex items-start gap-2 text-[12px] text-emerald-300">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          We'll send a 6-digit verification code to your registered email to confirm this withdrawal.
        </div>

        <button
          onClick={sendOtp}
          disabled={sending}
          className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          style={{
            background:
              isUsdt
                ? "linear-gradient(135deg,#f59e0b,#d97706)"
                : "linear-gradient(135deg,#10b981,#059669)",
            color: isUsdt ? "#0b0b0b" : "#fff",
            boxShadow: isUsdt
              ? "0 6px 22px rgba(245,158,11,0.30)"
              : "0 6px 22px rgba(16,185,129,0.30)",
          }}
          data-testid="button-send-otp"
        >
          <Mail className="w-4 h-4" />
          {sending ? "Sending OTP…" : "Send Verification Code"}
        </button>
      </div>
    </Layout>
  );
}

function Row({ label, value, highlight, red }: { label: string; value: string; highlight?: boolean; red?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-emerald-400" : red ? "text-rose-400" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}
