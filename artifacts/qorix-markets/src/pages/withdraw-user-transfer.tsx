import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetWallet } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import {
  ArrowLeft, ArrowRight, Search, CheckCircle2, AlertTriangle,
  User as UserIcon, ShieldCheck, Loader2, X, Send,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { useInrRate } from "@/hooks/use-inr-rate";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const apiUrl = (p: string) => `${BASE_URL}/api${p}`;
const apiFetch = (p: string, init?: RequestInit) => authFetch(apiUrl(p), init);

type Recipient = {
  found: boolean;
  recipientId: number;
  name: string;
  referralCode: string;
};

export default function WithdrawUserTransferPage() {
  const [, navigate] = useLocation();
  const { data: wallet, refetch: refetchWallet } = useGetWallet();
  const mainBal = Number(wallet?.mainBalance) || 0;
  const FX_RATE = useInrRate();

  // KYC gate — same standard as the rest of withdraw flow
  const { data: kycData } = useQuery<any>({
    queryKey: ["kyc-status"],
    queryFn: () => apiFetch("/kyc/status"),
    staleTime: 30_000,
    retry: 1,
  });
  const kycApproved = !kycData ? true : kycData.kycStatus === "approved";

  // Idempotency key persists across this page mount; rotates on success.
  const [idemKey, setIdemKey] = useState<string>(() =>
    `u2u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );

  useEffect(() => {
    if (kycData && !kycApproved) navigate("/kyc");
  }, [kycData, kycApproved, navigate]);

  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "notfound" | "self">("idle");
  const [recipient, setRecipient] = useState<Recipient | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ amount: number; name: string; code: string; txId: number } | null>(null);

  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced recipient lookup
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    const trimmed = code.trim();
    if (trimmed.length < 3) {
      setLookupState("idle");
      setRecipient(null);
      return;
    }
    setLookupState("loading");
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/wallet/lookup-user?code=${encodeURIComponent(trimmed)}`);
        if ((res as any)?.found) {
          setRecipient(res as Recipient);
          setLookupState("found");
        } else if ((res as any)?.self) {
          setRecipient(null);
          setLookupState("self");
        } else {
          setRecipient(null);
          setLookupState("notfound");
        }
      } catch (e: any) {
        // authFetch throws an Error whose message is the JSON body for non-2xx
        const msg = String(e?.message || "");
        if (/"self"\s*:\s*true/.test(msg)) {
          setRecipient(null);
          setLookupState("self");
        } else {
          setRecipient(null);
          setLookupState("notfound");
        }
      }
    }, 450);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [code]);

  const numAmount = Number(amount) || 0;
  const min = 1;
  const exceedsBal = numAmount > mainBal;
  const validAmount = numAmount >= min && !exceedsBal;
  const canContinue = lookupState === "found" && validAmount;

  const inrEquiv = numAmount * FX_RATE;

  const submit = async () => {
    if (!recipient || !validAmount) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiFetch("/wallet/transfer-to-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientCode: recipient.referralCode,
          amount: numAmount,
          note: note.trim() || undefined,
          idempotencyKey: idemKey,
        }),
      });
      if ((res as any)?.success) {
        setShowConfirm(false);
        setSuccess({
          amount: numAmount,
          name: recipient.name,
          code: recipient.referralCode,
          txId: (res as any).transactionId,
        });
        // Rotate idempotency key so the next "Send Again" gets a fresh slot
        setIdemKey(`u2u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        refetchWallet();
      } else {
        setSubmitError((res as any)?.error || "Transfer failed");
      }
    } catch (e: any) {
      setSubmitError(e?.message || "Transfer failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success Screen ────────────────────────────────────────────
  if (success) {
    return (
      <Layout>
        <div className="max-w-md mx-auto px-5 pt-8 pb-28 flex flex-col items-center text-center">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center mb-5">
            <span className="absolute inset-0 rounded-full border border-emerald-500/15" />
            <span className="absolute inset-3 rounded-full border border-emerald-500/25" />
            <span className="absolute inset-6 rounded-full border border-emerald-500/40" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500 shadow-[0_0_40px_-6px_rgba(16,185,129,0.7)] flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-[11px] tracking-[0.28em] font-bold text-emerald-400 mb-2">TRANSFER COMPLETED</div>
          <div className="text-3xl sm:text-4xl font-bold text-white tabular-nums">${success.amount.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1.5">≈ ₹{(success.amount * FX_RATE).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>

          <div className="mt-5 w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-300" />
            <span className="text-xs text-white text-left leading-relaxed">
              Sent to <span className="font-semibold">{success.name}</span> · {success.code}
              <br />
              Receipt #QM-{String(success.txId).padStart(6, "0")}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
            <button
              type="button"
              onClick={() => { setSuccess(null); setCode(""); setAmount(""); setNote(""); setRecipient(null); setLookupState("idle"); }}
              className="py-3.5 rounded-2xl border border-white/15 bg-white/[0.04] text-white font-semibold text-sm hover:bg-white/[0.08] transition-all"
            >
              Send Again
            </button>
            <button
              type="button"
              onClick={() => navigate("/wallet")}
              className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_28px_-6px_rgba(16,185,129,0.65)] transition-all"
            >
              Back to Wallet
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Main Form ─────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-md mx-auto px-5 pt-3 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1.5">
          <button
            onClick={() => navigate("/withdraw")}
            className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] leading-tight">
            Transfer to Qorix User
          </h1>
        </div>
        <p className="text-[13px] text-white/55 leading-relaxed pl-12 mb-5">
          Send USDT directly to another Qorix user. Instant · zero fee.
        </p>

        {/* Available Balance */}
        <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 flex items-center justify-between">
          <span className="text-[14px] text-white/65">Available Balance</span>
          <div className="text-[18px] font-semibold tabular-nums text-white">
            ${mainBal.toFixed(2)}
          </div>
        </div>

        {/* Recipient lookup */}
        <div className="mb-5">
          <div className="text-[13px] text-white/65 mb-2">Recipient</div>
          <div
            className={cn(
              "rounded-2xl border bg-white/[0.025] px-3.5 py-3 flex items-center gap-3 transition-colors",
              lookupState === "found" ? "border-emerald-400/45" :
              lookupState === "notfound" ? "border-rose-500/45" :
              lookupState === "self" ? "border-amber-500/45" :
              "border-white/[0.10]"
            )}
          >
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter Qorix User ID, Referral Code or Email"
              className="flex-1 bg-transparent border-0 outline-none text-[14px] placeholder:text-white/30 min-w-0"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {lookupState === "loading" && <Loader2 className="w-4 h-4 text-white/50 animate-spin shrink-0" />}
            {lookupState === "found" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {lookupState === "notfound" && <X className="w-4 h-4 text-rose-400 shrink-0" />}
            {lookupState === "self" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          </div>

          {/* Recipient preview card */}
          {lookupState === "found" && recipient && (
            <div className="mt-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <UserIcon className="w-4.5 h-4.5 text-emerald-300" style={{ width: 18, height: 18 }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-white truncate">{recipient.name}</div>
                <div className="text-[11.5px] text-emerald-300/80 font-mono">Code: {recipient.referralCode}</div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            </div>
          )}
          {lookupState === "notfound" && (
            <div className="mt-2 text-[11px] text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              No matching Qorix user found. Check the ID/code and try again.
            </div>
          )}
          {lookupState === "self" && (
            <div className="mt-2.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] px-3.5 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-[11.5px] text-amber-100/90 leading-snug">
                <span className="font-semibold text-amber-300">Yeh aapka apna ID hai.</span>{" "}
                You can&apos;t transfer funds to yourself — enter another Qorix user&apos;s ID.
              </span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] text-white/65">Amount (USDT)</span>
          {mainBal > 0 && (
            <button
              onClick={() => setAmount(mainBal.toFixed(2))}
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
            >
              MAX · ${mainBal.toFixed(2)}
            </button>
          )}
        </div>
        <div
          className={cn(
            "rounded-2xl border bg-white/[0.025] px-4 py-4 transition-colors flex items-center gap-3",
            numAmount > 0 && !validAmount ? "border-rose-500/45" :
            validAmount ? "border-emerald-400/45" :
            "border-white/[0.10]"
          )}
        >
          <span className="text-[28px] font-bold leading-none select-none shrink-0 text-emerald-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className="flex-1 bg-transparent border-0 outline-none text-[30px] font-bold tracking-[-0.02em] tabular-nums placeholder:text-white/25 min-w-0"
          />
          {numAmount > 0 && (
            <span className="text-[12px] text-white/45 font-mono tabular-nums shrink-0">
              ≈ ₹{Math.round(inrEquiv).toLocaleString("en-IN")}
            </span>
          )}
        </div>
        <div className="min-h-[14px] mt-1.5 text-[11px] text-rose-400">
          {numAmount > 0 && numAmount < min && `Minimum $${min.toFixed(2)}`}
          {exceedsBal && `Above main balance of $${mainBal.toFixed(2)}`}
        </div>

        {/* Note (optional) */}
        <div className="mt-3 mb-5">
          <div className="text-[13px] text-white/65 mb-2">Note <span className="text-white/35">(optional)</span></div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={140}
            placeholder="What's this for?"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-[13px] outline-none placeholder:text-white/30 focus:border-emerald-400/35"
          />
        </div>

        {/* Trust strip */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 flex items-center gap-2.5 mb-4">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
          <span className="text-[11px] text-white/55 leading-snug">
            Internal transfers are instant · zero fee · final once confirmed
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={!canContinue}
          className={cn(
            "w-full h-12 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_4px_18px_-4px_rgba(16,185,129,0.55)]"
          )}
        >
          Review Transfer
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Confirm Modal */}
      {showConfirm && recipient && (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center px-4 pb-6 pt-10 bg-black/80 backdrop-blur-sm"
          onClick={() => !submitting && setShowConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-[#0c0d10] via-[#0a0b0e] to-[#06070a] shadow-[0_24px_80px_rgba(0,0,0,0.6)] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-base font-bold">Confirm Transfer</div>
              <button
                onClick={() => !submitting && setShowConfirm(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/55">Recipient</span>
                <span className="text-sm font-semibold text-white">{recipient.name}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">User Code</span>
                <span className="text-sm font-mono font-semibold text-emerald-300">{recipient.referralCode}</span>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Amount</span>
                <div className="text-right">
                  <div className="text-sm font-bold text-white tabular-nums">${numAmount.toFixed(2)}</div>
                  <div className="text-[10px] text-white/45 tabular-nums">≈ ₹{Math.round(inrEquiv).toLocaleString("en-IN")}</div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-xs text-white/55">Fee</span>
                <span className="text-sm font-semibold text-emerald-300">FREE</span>
              </div>
              {note.trim() && (
                <div className="flex items-start justify-between gap-3 border-t border-white/5 pt-3">
                  <span className="text-xs text-white/55 shrink-0">Note</span>
                  <span className="text-xs text-white text-right break-words">{note.trim()}</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span className="text-[11.5px] text-amber-100/85 leading-snug">
                Once confirmed, this transfer is <b>final</b>. We can't reverse it. Double-check the recipient code.
              </span>
            </div>

            {submitError && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[12px] text-rose-300">
                {submitError}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full h-12 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-[0_4px_18px_-4px_rgba(16,185,129,0.55)] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Confirm & Send ${numAmount.toFixed(2)}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
