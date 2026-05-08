import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { ArrowLeft, AlertCircle, Smartphone, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { patchWithdrawState, readWithdrawState } from "@/lib/withdraw-flow-state";
import { cn } from "@/lib/utils";

const UPI_RE = /^[\w.\-]{2,}@[\w.\-]{2,}$/;
const ACCT_RE = /^\d{6,20}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export default function WithdrawInrPage() {
  const [, navigate] = useLocation();
  const state = useMemo(() => readWithdrawState(), []);

  useEffect(() => {
    if (!state || state.currency !== "inr" || !state.amount) {
      navigate("/withdraw");
    }
  }, [state, navigate]);

  const [method, setMethod] = useState<"upi" | "bank">(state?.payoutMethod ?? "upi");
  const [upiId, setUpiId] = useState(state?.upiId ?? "");
  const [accountHolder, setAccountHolder] = useState(state?.accountHolder ?? "");
  const [accountNumber, setAccountNumber] = useState(state?.accountNumber ?? "");
  const [ifsc, setIfsc] = useState(state?.ifsc ?? "");
  const [bankName, setBankName] = useState(state?.bankName ?? "");
  const [touched, setTouched] = useState(false);

  // IFSC verify (Razorpay)
  const [ifscStatus, setIfscStatus] = useState<"idle" | "loading" | "verified" | "error">("idle");
  const [ifscBranchInfo, setIfscBranchInfo] = useState("");

  useEffect(() => {
    const code = ifsc.trim().toUpperCase();
    if (code.length === 0) { setIfscStatus("idle"); setIfscBranchInfo(""); return; }
    if (!IFSC_RE.test(code)) {
      setIfscStatus("error");
      setIfscBranchInfo(
        code.length !== 11
          ? `IFSC must be 11 characters (you typed ${code.length}). Format: HDFC0001234.`
          : "Format wrong. Use: 4 letters + 0 + 6 alphanumeric."
      );
      return;
    }
    setIfscStatus("loading");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://ifsc.razorpay.com/${code}`, { signal: ctrl.signal });
        if (!res.ok) { setIfscStatus("error"); setIfscBranchInfo("IFSC not found in registry"); return; }
        const data = await res.json();
        const bank = String(data?.BANK ?? "").trim();
        const branch = String(data?.BRANCH ?? "").trim();
        const city = String(data?.CITY ?? data?.DISTRICT ?? "").trim();
        const stateName = String(data?.STATE ?? "").trim();
        if (bank) {
          setBankName(bank);
          setIfscBranchInfo([branch, city, stateName].filter(Boolean).join(", "));
          setIfscStatus("verified");
        } else { setIfscStatus("error"); setIfscBranchInfo("Could not read bank info"); }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setIfscStatus("error");
        setIfscBranchInfo("Network error");
      }
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [ifsc]);

  if (!state) return null;
  const numAmount = Number(state.amount) || 0;

  const valid =
    method === "upi"
      ? UPI_RE.test(upiId.trim())
      : accountHolder.trim().length >= 2 &&
        ACCT_RE.test(accountNumber.trim()) &&
        IFSC_RE.test(ifsc.trim().toUpperCase());

  const handleContinue = () => {
    setTouched(true);
    if (!valid) return;
    patchWithdrawState({
      payoutMethod: method,
      upiId: method === "upi" ? upiId.trim() : undefined,
      accountHolder: method === "bank" ? accountHolder.trim() : undefined,
      accountNumber: method === "bank" ? accountNumber.trim() : undefined,
      ifsc: method === "bank" ? ifsc.trim().toUpperCase() : undefined,
      bankName: method === "bank" ? (bankName.trim() || "Bank") : undefined,
    });
    navigate("/withdraw/review");
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-5">
        <button
          onClick={() => navigate("/withdraw")}
          className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="space-y-1.5">
          <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-400">STEP 2 OF 4</div>
          <h1 className="text-2xl font-bold tracking-tight">Payout Destination</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Receive <span className="text-emerald-400 font-bold">₹{numAmount.toLocaleString("en-IN")}</span>{" "}
            directly to your UPI or bank account.
          </p>
        </div>

        {/* Method picker */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMethod("upi")}
            className={cn(
              "rounded-xl border p-3 text-left transition-all flex items-start gap-2.5",
              method === "upi"
                ? "bg-emerald-500/15 border-emerald-500/50"
                : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
            )}
            data-testid="method-upi"
          >
            <Smartphone className={cn("w-5 h-5 shrink-0 mt-0.5", method === "upi" ? "text-emerald-400" : "text-muted-foreground")} />
            <div>
              <div className={cn("text-sm font-bold", method === "upi" ? "text-emerald-400" : "text-white/90")}>UPI</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Instant payout</div>
            </div>
          </button>
          <button
            onClick={() => setMethod("bank")}
            className={cn(
              "rounded-xl border p-3 text-left transition-all flex items-start gap-2.5",
              method === "bank"
                ? "bg-emerald-500/15 border-emerald-500/50"
                : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"
            )}
            data-testid="method-bank"
          >
            <Building2 className={cn("w-5 h-5 shrink-0 mt-0.5", method === "bank" ? "text-emerald-400" : "text-muted-foreground")} />
            <div>
              <div className={cn("text-sm font-bold", method === "bank" ? "text-emerald-400" : "text-white/90")}>Bank Account</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">NEFT / IMPS</div>
            </div>
          </button>
        </div>

        {/* Fields */}
        {method === "upi" ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">UPI ID</label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="yourname@bank"
              className={cn(
                "w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm font-mono outline-none transition-colors",
                touched && upiId && !UPI_RE.test(upiId.trim())
                  ? "border-rose-500/60"
                  : UPI_RE.test(upiId.trim())
                  ? "border-emerald-500/60"
                  : "border-white/10"
              )}
              autoComplete="off"
              spellCheck={false}
              data-testid="input-upi"
            />
            {touched && upiId && !UPI_RE.test(upiId.trim()) && (
              <div className="text-[11px] text-rose-400 mt-1.5">
                Enter a valid UPI ID (e.g. yourname@axisbank).
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Account Holder Name</label>
              <input
                type="text"
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="As per bank records"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm outline-none focus:border-emerald-500/40"
                data-testid="input-holder"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Account Number</label>
              <input
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                onBlur={() => setTouched(true)}
                placeholder="1234567890"
                className={cn(
                  "w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm font-mono outline-none transition-colors",
                  touched && accountNumber && !ACCT_RE.test(accountNumber.trim())
                    ? "border-rose-500/60"
                    : ACCT_RE.test(accountNumber.trim())
                    ? "border-emerald-500/60"
                    : "border-white/10"
                )}
                data-testid="input-acct"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">IFSC Code</label>
              <div className="relative">
                <input
                  type="text"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  onBlur={() => setTouched(true)}
                  placeholder="HDFC0001234"
                  className={cn(
                    "w-full rounded-xl border bg-white/5 px-3.5 py-3 pr-10 text-sm font-mono uppercase outline-none transition-colors",
                    ifscStatus === "verified" ? "border-emerald-500/60" :
                    ifscStatus === "error" ? "border-rose-500/60" : "border-white/10"
                  )}
                  data-testid="input-ifsc"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {ifscStatus === "loading" && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                  {ifscStatus === "verified" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {ifscStatus === "error" && <AlertCircle className="w-4 h-4 text-rose-400" />}
                </span>
              </div>
              {ifscBranchInfo && (
                <div className={cn(
                  "text-[11px] mt-1.5",
                  ifscStatus === "verified" ? "text-emerald-400" : "text-rose-400"
                )}>
                  {ifscStatus === "verified" ? <><span className="font-semibold">Branch:</span> {ifscBranchInfo}</> : ifscBranchInfo}
                </div>
              )}
            </div>
            {bankName && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  readOnly={ifscStatus === "verified"}
                  className={cn(
                    "w-full rounded-xl border bg-white/5 px-3.5 py-3 text-sm outline-none",
                    ifscStatus === "verified" ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10"
                  )}
                  data-testid="input-bank"
                />
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-[11px] text-muted-foreground flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          Withdrawals are processed within 24 hrs after admin approval. Wrong account details cannot be reversed.
        </div>

        <button
          onClick={handleContinue}
          disabled={!valid}
          className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg,#10b981,#059669)",
            color: "#fff",
            boxShadow: "0 6px 22px rgba(16,185,129,0.30)",
          }}
          data-testid="button-continue"
        >
          Review Withdrawal
        </button>
      </div>
    </Layout>
  );
}
