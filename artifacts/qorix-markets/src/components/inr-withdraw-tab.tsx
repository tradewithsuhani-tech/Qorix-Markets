import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import {
  IndianRupee, Building2, Smartphone, AlertCircle, CheckCircle2, Clock, Loader2, ShieldCheck,
  X, Sparkles, Hash, ArrowDownToLine, Copy, Check, Mail, Wallet, FileDown,
} from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useLocation } from "wouter";

import { useAuth } from "@/hooks/use-auth";
import { downloadReceiptPdf } from "@/lib/receipt-pdf";
import { authFetch } from "@/lib/auth-fetch";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
function apiUrl(path: string) { return `${BASE_URL}/api${path}`; }
async function apiFetch(path: string, options: RequestInit = {}) {
  return authFetch(apiUrl(path), options);
}

type Limits = {
  rate: number;
  mainBalance: number;
  totalBalance: number;
  inrChannelOwed: number;
  usdtChannelOwed: number;
  inrChannelMax: number;
  inrChannelMaxInr: number;
  inrChannelOwedInr: number;
};
type Withdrawal = {
  id: number;
  amountInr: number;
  amountUsdt: number;
  rateUsed: number;
  payoutMethod: "upi" | "bank";
  upiId: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  payoutReference: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

export function InrWithdrawTab({ kycApproved, onKycRequired }: { kycApproved: boolean; onKycRequired: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [limits, setLimits] = useState<Limits | null>(null);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  // Receipt modal — opens when user taps any row in their INR withdrawal
  // history. Same celebratory layout as the post-submit success modal but
  // with status-aware colours (emerald=paid, amber=pending, rose=rejected).
  // Designed to be screenshot-friendly so users can share for social proof.
  const [receiptWithdrawal, setReceiptWithdrawal] = useState<Withdrawal | null>(null);
  const [loading, setLoading] = useState(true);

  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [amountInr, setAmountInr] = useState("");
  const [upiId, setUpiId] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // --- OTP step-up state (parity with the USDT path in wallet.tsx) ---
  // Two-step flow: "form" → user fills inputs and clicks Request → server
  // sends 6-digit code to email → "otp" → user enters code and clicks
  // Confirm → actual `POST /inr-withdrawals` with the code in the body.
  // Form fields go read-only while we're in the "otp" step so the user
  // can't change the amount mid-flight (the OTP they just received was
  // bound to the values they confirmed, mentally — keep that contract).
  const [step, setStep] = useState<"form" | "otp">("form");
  const [withdrawOtp, setWithdrawOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);

  // Success modal state — replaces the prior plain toast with a richer
  // celebratory receipt modal so the user gets a clear, confidence-building
  // confirmation that their funds have been held and the request is queued.
  const [successReceipt, setSuccessReceipt] = useState<Withdrawal | null>(null);

  // IFSC auto-verification (Razorpay free IFSC API)
  const [ifscStatus, setIfscStatus] = useState<"idle" | "loading" | "verified" | "error">("idle");
  const [ifscBranchInfo, setIfscBranchInfo] = useState<string>("");

  useEffect(() => {
    const code = ifsc.trim().toUpperCase();
    // Empty → silent idle. User hasn't typed yet.
    if (code.length === 0) {
      setIfscStatus("idle");
      setIfscBranchInfo("");
      return;
    }
    // Typed something but doesn't match the strict 4-letter + 0 + 6-alphanumeric
    // shape that all real Indian IFSCs follow. Surface an explicit error with
    // an example, otherwise the user just sees a grey submit button with no
    // reason (this is exactly the trap that hit a user who typed "PAYTM012345"
    // instead of "PYTM0123456" — the brand name has 5 letters, the bank IFSC
    // prefix has 4).
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      setIfscStatus("error");
      setIfscBranchInfo(
        code.length !== 11
          ? `IFSC must be exactly 11 characters (you typed ${code.length}). Format: 4 letters + 0 + 6 alphanumeric, e.g. HDFC0001234.`
          : "IFSC format wrong. Must be 4 letters + 0 + 6 alphanumeric. Example: HDFC0001234, ICIC0000123, PYTM0123456 (Paytm).",
      );
      return;
    }
    setIfscStatus("loading");
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://ifsc.razorpay.com/${code}`, { signal: ctrl.signal });
        if (!res.ok) {
          setIfscStatus("error");
          setIfscBranchInfo("IFSC code not found in Razorpay registry");
          return;
        }
        const data = await res.json();
        const bank = String(data?.BANK ?? "").trim();
        const branch = String(data?.BRANCH ?? "").trim();
        const city = String(data?.CITY ?? data?.DISTRICT ?? "").trim();
        const state = String(data?.STATE ?? "").trim();
        if (bank) {
          setBankName(bank);
          setIfscBranchInfo([branch, city, state].filter(Boolean).join(", "));
          setIfscStatus("verified");
        } else {
          setIfscStatus("error");
          setIfscBranchInfo("Could not read bank info");
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setIfscStatus("error");
        setIfscBranchInfo("Could not verify IFSC (network error)");
      }
    }, 400);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [ifsc]);

  const refresh = async () => {
    try {
      const [lim, hist] = await Promise.all([
        apiFetch("/withdrawal-limits"),
        apiFetch("/inr-withdrawals/mine"),
      ]);
      setLimits(lim);
      setHistory(hist.withdrawals ?? []);
    } catch {
      // toast handled at submit
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const amount = Number(amountInr) || 0;
  const usdtEquivalent = limits ? +(amount / limits.rate).toFixed(6) : 0;
  const exceedsCap = limits ? amount > limits.inrChannelMaxInr : false;
  const exceedsMain = limits ? usdtEquivalent > limits.mainBalance : false;
  const belowMin = amount > 0 && amount < 100;

  const canSubmit =
    kycApproved &&
    amount >= 100 &&
    !exceedsCap &&
    !exceedsMain &&
    (method === "upi"
      ? /^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upiId.trim())
      : accountHolder.trim().length >= 2 &&
        /^\d{6,20}$/.test(accountNumber.trim()) &&
        /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase()));

  /**
   * Human-readable reason WHY the submit button is currently disabled,
   * shown as a small helper line beneath the button. The button text
   * itself can't change for every possible failure mode, and a silent
   * grey button leaves users guessing — earlier a user reported "bank
   * withdrawal not working" and assumed it was the USDT channel lock,
   * when actually they had typed an 11-char IFSC with the wrong shape
   * ("PAYTM012345" — 5 letters at start instead of 4) and there was
   * no inline message telling them so. Returns null when the form is
   * either submittable or in a state where the button text already
   * communicates the issue (e.g. KYC).
   */
  const disabledReason: string | null = (() => {
    if (!kycApproved) return null;          // button text already says "Complete KYC"
    if (amount === 0) return "Enter the amount you want to withdraw.";
    if (amount < 0) return "Amount must be greater than zero.";
    if (belowMin) return "Minimum withdrawal is ₹100.";
    if (exceedsCap) {
      return `Amount above your INR cap of ₹${limits!.inrChannelMaxInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`;
    }
    if (exceedsMain) return "Amount exceeds your Main Balance.";
    if (method === "upi") {
      const v = upiId.trim();
      if (!v) return "Enter your UPI ID.";
      if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(v)) {
        return "UPI ID format invalid. Example: yourname@okhdfcbank.";
      }
    } else {
      if (accountHolder.trim().length < 2) return "Enter the account holder name.";
      const acc = accountNumber.trim();
      if (!acc) return "Enter the account number.";
      if (!/^\d{6,20}$/.test(acc)) return "Account number must be 6 to 20 digits, no spaces.";
      const code = ifsc.trim().toUpperCase();
      if (!code) return "Enter the IFSC code.";
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
        return "IFSC code format wrong. Must be 4 letters + 0 + 6 alphanumeric (e.g. HDFC0001234, PYTM0123456).";
      }
    }
    return null;
  })();

  // Step 1: validate client-side, then ask the server to send the email OTP.
  // The server uses the shared `withdrawal_confirm` purpose so a single
  // outstanding OTP can be redeemed against either the INR or USDT path
  // (whichever the user submits first; the OTP is consumed on success).
  const requestOtp = async () => {
    if (!kycApproved) { onKycRequired(); return; }
    if (!canSubmit) return;
    setSendingOtp(true);
    try {
      await apiFetch("/auth/withdrawal-otp", { method: "POST" });
      setWithdrawOtp("");
      setStep("otp");
      toast({
        title: "OTP sent",
        description: "Enter the 6-digit code from your email to confirm the withdrawal.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to send OTP",
        description: err?.data?.message ?? err?.message ?? "Could not send the verification code. Try again.",
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  // Step 2: submit the actual withdrawal with the OTP. If the OTP is wrong
  // we land back on the OTP step (server returns `invalid_otp`) so the
  // user can retry without re-entering the form. If the OTP is valid, the
  // server consumes it and books the withdrawal — the user must request a
  // fresh OTP for any subsequent attempt (matches USDT-path behavior).
  const submit = async () => {
    if (!kycApproved) { onKycRequired(); return; }
    if (!canSubmit) return;
    if (step !== "otp") return;
    if (withdrawOtp.trim().length < 6) return;
    setSubmitting(true);
    try {
      const body: any = { amountInr: amount, payoutMethod: method, otp: withdrawOtp.trim() };
      if (method === "upi") body.upiId = upiId.trim();
      else {
        body.accountHolder = accountHolder.trim();
        body.accountNumber = accountNumber.trim();
        body.ifsc = ifsc.trim().toUpperCase();
        if (bankName.trim()) body.bankName = bankName.trim();
      }
      const resp = await apiFetch("/inr-withdrawals", { method: "POST", body: JSON.stringify(body) });
      // Show celebratory receipt modal instead of a plain toast. Includes the
      // server-issued reference id, exact USDT held, payout target, and ETA so
      // the user has a one-glance proof that the request is queued.
      if (resp?.withdrawal) setSuccessReceipt(resp.withdrawal as Withdrawal);
      setAmountInr("");
      setUpiId(""); setAccountHolder(""); setAccountNumber(""); setIfsc(""); setBankName("");
      setWithdrawOtp(""); setStep("form");
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      refresh();
    } catch (err: any) {
      // On `invalid_otp` we keep the user on the OTP step so they can retry
      // without losing their form values. On any other error we still keep
      // the form values but surface the server message.
      const errCode = err?.data?.error;
      toast({
        title: errCode === "invalid_otp" ? "Invalid code" : "Withdrawal failed",
        description: err?.data?.message ?? err?.message ?? "Could not submit withdrawal",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOtp = () => {
    setStep("form");
    setWithdrawOtp("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading INR limits…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cap summary */}
      {limits && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <IndianRupee style={{ width: 12, height: 12 }} />
              Available for INR withdrawal
            </span>
            <span className="font-bold text-emerald-300">
              ₹{limits.inrChannelMaxInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Rate</span>
            <span className="text-white">1 USDT = ₹{limits.rate.toFixed(2)}</span>
          </div>
          {limits.usdtChannelOwed > 0.01 && (
            <div className="flex items-start gap-1.5 text-[11px] text-amber-300/90 mt-1">
              <AlertCircle style={{ width: 11, height: 11 }} className="mt-0.5 shrink-0" />
              <span>
                <b>${limits.usdtChannelOwed.toFixed(2)} USDT</b> of your balance is reserved for crypto (TRC20)
                withdrawal only — you deposited that via crypto, so it has to leave the same way.
                {" "}
                <span className="text-emerald-300/90">
                  The remaining <b>₹{limits.inrChannelMaxInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                  {" "}can be withdrawn freely via either UPI or Bank Transfer — your choice.
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Method picker */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMethod("upi")}
          className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
            method === "upi" ? "bg-amber-500/15 border-amber-500/50" : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Smartphone style={{ width: 13, height: 13 }} className={method === "upi" ? "text-amber-300" : "text-muted-foreground"} />
            <span className={`text-sm font-semibold ${method === "upi" ? "text-amber-300" : "text-white/80"}`}>UPI</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Instant · GPay/PhonePe/Paytm</div>
        </button>
        <button
          onClick={() => setMethod("bank")}
          className={`rounded-xl px-3 py-2.5 border text-left transition-all ${
            method === "bank" ? "bg-blue-500/15 border-blue-500/50" : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Building2 style={{ width: 13, height: 13 }} className={method === "bank" ? "text-blue-300" : "text-muted-foreground"} />
            <span className={`text-sm font-semibold ${method === "bank" ? "text-blue-300" : "text-white/80"}`}>Bank Transfer</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">IMPS · 30 min – 24h</div>
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Amount (INR)</label>
        <div className="relative">
          <input
            type="number"
            value={amountInr}
            onChange={(e) => setAmountInr(e.target.value)}
            className="field-input pr-14"
            placeholder="1000"
            min="100"
          />
          <button
            type="button"
            onClick={() => limits && setAmountInr(String(Math.floor(limits.inrChannelMaxInr)))}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-emerald-400 font-bold px-2 py-1 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition"
          >
            MAX
          </button>
        </div>
        {amount > 0 && (
          <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
            <span>≈ ${usdtEquivalent.toFixed(2)} USDT held</span>
            {belowMin && <span className="text-red-400">Min ₹100</span>}
            {exceedsCap && !belowMin && (
              <span className="text-red-400">
                Max ₹{limits!.inrChannelMaxInr.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            )}
            {exceedsMain && !exceedsCap && !belowMin && (
              <span className="text-red-400">Exceeds Main Balance</span>
            )}
          </div>
        )}
      </div>

      {/* Payout details */}
      {method === "upi" ? (
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1.5 block">UPI ID</label>
          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            className="field-input"
            placeholder="yourname@okhdfcbank"
            autoCapitalize="none"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Account Holder Name</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="field-input"
              placeholder="As per bank records"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
              className="field-input font-mono"
              placeholder="1234567890"
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block flex items-center gap-1.5">
                IFSC Code
                {ifscStatus === "loading" && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                )}
                {ifscStatus === "verified" && (
                  <span className="inline-flex items-center gap-0.5 text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[10px] font-semibold">Verified</span>
                  </span>
                )}
                {ifscStatus === "error" && (
                  <span className="inline-flex items-center gap-0.5 text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    <span className="text-[10px] font-semibold">Invalid</span>
                  </span>
                )}
              </label>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                className={`field-input font-mono uppercase ${
                  ifscStatus === "verified" ? "border-emerald-500/50" :
                  ifscStatus === "error" ? "border-red-500/50" : ""
                }`}
                placeholder="HDFC0001234"
                maxLength={11}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block flex items-center gap-1.5">
                Bank Name
                {ifscStatus === "verified" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className={`field-input ${ifscStatus === "verified" ? "bg-emerald-500/5 border-emerald-500/30" : ""}`}
                placeholder="HDFC Bank"
                readOnly={ifscStatus === "verified"}
              />
            </div>
          </div>
          {ifscBranchInfo && (
            <div className={`text-[11px] px-3 py-2 rounded-lg flex items-start gap-2 ${
              ifscStatus === "verified"
                ? "bg-emerald-500/8 border border-emerald-500/20 text-emerald-300"
                : "bg-red-500/8 border border-red-500/20 text-red-300"
            }`}>
              {ifscStatus === "verified" ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">
                {ifscStatus === "verified" ? <><span className="font-semibold">Branch:</span> {ifscBranchInfo}</> : ifscBranchInfo}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Submit / OTP — two-step flow gated on email verification.
          step === "form": user clicks "Confirm & Send Code" → requestOtp.
          step === "otp":  6-digit input + Back/Confirm buttons → submit. */}
      <AnimatePresence mode="wait" initial={false}>
        {step === "form" ? (
          <motion.div
            key="form-submit"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            <button
              onClick={requestOtp}
              disabled={!canSubmit || sendingOtp}
              className="btn w-full flex items-center justify-center gap-2"
              style={{
                background: canSubmit && !sendingOtp ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(255,255,255,0.05)",
                color: canSubmit && !sendingOtp ? "#fff" : "rgba(255,255,255,0.4)",
                boxShadow: canSubmit && !sendingOtp ? "0 4px 18px rgba(16,185,129,0.3)" : "none",
              }}
            >
              {sendingOtp ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending code…</>
              ) : !kycApproved ? (
                <><ShieldCheck style={{ width: 14, height: 14 }} /> Complete KYC for Withdrawal</>
              ) : (
                <><Mail style={{ width: 14, height: 14 }} /> Confirm & Send Code{amount > 0 ? ` (₹${amount.toFixed(0)})` : ""}</>
              )}
            </button>

            {/* Inline reason WHY the button is disabled — never leave the user
                guessing in front of a grey button. */}
            {disabledReason && !sendingOtp && (
              <div className="flex items-start gap-1.5 text-[11px] text-amber-300/90 px-1">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{disabledReason}</span>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="otp-step"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="space-y-2"
          >
            {/* Confirmation summary — shows the exact request the OTP authorizes.
                If the user edits the form after requesting the OTP, the server
                still validates whatever values they finally POST; this summary
                surfaces what they typed at request time as a sanity anchor. */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 text-[11px] space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Withdrawing</span>
                <span className="text-emerald-300 font-bold">
                  ₹{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">To</span>
                <span className="font-mono text-white truncate">
                  {method === "upi"
                    ? upiId.trim()
                    : `${(bankName.trim() || "Bank")} · ${accountNumber.trim()} · ${ifsc.trim().toUpperCase()}`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2">
              <ShieldCheck style={{ width: 13, height: 13 }} />
              Enter the 6-digit code sent to your email
            </div>
            {/* Styled 6-slot OTP entry — replaces the legacy single-input
                box. Each slot is an individual rounded card on dark bg with
                an emerald glow on the active slot, matching the green
                Confirm Withdrawal button below. Digits-only input is
                enforced by REGEXP_ONLY_DIGITS, paste of a 6-digit code
                fills all slots, and the cancel (X) sits to the right with
                matching height/weight so the row stays balanced. */}
            <div className="flex items-center justify-center gap-2 py-1">
              <InputOTP
                maxLength={6}
                value={withdrawOtp}
                onChange={(v) => setWithdrawOtp(v)}
                pattern={REGEXP_ONLY_DIGITS}
                autoFocus
                inputMode="numeric"
                containerClassName="gap-2"
                aria-label="6 digit withdrawal verification code"
              >
                <InputOTPGroup className="gap-2">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-12 w-9 sm:w-11 rounded-lg border border-white/10 bg-white/5 text-xl font-mono font-bold text-white shadow-none transition-colors hover:border-white/20"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <button
                onClick={cancelOtp}
                disabled={submitting}
                className="h-12 w-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 shrink-0"
                title="Cancel and go back"
                aria-label="Cancel and go back to form"
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>
            <button
              onClick={submit}
              disabled={submitting || withdrawOtp.length < 6 || !canSubmit}
              className="btn w-full flex items-center justify-center gap-2"
              style={{
                background: !submitting && withdrawOtp.length >= 6 && canSubmit ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(255,255,255,0.05)",
                color: !submitting && withdrawOtp.length >= 6 && canSubmit ? "#fff" : "rgba(255,255,255,0.4)",
                boxShadow: !submitting && withdrawOtp.length >= 6 && canSubmit ? "0 4px 18px rgba(16,185,129,0.3)" : "none",
              }}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
              ) : (
                <>Confirm Withdrawal</>
              )}
            </button>
            <button
              onClick={requestOtp}
              disabled={sendingOtp || submitting}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline-offset-2 hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {sendingOtp ? "Sending…" : "Didn't receive it? Send a new code"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-300/90">
        <Clock className="w-3 h-3 mt-0.5 shrink-0" />
        <span>
          Funds are deducted from your Main Balance immediately and held until admin payout.
          Admin processes within <b>24 hours</b>. Rejected requests are auto-refunded.
        </span>
      </div>

      {/* High-load delay banner: any pending withdrawal older than 30 min
           means the merchant + admin escalation chain has fired and we owe
           the user a heads-up so they don't keep refreshing. */}
      {history.some(
        (w) => w.status === "pending" && Date.now() - new Date(w.createdAt).getTime() > 30 * 60 * 1000,
      ) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[11px] text-amber-200 flex items-start gap-2">
          <Clock className="w-3 h-3 mt-0.5 shrink-0" />
          <span>
            <b>Heavy load — payout delayed.</b> Our team is working through a backlog. Your INR
            withdrawal will be paid out shortly; no action needed.
          </span>
        </div>
      )}

      {/* Celebratory success receipt modal — replaces the prior plain toast.
          Reads the executed rate straight off the server response (`rateUsed`)
          rather than current `limits.rate`, so the displayed receipt cannot
          drift if the platform rate is changed between submit and render. */}
      <WithdrawalSuccessModal
        receipt={successReceipt}
        onClose={() => setSuccessReceipt(null)}
      />

      {/* History receipt modal — opens when a row in "Recent INR Withdrawals"
          is tapped. Mirrors the post-submit success layout but adapts colours
          and copy to the actual status (pending/approved/rejected) so users
          can screenshot and share for any state. */}
      <WithdrawalReceiptModal
        receipt={receiptWithdrawal}
        onClose={() => setReceiptWithdrawal(null)}
      />

      {/* History */}
      {history.length > 0 && (
        <div id="inr-withdraw-history" className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pt-2">Recent INR Withdrawals</div>
          <AnimatePresence initial={false}>
            {history.slice(0, 5).map((w) => (
              <motion.button
                key={w.id}
                type="button"
                onClick={() => setReceiptWithdrawal(w)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full text-left rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs space-y-1 hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors cursor-pointer"
                aria-label={`View receipt for ₹${w.amountInr} withdrawal`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">
                    ₹{w.amountInr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <StatusPill status={w.status} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {w.payoutMethod === "upi" ? `UPI · ${w.upiId}` : `${w.bankName ?? "Bank"} · ${w.accountNumber}`}
                  </span>
                  <span>{new Date(w.createdAt).toLocaleString()}</span>
                </div>
                {w.payoutReference && w.status === "approved" && (
                  <div className="text-[10px] text-emerald-300/90">Ref: {w.payoutReference}</div>
                )}
                {w.adminNote && (
                  <div className="text-[10px] text-amber-300/80">Note: {w.adminNote}</div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
  const styles =
    status === "approved"
      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
      : status === "rejected"
        ? "bg-red-500/15 border-red-500/40 text-red-300"
        : "bg-amber-500/15 border-amber-500/40 text-amber-300";
  const Icon = status === "approved" ? CheckCircle2 : status === "rejected" ? AlertCircle : Clock;
  const label = status === "approved" ? "Paid" : status === "rejected" ? "Rejected" : "Pending";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border ${styles}`}>
      <Icon style={{ width: 10, height: 10 }} /> {label}
    </span>
  );
}

/**
 * Celebratory withdrawal success modal.
 *
 * Renders a polished receipt overlay when an INR withdrawal request is
 * accepted by the server. Shows: animated check, big amount, USDT held,
 * payout target (UPI / bank), reference id, ETA, and CTAs.
 *
 * Closing the modal does not affect the underlying state — the history list
 * below already reflects the new pending entry, so the user can see it again
 * any time. Body scroll is locked while open for focus.
 */
function WithdrawalSuccessModal({
  receipt,
  onClose,
}: {
  receipt: Withdrawal | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [, navigate] = useLocation();

  // Lock body scroll while modal is open so the celebratory animation gets the
  // user's full attention and the form below doesn't bleed through visually.
  useEffect(() => {
    if (!receipt) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [receipt]);

  // Auto-reset the "copied" pill after 1.6s so the affordance can be re-used.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!receipt) return null;

  const refCode = `WT-${String(receipt.id).padStart(6, "0")}`;
  const isUpi = receipt.payoutMethod === "upi";
  const submittedAt = new Date(receipt.createdAt);

  const maskAcc = (n: string | null): string => {
    if (!n) return "—";
    const last4 = n.slice(-4);
    return `${"*".repeat(Math.max(4, n.length - 4))}${last4}`;
  };

  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(refCode);
      setCopied(true);
    } catch {
      /* clipboard not available — silently ignore */
    }
  };

  const goToWallet = () => {
    onClose();
    setTimeout(() => navigate("/wallet"), 60);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          key="card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md my-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c0d10] via-[#0a0b0e] to-[#06070a] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-5 sm:p-6 space-y-5"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Hero clock with concentric rings */}
          <div className="flex flex-col items-center pt-2 pb-1">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14 }}
              className="relative w-32 h-32 flex items-center justify-center"
            >
              <span className="absolute inset-0 rounded-full border border-amber-500/15" />
              <span className="absolute inset-3 rounded-full border border-amber-500/25" />
              <span className="absolute inset-6 rounded-full border border-amber-500/40" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.05 }}
                className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center shadow-[0_0_40px_-6px_rgba(245,158,11,0.7)]"
              >
                <Clock className="w-10 h-10 text-white" strokeWidth={2.5} />
              </motion.div>
            </motion.div>
            <div className="mt-5 text-[11px] tracking-[0.28em] font-bold text-amber-400">
              WITHDRAWAL SUBMITTED
            </div>
            <div className="mt-3 text-4xl font-bold text-white tabular-nums">
              ₹{receipt.amountInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground text-center px-4">
              Pending compliance review · NEFT/IMPS within 24 hours
            </div>
          </div>

          {/* Compliance banner */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-xs text-white">
              Queued for compliance review · You'll be notified on credit
            </span>
          </div>

          {/* Withdrawal Details card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-5 pt-4 pb-3 text-[10px] tracking-[0.22em] font-bold text-white/55">
              WITHDRAWAL DETAILS
            </div>
            <div className="px-5 pb-5 space-y-3">
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Method</span>
                <span className="text-xs font-semibold text-white inline-flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 inline-flex items-center justify-center shrink-0 text-[10px] font-bold text-emerald-300">
                    {isUpi ? <Smartphone className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                  </span>
                  <span className="truncate">
                    {isUpi ? "UPI Transfer" : "Bank Account · NEFT/IMPS"}
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Amount Debited</span>
                <span className="text-xs font-bold text-rose-400 tabular-nums">
                  − ₹{receipt.amountInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <span className="text-xs text-white/55 shrink-0">Beneficiary</span>
                <span className="text-xs font-semibold text-white text-right min-w-0 truncate">
                  {isUpi ? (
                    <span className="font-mono">{receipt.upiId ?? "—"}</span>
                  ) : (
                    <>
                      {receipt.accountHolder ?? "—"}
                      <span className="text-white/55 font-mono ml-1">· {maskAcc(receipt.accountNumber)}</span>
                    </>
                  )}
                </span>
              </div>
              {!isUpi && receipt.ifsc && (
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-xs text-white/55">IFSC</span>
                  <span className="text-xs font-mono font-semibold text-white">{receipt.ifsc}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <span className="text-xs text-white/55 shrink-0">Reference</span>
                <button
                  type="button"
                  onClick={copyRef}
                  className="text-xs font-mono font-semibold text-white inline-flex items-center gap-2 hover:text-emerald-300 transition-colors min-w-0"
                >
                  <span className="truncate">{refCode}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/50 shrink-0" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Date &amp; Time</span>
                <span className="text-xs font-semibold text-white">
                  {submittedAt.toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-[11px] font-semibold text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Pending
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={goToWallet}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_28px_-6px_rgba(16,185,129,0.65)] transition-all inline-flex items-center justify-center gap-2"
          >
            <Wallet className="w-4 h-4" />
            Back to Wallet
          </button>
          <p className="text-[10px] text-center text-white/45 leading-relaxed -mt-1">
            If rejected, the held amount auto-refunds to your Main Balance.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * WithdrawalReceiptModal — opened when the user taps any row in their INR
 * withdrawal history. Mirrors the post-submit success layout with colour /
 * copy adapted to the actual status:
 *
 *   pending  → amber clock     · "WITHDRAWAL SUBMITTED"
 *   approved → emerald check   · "WITHDRAWAL PAID"
 *   rejected → rose cross      · "WITHDRAWAL REJECTED" (held funds refunded)
 *
 * Designed to be screenshot-friendly so users can share their receipt for
 * social proof / community marketing.
 */
function WithdrawalReceiptModal({
  receipt,
  onClose,
}: {
  receipt: Withdrawal | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!receipt) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [receipt]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  if (!receipt) return null;

  const refCode = `WT-${String(receipt.id).padStart(6, "0")}`;
  const isUpi = receipt.payoutMethod === "upi";

  const maskAcc = (n: string | null): string => {
    if (!n) return "—";
    const last4 = n.slice(-4);
    return `${"*".repeat(Math.max(4, n.length - 4))}${last4}`;
  };

  const submittedAt = new Date(receipt.createdAt);
  const reviewedAt = receipt.reviewedAt ? new Date(receipt.reviewedAt) : null;
  const dateToShow = receipt.status !== "pending" && reviewedAt ? reviewedAt : submittedAt;
  const dateLabel = receipt.status === "pending" ? "Submitted" : receipt.status === "approved" ? "Paid On" : "Reviewed";

  const theme =
    receipt.status === "approved"
      ? {
          ring: "border-emerald-500/15",
          ring2: "border-emerald-500/25",
          ring3: "border-emerald-500/40",
          hub: "bg-emerald-500 shadow-[0_0_40px_-6px_rgba(16,185,129,0.75)]",
          label: "WITHDRAWAL PAID",
          labelText: "text-emerald-400",
          subtitle: receipt.payoutReference
            ? `Sent via ${isUpi ? "UPI" : "NEFT/IMPS"} · Ref ${receipt.payoutReference}`
            : `Sent to your ${isUpi ? "UPI" : "bank account"}`,
          banner: "border-emerald-500/30 bg-emerald-500/10",
          bannerIcon: "text-emerald-300",
          bannerText: <>Paid by Qorix · <span className="font-semibold text-emerald-200">₹{receipt.amountInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span> credited to beneficiary</>,
          pillBg: "bg-emerald-500/15 border-emerald-500/35 text-emerald-300",
          pillDot: "bg-emerald-400",
          pillLabel: "Paid",
          icon: <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 text-white" strokeWidth={2.5} />,
          amountColor: "text-rose-400",
          amountLabel: "Amount Debited",
        }
      : receipt.status === "rejected"
      ? {
          ring: "border-rose-500/15",
          ring2: "border-rose-500/25",
          ring3: "border-rose-500/40",
          hub: "bg-rose-500 shadow-[0_0_40px_-6px_rgba(244,63,94,0.7)]",
          label: "WITHDRAWAL REJECTED",
          labelText: "text-rose-400",
          subtitle: receipt.adminNote
            ? `Reviewed · ${receipt.adminNote}`
            : "Held amount auto-refunded to your Main Balance",
          banner: "border-rose-500/30 bg-rose-500/10",
          bannerIcon: "text-rose-300",
          bannerText: <>Refunded · <span className="font-semibold text-rose-200">₹{receipt.amountInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span> returned to Main Balance</>,
          pillBg: "bg-rose-500/15 border-rose-500/35 text-rose-300",
          pillDot: "bg-rose-400",
          pillLabel: "Rejected",
          icon: <AlertCircle className="w-9 h-9 sm:w-11 sm:h-11 text-white" strokeWidth={2.5} />,
          amountColor: "text-white",
          amountLabel: "Amount Requested",
        }
      : {
          ring: "border-amber-500/15",
          ring2: "border-amber-500/25",
          ring3: "border-amber-500/40",
          hub: "bg-amber-500 shadow-[0_0_40px_-6px_rgba(245,158,11,0.7)]",
          label: "WITHDRAWAL SUBMITTED",
          labelText: "text-amber-400",
          subtitle: "Pending compliance review · NEFT/IMPS within 24 hours",
          banner: "border-amber-500/30 bg-amber-500/10",
          bannerIcon: "text-amber-300",
          bannerText: <>Queued for compliance review · You'll be notified on credit</>,
          pillBg: "bg-amber-500/15 border-amber-500/35 text-amber-300",
          pillDot: "bg-amber-400",
          pillLabel: "Pending",
          icon: <Clock className="w-9 h-9 sm:w-11 sm:h-11 text-white" strokeWidth={2.5} />,
          amountColor: "text-rose-400",
          amountLabel: "Amount Debited",
        };

  const copyRef = () => {
    navigator.clipboard.writeText(refCode).then(() => setCopied(true)).catch(() => {});
  };

  const goToWallet = () => { onClose(); setTimeout(() => navigate("/wallet"), 60); };

  return (
    <AnimatePresence>
      <motion.div
        key="wreceipt-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center px-4 py-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          key="wreceipt-card"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md my-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c0d10] via-[#0a0b0e] to-[#06070a] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-5 sm:p-6 space-y-4 sm:space-y-5"
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Hero icon with concentric rings */}
          <div className="flex flex-col items-center pt-1 sm:pt-2">
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14 }}
              className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center"
            >
              <span className={`absolute inset-0 rounded-full border ${theme.ring}`} />
              <span className={`absolute inset-3 rounded-full border ${theme.ring2}`} />
              <span className={`absolute inset-6 rounded-full border ${theme.ring3}`} />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.05 }}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center ${theme.hub}`}
              >
                {theme.icon}
              </motion.div>
            </motion.div>
            <div className={`mt-3 sm:mt-5 text-[11px] tracking-[0.28em] font-bold ${theme.labelText}`}>
              {theme.label}
            </div>
            <div className="mt-2 sm:mt-3 text-3xl sm:text-4xl font-bold text-white tabular-nums">
              ₹{receipt.amountInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className="mt-1.5 sm:mt-2 text-xs text-muted-foreground text-center px-2">
              {theme.subtitle}
            </div>
          </div>

          {/* Banner */}
          <div className={`rounded-2xl border ${theme.banner} px-4 py-3 flex items-start gap-3`}>
            <ShieldCheck className={`w-4 h-4 mt-0.5 shrink-0 ${theme.bannerIcon}`} />
            <span className="text-xs text-white leading-relaxed">{theme.bannerText}</span>
          </div>

          {/* Withdrawal Details card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-5 pt-4 pb-3 text-[10px] tracking-[0.22em] font-bold text-white/55">
              WITHDRAWAL DETAILS
            </div>
            <div className="px-5 pb-5 space-y-3">
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Method</span>
                <span className="text-xs font-semibold text-white inline-flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 inline-flex items-center justify-center shrink-0">
                    {isUpi ? <Smartphone className="w-3.5 h-3.5 text-emerald-300" /> : <Building2 className="w-3.5 h-3.5 text-emerald-300" />}
                  </span>
                  <span className="truncate">{isUpi ? "UPI Transfer" : "Bank Account · NEFT/IMPS"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">{theme.amountLabel}</span>
                <span className={`text-xs font-bold tabular-nums ${theme.amountColor}`}>
                  − ₹{receipt.amountInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <span className="text-xs text-white/55 shrink-0">Beneficiary</span>
                <span className="text-xs font-semibold text-white text-right min-w-0 truncate">
                  {isUpi ? (
                    <span className="font-mono">{receipt.upiId ?? "—"}</span>
                  ) : (
                    <>
                      {receipt.accountHolder ?? "—"}
                      <span className="text-white/55 font-mono ml-1">· {maskAcc(receipt.accountNumber)}</span>
                    </>
                  )}
                </span>
              </div>
              {!isUpi && receipt.ifsc && (
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="text-xs text-white/55">IFSC</span>
                  <span className="text-xs font-mono font-semibold text-white">{receipt.ifsc}</span>
                </div>
              )}
              {receipt.payoutReference && receipt.status === "approved" && (
                <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                  <span className="text-xs text-white/55 shrink-0">Payout Ref</span>
                  <span className="text-xs font-mono font-semibold text-emerald-300 truncate">{receipt.payoutReference}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3">
                <span className="text-xs text-white/55 shrink-0">Reference</span>
                <button
                  type="button"
                  onClick={copyRef}
                  className="text-xs font-mono font-semibold text-white inline-flex items-center gap-2 hover:text-emerald-300 transition-colors min-w-0"
                >
                  <span className="truncate">{refCode}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-white/50 shrink-0" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">{dateLabel}</span>
                <span className="text-xs font-semibold text-white">
                  {dateToShow.toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Status</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${theme.pillBg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.pillDot} ${receipt.status === "pending" ? "animate-pulse" : ""}`} />
                  {theme.pillLabel}
                </span>
              </div>
            </div>
          </div>

          {/* CTAs */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                const beneficiary = isUpi
                  ? receipt.upiId ?? "—"
                  : `${receipt.accountHolder ?? "—"} · ${maskAcc(receipt.accountNumber)}`;
                downloadReceiptPdf({
                  kind: "withdrawal",
                  reference: refCode,
                  status: receipt.status,
                  statusLabel: theme.pillLabel,
                  headlineLabel: theme.label,
                  amountInr: receipt.amountInr,
                  amountUsdt: receipt.amountUsdt,
                  rateUsed: receipt.rateUsed,
                  method: isUpi ? "UPI Transfer" : "Bank Account · NEFT/IMPS",
                  beneficiary,
                  ifsc: !isUpi ? receipt.ifsc : null,
                  utrOrRef: receipt.payoutReference ?? null,
                  utrLabel: "Payout Reference",
                  createdAt: receipt.createdAt,
                  reviewedAt: receipt.reviewedAt ?? null,
                  adminNote: receipt.adminNote,
                  user: user
                    ? { fullName: user.fullName ?? null, email: user.email ?? null, id: user.id ?? null }
                    : undefined,
                });
              }}
              className="py-3.5 rounded-2xl border border-emerald-500/40 text-emerald-300 font-semibold text-sm hover:bg-emerald-500/10 hover:border-emerald-500/60 hover:text-emerald-200 transition-all inline-flex items-center justify-center gap-2"
            >
              <FileDown className="w-4 h-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={goToWallet}
              className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_28px_-6px_rgba(16,185,129,0.65)] transition-all inline-flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Back to Wallet
            </button>
          </div>
          <p className="text-[10px] text-center text-white/45 leading-relaxed -mt-1">
            Receipt {refCode} · Tap reference to copy · Share this screen for proof
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
