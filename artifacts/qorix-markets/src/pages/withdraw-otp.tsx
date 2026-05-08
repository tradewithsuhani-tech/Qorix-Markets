import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, ShieldCheck, Mail, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { clearWithdrawState, readWithdrawState, writeWithdrawSuccess } from "@/lib/withdraw-flow-state";
import { maskAddress } from "@/components/address-display";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (p: string) => `${BASE_URL}/api${p}`;
const apiFetch = (p: string, init?: RequestInit) => authFetch(apiUrl(p), init);

export default function WithdrawOtpPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const state = useMemo(() => readWithdrawState(), []);
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (!state || !state.amount) navigate("/withdraw");
  }, [state, navigate]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  if (!state) return null;
  const isUsdt = state.currency === "usdt";
  const numAmount = Number(state.amount) || 0;

  const resend = async () => {
    if (secondsLeft > 0) return;
    setResending(true);
    try {
      await apiFetch("/auth/withdrawal-otp", { method: "POST" });
      toast({ title: "OTP resent", description: "Check your email." });
      setSecondsLeft(60);
    } catch (err: any) {
      toast({ title: "Resend failed", description: err?.message ?? "Try again", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const submit = async () => {
    if (otp.length < 6 || submitting) return;
    setSubmitting(true);
    try {
      if (isUsdt) {
        const res: any = await apiFetch("/wallet/withdraw", {
          method: "POST",
          body: JSON.stringify({
            amount: numAmount,
            walletAddress: state.walletAddress,
            otp,
            source: state.source,
            // Pass the same integer shape the legacy modal uses — points
            // count was computed from VIP fee + wallet.points on the review
            // step and stored in state, so amounts match what user saw.
            usePoints: state.pointsToSpend ?? 0,
            idempotencyKey: state.idempotencyKey,
          }),
        });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        writeWithdrawSuccess({
          currency: "usdt",
          id: String(res?.id ?? ""),
          createdAt: res?.createdAt ?? new Date().toISOString(),
          source: state.source,
          amount: numAmount,
          netAmount: typeof res?.amount === "number" ? res.amount : numAmount,
          walletAddress: state.walletAddress,
        });
        clearWithdrawState();
        navigate(`/withdraw/success`);
      } else {
        const body: any = {
          amountInr: numAmount,
          payoutMethod: state.payoutMethod,
          otp,
        };
        if (state.payoutMethod === "upi") body.upiId = state.upiId;
        else {
          body.accountHolder = state.accountHolder;
          body.accountNumber = state.accountNumber;
          body.ifsc = state.ifsc;
          if (state.bankName) body.bankName = state.bankName;
        }
        const res: any = await apiFetch("/inr-withdrawals", { method: "POST", body: JSON.stringify(body) });
        const w = res?.withdrawal ?? res;
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        writeWithdrawSuccess({
          currency: "inr",
          id: String(w?.id ?? ""),
          createdAt: w?.createdAt ?? new Date().toISOString(),
          amountInr: numAmount,
          amountUsdt: Number(w?.amountUsdt) || 0,
          rateUsed: Number(w?.rateUsed) || 0,
          payoutMethod: state.payoutMethod,
          upiId: state.upiId,
          accountHolder: state.accountHolder,
          accountNumber: state.accountNumber,
          ifsc: state.ifsc,
          bankName: state.bankName,
        });
        clearWithdrawState();
        navigate(`/withdraw/success`);
      }
    } catch (err: any) {
      // Keep the same idempotency key so a true retry — after a network
      // hiccup where the server may already have processed the request —
      // de-duplicates instead of creating two withdrawals.
      toast({
        title: "Withdrawal failed",
        description: err?.data?.message ?? err?.message ?? "Could not submit withdrawal",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const accent = isUsdt ? "amber" : "emerald";
  const destinationLabel = isUsdt
    ? maskAddress(state.walletAddress ?? "")
    : state.payoutMethod === "upi"
      ? state.upiId
      : `${state.bankName ?? "Bank"} · ****${(state.accountNumber ?? "").slice(-4)}`;

  return (
    <Layout>
      <div className="max-w-md mx-auto px-5 pt-3 pb-28 space-y-5">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <button
              onClick={() => navigate("/withdraw/review")}
              className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors shrink-0"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight">
              Verify & Confirm
            </h1>
          </div>
          <p className="text-[13px] text-white/55 leading-relaxed">
            Enter the 6-digit code sent to your registered email.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 px-3.5 py-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Sending</span>
            <span className="font-bold text-emerald-400">
              {isUsdt ? `$${numAmount.toFixed(2)} USD` : `₹${numAmount.toLocaleString("en-IN")}`}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground shrink-0">To</span>
            <span className="font-mono text-white truncate" title={destinationLabel ?? ""}>
              {destinationLabel}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-3 flex items-start gap-2 text-[12px] text-emerald-300">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          Code valid for 10 minutes. Never share this code with anyone.
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Verification Code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            className={cn(
              "w-full h-16 rounded-xl border bg-white/5 text-center text-3xl font-mono tracking-[0.5em] outline-none transition-colors",
              otp.length === 6 ? "border-emerald-500/60" : "border-white/10"
            )}
            autoFocus
            data-testid="input-otp"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Code sent to your email
            </span>
            <button
              onClick={resend}
              disabled={secondsLeft > 0 || resending}
              className="text-[11px] font-bold text-emerald-400 disabled:text-muted-foreground disabled:cursor-not-allowed hover:underline"
              data-testid="button-resend"
            >
              {resending ? "Sending…" : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
            </button>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={otp.length < 6 || submitting}
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
          data-testid="button-submit"
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Confirm Withdrawal"}
        </button>
      </div>
    </Layout>
  );
}
