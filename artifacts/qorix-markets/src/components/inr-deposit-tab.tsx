import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Copy,
  CheckCheck,
  ImageIcon,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Landmark,
  Sparkles,
  ShieldCheck,
  Download,
  Maximize2,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import upiLogoUrl from "@/assets/upi-logo.png";
import phonepeLogoUrl from "@/assets/phonepe-logo.png";
import paytmLogoUrl from "@/assets/paytm-logo.png";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function getApiUrl(path: string) {
  return `${BASE_URL}api${path}`;
}

interface PaymentMethod {
  id: number;
  type: "bank" | "upi";
  displayName: string;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
  upiId: string | null;
  qrImageBase64: string | null;
  minAmount: string;
  maxAmount: string;
  instructions: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface InrDeposit {
  id: number;
  paymentMethodId: number;
  amountInr: string;
  amountUsdt: string;
  rateUsed: string;
  utr: string;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  proofImageBase64: string | null;
  createdAt: string;
}

const COUNTDOWN_SECS = 15 * 60;

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={cn(
        "inline-flex items-center justify-center w-7 h-7 rounded-md bg-white/5 hover:bg-white/15 text-muted-foreground hover:text-white transition-colors shrink-0",
        className,
      )}
      aria-label="Copy"
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function StatusPill({ status }: { status: InrDeposit["status"] }) {
  const map = {
    pending: { icon: Clock, cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", label: "Pending" },
    approved: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", label: "Approved" },
    rejected: { icon: XCircle, cls: "bg-red-500/15 text-red-400 border-red-500/25", label: "Rejected" },
  } as const;
  const { icon: Icon, cls, label } = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wider", cls)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

function MethodIcon({ type, size = "md" }: { type: "bank" | "upi"; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? "w-12 h-12" : size === "sm" ? "w-9 h-9" : "w-11 h-11";
  const inner = size === "lg" ? "w-8 h-8" : size === "sm" ? "w-6 h-6" : "w-7 h-7";

  if (type === "upi") {
    return (
      <div className={cn(dim, "rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-teal-500/25 to-cyan-600/15 border border-teal-400/20")}>
        <img src={upiLogoUrl} alt="UPI" className={cn(inner, "object-contain")} />
      </div>
    );
  }

  return (
    <div className={cn(dim, "rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-teal-500/25 to-cyan-600/15 border border-teal-400/20 text-teal-300")}>
      <Landmark className={size === "lg" ? "w-7 h-7" : size === "sm" ? "w-5 h-5" : "w-6 h-6"} />
    </div>
  );
}

function UpiAppLogos() {
  // Brand chips for UPI apps. PhonePe + Paytm use real brand PNGs; GPay uses inline 4-color G.
  const GPayIcon = (
    <svg viewBox="0 0 24 24" className="w-3 h-3" aria-hidden="true">
      <path d="M22 12.2c0-.7-.06-1.4-.18-2.05H12v3.88h5.62c-.24 1.3-.98 2.4-2.08 3.14v2.6h3.36C20.86 18.05 22 15.4 22 12.2z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.36-2.6c-.93.62-2.12.99-3.26.99-2.5 0-4.62-1.69-5.38-3.96H2.5v2.5C4.16 19.79 7.83 22 12 22z" fill="#34A853" />
      <path d="M6.62 14c-.2-.6-.32-1.24-.32-1.9 0-.66.12-1.3.32-1.9V7.7H2.5C1.83 9.04 1.5 10.5 1.5 12s.33 2.96 1 4.3l3.12-2.3z" fill="#FBBC04" />
      <path d="M12 5.95c1.46 0 2.78.5 3.81 1.49l2.86-2.86C16.96 2.97 14.7 2 12 2 7.83 2 4.16 4.21 2.5 7.7l4.12 2.5C7.38 7.94 9.5 5.95 12 5.95z" fill="#EA4335" />
    </svg>
  );

  const apps: Array<{ name: string; bg: string; fg: string; icon: React.ReactNode }> = [
    {
      name: "PhonePe",
      bg: "bg-[#5f259f]",
      fg: "text-white",
      icon: <img src={phonepeLogoUrl} alt="" className="w-full h-full object-contain" />,
    },
    {
      name: "GPay",
      bg: "bg-white",
      fg: "text-gray-900",
      icon: GPayIcon,
    },
    {
      name: "Paytm",
      bg: "bg-white",
      fg: "text-[#002970]",
      icon: <img src={paytmLogoUrl} alt="" className="w-full h-full object-contain" />,
    },
  ];
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {apps.map((a) => (
        <span
          key={a.name}
          className={cn(
            "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md shadow-sm",
            a.bg,
            a.fg,
          )}
        >
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm overflow-hidden bg-white">
            {a.icon}
          </span>
          {a.name}
        </span>
      ))}
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

type Step = "list" | "amount" | "transfer" | "success";

export function InrDepositTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: methodsResp, isLoading: methodsLoading } = useQuery<{ methods: PaymentMethod[]; rate: number }>({
    queryKey: ["inr-payment-methods"],
    queryFn: () => authFetch(getApiUrl("/payment-methods")),
  });

  const { data: historyResp } = useQuery<{ deposits: InrDeposit[] }>({
    queryKey: ["inr-deposits-mine"],
    queryFn: () => authFetch(getApiUrl("/inr-deposits/mine")),
    refetchInterval: 15000,
  });

  const methods = methodsResp?.methods ?? [];
  const rate = methodsResp?.rate ?? 85;

  const [step, setStep] = useState<Step>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [utr, setUtr] = useState("");
  const [payerName, setPayerName] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string>("");
  const [secsLeft, setSecsLeft] = useState(COUNTDOWN_SECS);
  const [submittedDepositId, setSubmittedDepositId] = useState<number | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const amountNum = Number(amount);
  const min = selected ? Number(selected.minAmount) : 0;
  const max = selected ? Number(selected.maxAmount) : 0;
  const amountValid = !!selected && amountNum >= min && amountNum <= max;
  const usdtPreview = useMemo(() => (amountNum > 0 && rate > 0 ? (amountNum / rate).toFixed(2) : "0.00"), [amountNum, rate]);

  // Countdown when on transfer step
  useEffect(() => {
    if (step !== "transfer") return;
    if (secsLeft <= 0) {
      toast({ title: "Time expired", description: "Please start the deposit again.", variant: "destructive" });
      resetFlow();
      return;
    }
    const id = window.setTimeout(() => setSecsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [step, secsLeft]);

  function resetFlow() {
    setStep("list");
    setSelectedId(null);
    setAmount("");
    setAgreed(false);
    setUtr("");
    setPayerName("");
    setProof(null);
    setOrderNo("");
    setSecsLeft(COUNTDOWN_SECS);
    setSubmittedDepositId(null);
  }

  function goToAmount(id: number) {
    setSelectedId(id);
    setStep("amount");
  }

  function goToTransfer() {
    if (!agreed || !amountValid) return;
    const order = `QM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setOrderNo(order);
    setSecsLeft(COUNTDOWN_SECS);
    setStep("transfer");
  }

  const submit = useMutation({
    mutationFn: () => {
      // Append payer name + order ref to UTR if provided so admins can match
      // the payment slip without backend schema changes.
      const trimmedUtr = utr.trim();
      const trimmedPayer = payerName.trim();
      const utrWithMeta = trimmedPayer
        ? `${trimmedUtr} | ${trimmedPayer} | ${orderNo}`
        : `${trimmedUtr} | ${orderNo}`;
      return authFetch(getApiUrl("/inr-deposits"), {
        method: "POST",
        body: JSON.stringify({
          paymentMethodId: selectedId,
          amountInr: amount,
          utr: utrWithMeta,
          proofImageBase64: proof,
        }),
      });
    },
    onSuccess: (resp: any) => {
      setSubmittedDepositId(resp?.deposit?.id ?? null);
      setStep("success");
      qc.invalidateQueries({ queryKey: ["inr-deposits-mine"] });
    },
    onError: (e: any) => {
      toast({ title: "Submission failed", description: e?.message ?? "Could not submit deposit", variant: "destructive" });
    },
  });

  const handleFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2 MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProof(reader.result as string);
    reader.readAsDataURL(file);
  };

  if (methodsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <Banknote className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <div className="text-sm text-white font-semibold">No INR payment methods active</div>
        <p className="text-xs text-muted-foreground mt-1">Please use the USDT (TRC20) tab or check back soon.</p>
      </div>
    );
  }

  // —— Step renderers ——
  return (
    <div className="space-y-5">
      <AnimatePresence mode="wait">
        {step === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Rate banner */}
            <div className="rounded-2xl px-4 py-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span className="text-xs text-emerald-100/80">Live rate</span>
              </div>
              <div className="text-sm font-bold text-white">
                1 USDT = <span className="text-emerald-300">₹{rate}</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">
              Local Bank Transfer
            </div>

            <div className="space-y-2.5">
              {methods.map((m, idx) => (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => goToAmount(m.id)}
                  className="w-full text-left p-4 rounded-2xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all flex items-center gap-3 group"
                >
                  <MethodIcon type={m.type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{m.type === "upi" ? "UPI" : "Bank"}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold">No Fees</span>
                      <span className="text-white/20">|</span>
                      <span>1-3 Hours</span>
                      <span className="text-white/20">|</span>
                      <span>₹{Number(m.minAmount).toLocaleString("en-IN")} – ₹{Number(m.maxAmount).toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "amount" && selected && (
          <motion.div
            key="amount"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <button
              onClick={() => setStep("list")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>

            {/* Big amount header */}
            <div className="text-center py-2">
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min={min}
                  max={max}
                  className="w-full bg-transparent text-center text-4xl sm:text-5xl font-extrabold text-white outline-none placeholder:text-white/15"
                />
                <div className="text-xs text-muted-foreground mt-1 font-semibold">Enter INR Amount</div>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <span className="text-[11px] text-muted-foreground">≈</span>
                <span className="text-sm font-bold text-emerald-300">{usdtPreview} USDT</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5">Payment Amount</div>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl bg-white/[0.04] border border-white/8 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs text-muted-foreground">Deposit Amount</div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">
                    {amount ? `₹${Number(amount).toLocaleString("en-IN")}` : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">1 USDT ≈ ₹{rate}</div>
                </div>
              </div>
              <div className="border-t border-white/5"></div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">You Receive</div>
                <div className="text-sm font-bold text-emerald-300">{usdtPreview} USDT</div>
              </div>
              <div className="border-t border-white/5"></div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Pay With</div>
                <div className="flex items-center gap-2">
                  <MethodIcon type={selected.type} size="sm" />
                  <span className="text-sm font-bold text-white">{selected.type === "upi" ? "UPI" : "Bank"}</span>
                </div>
              </div>
              {selected.type === "bank" && selected.accountNumber && (
                <>
                  <div className="border-t border-white/5"></div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Pay To Account</div>
                    <div className="text-sm font-mono text-white">
                      …{selected.accountNumber.slice(-4)}
                    </div>
                  </div>
                </>
              )}
            </div>

            {amount && !amountValid && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-[11px] text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Amount must be between ₹{Number(selected.minAmount).toLocaleString("en-IN")} and ₹{Number(selected.maxAmount).toLocaleString("en-IN")} for this method.
                </span>
              </div>
            )}

            {/* Important notes */}
            <div className="rounded-2xl border border-white/8 p-4">
              <div className="text-sm font-bold text-white mb-2">*Important</div>
              <ol className="space-y-1.5 text-[11px] text-muted-foreground list-decimal list-outside ml-4">
                <li>Confirm the details and click 'Confirm &amp; Continue'.</li>
                <li>Make payment using the UPI ID, account details, or QR shown next.</li>
                <li>Pay the EXACT amount shown — any difference may delay or reject the credit.</li>
                <li>Save the UTR / Transaction ID from your bank or UPI app.</li>
                <li>Strictly no third-party deposits accepted. The payer's name must match your registered name.</li>
              </ol>
            </div>

            {/* Agreement */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-white/8 hover:bg-white/[0.02] cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 accent-emerald-500"
              />
              <span className="text-[11px] text-muted-foreground leading-relaxed">
                I agree to follow the instructions, COPY the displayed UPI ID or SCAN the QR code for EVERY payment, and ensure the Payee Name is correct so my deposit is processed accurately.
              </span>
            </label>

            <button
              type="button"
              onClick={goToTransfer}
              disabled={!agreed || !amountValid}
              className="w-full py-3.5 rounded-full bg-white text-gray-900 font-bold text-sm hover:bg-gray-100 disabled:bg-white/10 disabled:text-white/40 transition-all"
            >
              Confirm &amp; Pay
            </button>
          </motion.div>
        )}

        {step === "transfer" && selected && (
          <motion.div
            key="transfer"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4 -mx-1"
          >
            {/* Gradient header */}
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950/70 to-slate-900 border border-emerald-500/20 px-5 pt-5 pb-6 text-white shadow-[0_0_40px_-12px_rgba(16,185,129,0.25)]">
              <button
                onClick={() => setStep("amount")}
                className="absolute top-3 left-3 inline-flex items-center gap-1 text-[11px] text-white/80 hover:text-white"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                onClick={resetFlow}
                className="absolute top-3 right-3 text-white/80 hover:text-white"
                aria-label="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center pt-3">
                <div className="text-lg font-bold">Transfer Confirmation</div>
                <div className="text-xs text-white/80 mt-0.5">
                  Remaining time to pay <span className="font-mono font-bold">{formatTime(secsLeft)}</span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="text-3xl font-extrabold">₹ {Number(amount).toLocaleString("en-IN")}</div>
                  <CopyBtn text={amount} className="bg-white/15 hover:bg-white/25 text-white" />
                </div>
                <div className="text-[10px] text-white/80 mt-0.5">≈ {usdtPreview} USDT will be credited after verification</div>
              </div>
            </div>

            {/* Order number */}
            <div className="rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 flex items-center justify-between">
              <div className="text-[11px] text-muted-foreground">Order No.</div>
              <div className="flex items-center gap-2">
                <div className="text-xs font-mono text-white">{orderNo}</div>
                <CopyBtn text={orderNo} />
              </div>
            </div>

            {/* Step 1: Send Payment */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-gray-900 text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-sm font-bold text-white">Send Payment</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1 ml-8 list-disc">
                <li>Leave this page and send the payment using your UPI app or bank.</li>
                <li>Take a screenshot of the payment confirmation, then return to this page.</li>
                <li>Pay the EXACT amount shown above. Discrepancies may cause delays or loss of funds.</li>
              </ul>

              {/* Payment Method card */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 text-white p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-white">Payment Method</div>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wide px-2 py-1 rounded-md",
                    selected.type === "upi"
                      ? "bg-orange-500/15 border border-orange-500/40 text-orange-300"
                      : "bg-blue-500/15 border border-blue-500/40 text-blue-300"
                  )}>
                    {selected.type === "upi" ? (
                      <img src={upiLogoUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                    ) : (
                      <Landmark className="w-3.5 h-3.5" strokeWidth={2.4} />
                    )}
                    {selected.type === "upi" ? "UPI" : "BANK"}
                  </span>
                </div>

                <div className="text-[11px] text-muted-foreground font-semibold mb-2">Receiving Account Details:</div>

                <div className="rounded-xl bg-black/30 border border-white/8 p-4 flex gap-4">
                  <div className="flex-1 min-w-0 divide-y divide-white/5">
                    {selected.type === "bank" ? (
                      <>
                        {selected.accountHolder && (
                          <Row label="Name" value={selected.accountHolder} valueClass="text-emerald-300 font-bold" />
                        )}
                        {selected.bankName && (
                          <Row label="Bank" value={selected.bankName} />
                        )}
                        {selected.accountNumber && (
                          <Row label="A/C Number" value={selected.accountNumber} mono />
                        )}
                        {selected.ifsc && (
                          <Row label="IFSC" value={selected.ifsc} mono />
                        )}
                      </>
                    ) : (
                      <>
                        {selected.accountHolder && (
                          <Row label="Name" value={selected.accountHolder} valueClass="text-emerald-300 font-bold" />
                        )}
                        {selected.upiId && (
                          <Row label="UPI ID" value={selected.upiId} valueClass="text-emerald-300 font-semibold" mono />
                        )}
                      </>
                    )}
                  </div>

                  {selected.qrImageBase64 && (
                    <button
                      type="button"
                      onClick={() => setQrModalOpen(true)}
                      className="group relative w-24 h-24 shrink-0 rounded-lg bg-white border border-white/15 p-1 shadow-sm self-start overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      aria-label="View QR full screen"
                    >
                      <img
                        src={selected.qrImageBase64}
                        alt="QR"
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                        <Maximize2 className="w-4 h-4 text-white" />
                        <span className="text-[9px] font-semibold text-white uppercase tracking-wider">View</span>
                      </span>
                      <span className="absolute bottom-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shadow-md group-hover:opacity-0 transition-opacity">
                        <Maximize2 className="w-3 h-3" />
                      </span>
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <UpiAppLogos />
                  <span className="text-[9px] text-muted-foreground">Use any UPI app</span>
                </div>
              </div>
            </div>

            {/* Step 2: Confirm Payment */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-400 text-gray-900 text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-sm font-bold text-white">Confirm Payment</span>
              </div>
              <p className="text-[11px] text-muted-foreground ml-8">
                Enter the UTR / Transaction Reference and upload your payment slip to confirm.
              </p>

              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-200 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  The payer's name must match your registered name <span className="font-bold">{user?.fullName ?? ""}</span>. Third-party payments will be rejected.
                </span>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">
                  Payer's Name (as on bank account)
                </label>
                <input
                  type="text"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="field-input"
                  placeholder={user?.fullName ?? "Your full name"}
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">
                  UTR / Transaction Reference *
                </label>
                <input
                  type="text"
                  value={utr}
                  onChange={(e) => setUtr(e.target.value)}
                  className="field-input"
                  placeholder="12-digit UTR or UPI reference"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  You'll find this in your bank/UPI app right after payment.
                </p>
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">
                  Upload Payment Proof * <span className="text-muted-foreground/60">(max 2 MB)</span>
                </label>
                {!proof ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-white/15 hover:border-white/30 rounded-xl p-6 flex flex-col items-center gap-2 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-semibold">Tap to upload screenshot</span>
                    <span className="text-[10px] text-muted-foreground/60">PNG, JPG up to 2 MB</span>
                  </button>
                ) : (
                  <div className="relative inline-block">
                    <img src={proof} alt="proof" className="max-h-48 rounded-xl border border-white/10" />
                    <button
                      type="button"
                      onClick={() => setProof(null)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-lg"
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={resetFlow}
                disabled={submit.isPending}
                className="flex-1 py-3 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 font-semibold text-sm transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit.mutate()}
                disabled={!utr.trim() || !proof || submit.isPending}
                className="flex-[2] py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {submit.isPending ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                  </span>
                ) : (
                  "Submit Deposit"
                )}
              </button>
            </div>

            <button className="w-full text-center text-[11px] text-muted-foreground hover:text-white py-2">
              Recharge not received? Contact support
            </button>
          </motion.div>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border border-emerald-500/25 p-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center"
              >
                <CheckCircle2 className="w-9 h-9 text-emerald-400" />
              </motion.div>
              <div className="text-lg font-bold text-white">Deposit Submitted</div>
              <p className="text-xs text-muted-foreground mt-1">
                Order <span className="text-white font-mono">{orderNo}</span>
              </p>
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span className="text-xs text-white">
                  ₹{Number(amount).toLocaleString("en-IN")} → <span className="text-emerald-300 font-bold">{usdtPreview} USDT</span>
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed max-w-sm mx-auto">
                Your deposit is queued for admin review. Verification usually takes 1-3 hours during business hours. You'll get a notification once approved.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={resetFlow}
                className="flex-1 py-3 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 font-semibold text-sm transition-all"
              >
                New Deposit
              </button>
              <button
                onClick={() => {
                  resetFlow();
                  document.getElementById("inr-history")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="flex-1 py-3 rounded-full bg-white text-gray-900 font-bold text-sm hover:bg-gray-100 transition-all"
              >
                View History
              </button>
            </div>

            {submittedDepositId && (
              <p className="text-[10px] text-center text-muted-foreground">
                Reference ID: #{submittedDepositId}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      <div id="inr-history" className="glass-card rounded-2xl overflow-hidden mt-6">
        <div className="px-5 pt-4 pb-3 border-b border-white/8 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Your INR deposits</span>
          <span className="text-[11px] text-muted-foreground">
            {historyResp?.deposits?.length ?? 0} total
          </span>
        </div>
        {(historyResp?.deposits ?? []).length === 0 ? (
          <div className="px-5 py-10 text-center text-xs text-muted-foreground">
            No INR deposits yet
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {(historyResp?.deposits ?? []).map((d) => (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="px-5 py-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {d.proofImageBase64 ? (
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Banknote className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">
                      ₹{Number(d.amountInr).toLocaleString("en-IN")}
                      <span className="text-[11px] text-muted-foreground font-normal ml-2">
                        → {Number(d.amountUsdt).toFixed(2)} USDT
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      UTR {d.utr} · {new Date(d.createdAt).toLocaleString()}
                    </div>
                    {d.adminNote && (
                      <div className="text-[10px] text-amber-300 mt-0.5">
                        Note: {d.adminNote}
                      </div>
                    )}
                  </div>
                  <StatusPill status={d.status} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <AnimatePresence>
        {qrModalOpen && selected?.qrImageBase64 && (
          <motion.div
            key="qr-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-5"
            onClick={() => setQrModalOpen(false)}
          >
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm flex flex-col items-center gap-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 font-semibold mb-1">
                  Scan to Pay
                </div>
                <div className="text-base font-bold text-white">
                  {selected.displayName || (selected.type === "upi" ? "UPI" : "Bank")}
                </div>
                {selected.type === "upi" && selected.upiId && (
                  <div className="text-xs font-mono text-emerald-300 mt-1 break-all">
                    {selected.upiId}
                  </div>
                )}
              </div>

              <div className="w-full rounded-2xl p-3 bg-gradient-to-br from-emerald-950/50 via-slate-900/70 to-slate-950/80 border border-emerald-500/25 shadow-[0_0_60px_-15px_rgba(16,185,129,0.4)] backdrop-blur-xl">
                <img
                  src={selected.qrImageBase64}
                  alt="UPI QR code"
                  className="w-full h-auto object-contain rounded-xl"
                />
              </div>

              <a
                href={selected.qrImageBase64}
                download={`qorix-${selected.type === "upi" ? "upi" : "bank"}-qr.png`}
                onClick={(e) => e.stopPropagation()}
                className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] transition-all inline-flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Save QR to Phone
              </a>

              <p className="text-[11px] text-white/60 text-center px-4">
                Open any UPI app → scan this QR → enter exact amount → pay.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "text-sm text-white flex-1 min-w-0 leading-snug",
            mono ? "font-mono break-all" : "break-words",
            valueClass,
          )}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(value);
          }}
          className="w-7 h-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/10 shrink-0 transition-colors -mt-0.5"
          aria-label="Copy"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
