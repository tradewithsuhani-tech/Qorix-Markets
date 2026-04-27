import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import {
  IndianRupee, Building2, Smartphone, AlertCircle, CheckCircle2, Clock, Loader2, ShieldCheck,
} from "lucide-react";

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
};

export function InrWithdrawTab({ kycApproved, onKycRequired }: { kycApproved: boolean; onKycRequired: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [limits, setLimits] = useState<Limits | null>(null);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [amountInr, setAmountInr] = useState("");
  const [upiId, setUpiId] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // IFSC auto-verification (Razorpay free IFSC API)
  const [ifscStatus, setIfscStatus] = useState<"idle" | "loading" | "verified" | "error">("idle");
  const [ifscBranchInfo, setIfscBranchInfo] = useState<string>("");

  useEffect(() => {
    const code = ifsc.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
      setIfscStatus("idle");
      setIfscBranchInfo("");
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

  const submit = async () => {
    if (!kycApproved) { onKycRequired(); return; }
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const body: any = { amountInr: amount, payoutMethod: method };
      if (method === "upi") body.upiId = upiId.trim();
      else {
        body.accountHolder = accountHolder.trim();
        body.accountNumber = accountNumber.trim();
        body.ifsc = ifsc.trim().toUpperCase();
        if (bankName.trim()) body.bankName = bankName.trim();
      }
      await apiFetch("/inr-withdrawals", { method: "POST", body: JSON.stringify(body) });
      toast({
        title: "Withdrawal request submitted",
        description: `₹${amount.toFixed(2)} held from your Main Balance. Admin will process within 24h.`,
      });
      setAmountInr("");
      setUpiId(""); setAccountHolder(""); setAccountNumber(""); setIfsc(""); setBankName("");
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      refresh();
    } catch (err: any) {
      toast({
        title: "Withdrawal failed",
        description: err?.data?.message ?? err?.message ?? "Could not submit withdrawal",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
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
                ${limits.usdtChannelOwed.toFixed(2)} of your balance is reserved to be withdrawn back via USDT (TRC20)
                because you deposited that amount via crypto.
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
            method === "upi" ? "bg-violet-500/15 border-violet-500/50" : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Smartphone style={{ width: 13, height: 13 }} className={method === "upi" ? "text-violet-300" : "text-muted-foreground"} />
            <span className={`text-sm font-semibold ${method === "upi" ? "text-violet-300" : "text-white/80"}`}>UPI</span>
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

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!canSubmit || submitting}
        className="btn w-full flex items-center justify-center gap-2"
        style={{
          background: canSubmit && !submitting ? "linear-gradient(135deg,#10b981,#059669)" : "rgba(255,255,255,0.05)",
          color: canSubmit && !submitting ? "#fff" : "rgba(255,255,255,0.4)",
          boxShadow: canSubmit && !submitting ? "0 4px 18px rgba(16,185,129,0.3)" : "none",
        }}
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
        ) : !kycApproved ? (
          <><ShieldCheck style={{ width: 14, height: 14 }} /> Complete KYC for Withdrawal</>
        ) : (
          <>Request ₹{amount > 0 ? amount.toFixed(0) : ""} Withdrawal</>
        )}
      </button>

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

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pt-2">Recent INR Withdrawals</div>
          <AnimatePresence initial={false}>
            {history.slice(0, 5).map((w) => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs space-y-1"
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
              </motion.div>
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
