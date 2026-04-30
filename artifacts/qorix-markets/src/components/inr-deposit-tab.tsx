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
  Plus,
  Info,
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
  // Capacity-aware extras (only present when fetched with ?amount=X)
  merchantId?: number | null;
  merchantName?: string | null;
  merchantAvailable?: string | null;
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

type Step = "start" | "list" | "amount" | "transfer" | "success";

export function InrDepositTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("start");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  // The amount we actually committed to fetch merchants for. Locked once user
  // clicks "Find merchants" so editing the input mid-flow doesn't desync.
  const [committedAmount, setCommittedAmount] = useState<string>("");
  const [agreed, setAgreed] = useState(false);

  // Lightweight rate-only probe (no amount filter) — drives the rate banner on
  // the start step. Backend returns the same `methods` array but we ignore it
  // here since we'll re-fetch with capacity filter when the user commits.
  const { data: rateResp, isLoading: rateLoading } = useQuery<{ methods: PaymentMethod[]; rate: number }>({
    queryKey: ["inr-payment-methods", "rate-only"],
    queryFn: () => authFetch(getApiUrl("/payment-methods")),
  });
  const rate = rateResp?.rate ?? 85;
  // Use this only for the empty-state probe ("system has any active methods?").
  const anyMethodsExist = (rateResp?.methods ?? []).length > 0;

  // Capacity-aware fetch — only runs once the user has committed an amount.
  // Returns at most 5 merchant cards ordered by available capacity desc.
  const {
    data: capacityResp,
    isLoading: capacityLoading,
    isFetching: capacityFetching,
  } = useQuery<{ methods: PaymentMethod[]; rate: number }>({
    queryKey: ["inr-payment-methods", "capacity", committedAmount],
    queryFn: () =>
      authFetch(
        getApiUrl(`/payment-methods?amount=${encodeURIComponent(committedAmount)}`),
      ),
    enabled: !!committedAmount && Number(committedAmount) > 0,
  });
  const methods = capacityResp?.methods ?? [];

  // History — independent of the deposit funnel. Polled so the user sees
  // status flips after admin/merchant approval.
  const { data: historyResp } = useQuery<{ deposits: InrDeposit[] }>({
    queryKey: ["inr-deposits-mine"],
    queryFn: () => authFetch(getApiUrl("/inr-deposits/mine")),
    refetchInterval: 15000,
  });

  const [utr, setUtr] = useState("");
  const [payerName, setPayerName] = useState("");
  const [proofs, setProofs] = useState<string[]>([]);
  const MAX_PROOFS = 4;
  const [orderNo, setOrderNo] = useState<string>("");
  const [secsLeft, setSecsLeft] = useState(COUNTDOWN_SECS);
  const [submittedDepositId, setSubmittedDepositId] = useState<number | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const amountNum = Number(amount);
  const min = selected ? Number(selected.minAmount) : 0;
  // Cap by merchantAvailable when present so a user can't edit the amount
  // higher than what the merchant can actually settle. Falls back to the
  // method's own max when no merchant cap is provided (legacy admin methods).
  const max = selected
    ? Math.min(
        Number(selected.maxAmount),
        selected.merchantAvailable != null && selected.merchantAvailable !== ""
          ? Number(selected.merchantAvailable)
          : Number.POSITIVE_INFINITY,
      )
    : 0;
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

  // Stale-selection reconciliation: if the capacity query refetches and the
  // user's selected merchant is no longer in the result (capacity dropped
  // below their amount, merchant deactivated, etc.), bounce them back to
  // the list step instead of leaving them stranded on a blank amount/transfer
  // screen.
  useEffect(() => {
    if (step !== "amount" && step !== "transfer") return;
    if (capacityLoading || capacityFetching) return;
    if (selectedId == null) return;
    const stillThere = methods.some((m) => m.id === selectedId);
    if (!stillThere) {
      setSelectedId(null);
      setStep("list");
      toast({
        title: "Merchant no longer available",
        description: "The selected merchant just ran out of capacity. Please pick another one.",
        variant: "destructive",
      });
    }
  }, [step, selectedId, methods, capacityLoading, capacityFetching, toast]);

  // Scroll to the top of the page whenever the wizard advances to a new step.
  // Without this the browser keeps the previous scroll position, so after the
  // user has scrolled down through the long "amount" form, the next step
  // ("transfer" / "success") renders deep below the fold and the user lands on
  // the middle of the new screen instead of seeing its title at the top.
  // Skips the initial render so we don't yank the page when first mounting.
  const prevStepRef = useRef<Step>(step);
  useEffect(() => {
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  function resetFlow() {
    setStep("start");
    setSelectedId(null);
    setAmount("");
    setCommittedAmount("");
    setAgreed(false);
    setUtr("");
    setPayerName("");
    setProofs([]);
    setOrderNo("");
    setSecsLeft(COUNTDOWN_SECS);
    setSubmittedDepositId(null);
  }

  function commitAmount() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 100) {
      toast({
        title: "Invalid amount",
        description: "Enter at least ₹100.",
        variant: "destructive",
      });
      return;
    }
    setCommittedAmount(amount);
    setStep("list");
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
    mutationFn: async () => {
      // Append payer name + order ref to UTR if provided so admins can match
      // the payment slip without backend schema changes.
      const trimmedUtr = utr.trim();
      const trimmedPayer = payerName.trim();
      const utrWithMeta = trimmedPayer
        ? `${trimmedUtr} | ${trimmedPayer} | ${orderNo}`
        : `${trimmedUtr} | ${orderNo}`;
      // Multi-image: combine into one tall stacked image client-side so the
      // existing single-text proof column doesn't need a schema change.
      const combinedProof = await combineProofsToSingleImage(proofs);
      return authFetch(getApiUrl("/inr-deposits"), {
        method: "POST",
        body: JSON.stringify({
          paymentMethodId: selectedId,
          amountInr: amount,
          utr: utrWithMeta,
          proofImageBase64: combinedProof,
        }),
      });
    },
    onSuccess: (resp: any) => {
      setSubmittedDepositId(resp?.deposit?.id ?? null);
      setStep("success");
      // NOTE: We deliberately do NOT log chat conversion here. INR deposits
      // are pending until an admin approves them, so there is no completed
      // deposit transaction at submit time and the server-verified
      // /chat/deposit-complete check would just return no_deposit_found.
      // The authoritative chat-conversion stamp happens server-side inside
      // the admin INR-approve handler (see artifacts/api-server/src/routes/
      // inr-deposits.ts), which finds the user's recent open chat session
      // and writes converted_at + a deposit_completed event.
      qc.invalidateQueries({ queryKey: ["inr-deposits-mine"] });
    },
    onError: (e: any) => {
      toast({ title: "Submission failed", description: e?.message ?? "Could not submit deposit", variant: "destructive" });
    },
  });

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const remaining = MAX_PROOFS - proofs.length;
    if (remaining <= 0) {
      toast({
        title: "Maximum proofs reached",
        description: `You can attach up to ${MAX_PROOFS} images.`,
        variant: "destructive",
      });
      return;
    }
    const accepted = list.slice(0, remaining);
    if (list.length > remaining) {
      toast({
        title: "Some files skipped",
        description: `Only ${remaining} more image${remaining === 1 ? "" : "s"} allowed.`,
      });
    }
    for (const file of accepted) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: `${file.name || "Image"} too large`,
          description: "Each image must be under 2 MB.",
          variant: "destructive",
        });
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setProofs((prev) =>
          prev.length >= MAX_PROOFS ? prev : [...prev, dataUrl],
        );
      };
      reader.readAsDataURL(file);
    }
  };

  if (rateLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!anyMethodsExist) {
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
        {step === "start" && (
          <motion.div
            key="start"
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

            {/* Amount entry header */}
            <div className="text-center py-2">
              <div className="relative">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min={100}
                  className="w-full bg-transparent text-center text-4xl sm:text-5xl font-extrabold text-white outline-none placeholder:text-white/15"
                />
                <div className="text-xs text-muted-foreground mt-1 font-semibold">Enter INR Amount</div>
              </div>
              {Number(amount) > 0 && rate > 0 && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  <span className="text-[11px] text-muted-foreground">≈</span>
                  <span className="text-sm font-bold text-emerald-300">
                    {(Number(amount) / rate).toFixed(2)} USDT
                  </span>
                </div>
              )}
            </div>

            {/* Quick chips */}
            <div className="grid grid-cols-4 gap-2">
              {[1000, 5000, 25000, 50000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="py-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  ₹{v.toLocaleString("en-IN")}
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] text-muted-foreground leading-relaxed">
              Enter how much INR you want to deposit. We'll show you the
              merchants who can accept that amount right now (top 5 by
              capacity). Minimum ₹100.
            </div>

            <button
              type="button"
              onClick={commitAmount}
              disabled={!amount || Number(amount) < 100}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
            >
              Find merchants
            </button>
          </motion.div>
        )}

        {step === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <button
              onClick={() => setStep("start")}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Back
            </button>

            {/* Header strip — shows committed amount */}
            <div className="rounded-2xl px-4 py-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-300" />
                <span className="text-xs text-emerald-100/80">Depositing</span>
              </div>
              <div className="text-sm font-bold text-white">
                ₹{Number(committedAmount).toLocaleString("en-IN")}
                <span className="text-[10px] text-muted-foreground ml-2">@ ₹{rate}/USDT</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider px-1">
              Available merchants ({methods.length})
            </div>

            {capacityLoading || capacityFetching ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : methods.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
                <div className="text-sm text-white font-semibold">
                  No merchant available for ₹{Number(committedAmount).toLocaleString("en-IN")} right now
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a smaller amount, or use the USDT (TRC20) tab. If urgent, contact support.
                </p>
                <button
                  type="button"
                  onClick={() => setStep("start")}
                  className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-full border border-white/15 text-xs text-white/80 hover:bg-white/5 hover:text-white"
                >
                  Try a different amount
                </button>
              </div>
            ) : (
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
                      <div className="text-sm font-bold text-white truncate">
                        {m.merchantName ?? (m.type === "upi" ? "UPI" : "Bank")}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="uppercase tracking-wider text-[10px] font-semibold text-white/60">
                          {m.type === "upi" ? "UPI" : "Bank"}
                        </span>
                        <span className="text-white/20">|</span>
                        <span className="text-emerald-400 font-semibold">No Fees</span>
                        <span className="text-white/20">|</span>
                        <span>1-3 Hours</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                  </motion.button>
                ))}
              </div>
            )}
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
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold text-sm hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
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
                      className="group relative w-24 h-24 shrink-0 rounded-lg bg-gradient-to-br from-emerald-950/60 via-slate-900/70 to-slate-950/80 border border-emerald-500/25 p-1.5 shadow-[0_0_18px_-6px_rgba(16,185,129,0.45)] self-start overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                      aria-label="View QR full screen"
                    >
                      <img
                        src={selected.qrImageBase64}
                        alt="QR"
                        className="w-full h-full object-contain rounded-md"
                      />
                      <span className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                        <Maximize2 className="w-4 h-4 text-white" />
                        <span className="text-[9px] font-semibold text-white uppercase tracking-wider">View</span>
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
                <label className="text-[11px] text-muted-foreground font-medium mb-1.5 flex items-center justify-between gap-2">
                  <span>
                    Upload Payment Proof *{" "}
                    <span className="text-muted-foreground/60">
                      (up to {MAX_PROOFS} images · 2 MB each)
                    </span>
                  </span>
                  {proofs.length > 0 && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 tabular-nums">
                      <CheckCircle2 className="w-3 h-3" />
                      {proofs.length} / {MAX_PROOFS}
                    </span>
                  )}
                </label>

                {proofs.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-full rounded-2xl border-2 border-dashed border-white/15 hover:border-emerald-400/60 hover:bg-emerald-500/5 px-4 py-7 flex flex-col items-center gap-2.5 transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10 border border-emerald-500/30 flex items-center justify-center group-hover:scale-105 transition-transform shadow-[0_0_20px_-6px_rgba(16,185,129,0.5)]">
                      <Upload className="w-5 h-5 text-emerald-300" />
                    </div>
                    <span className="text-sm text-white font-semibold">
                      Tap to upload screenshot
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 text-center px-2">
                      PNG / JPG · Add multiple if you paid in parts
                    </span>
                  </button>
                ) : (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {proofs.map((p, i) => (
                        <div
                          key={i}
                          className="relative group aspect-square rounded-xl overflow-hidden border border-emerald-500/30 bg-black/40 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.6)]"
                        >
                          <img
                            src={p}
                            alt={`Proof ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-1.5 left-1.5 min-w-[22px] h-5 px-1.5 rounded-full bg-black/75 backdrop-blur text-emerald-300 text-[10px] font-bold flex items-center justify-center">
                            #{i + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setProofs((prev) =>
                                prev.filter((_, j) => j !== i),
                              )
                            }
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-lg transition-colors"
                            aria-label={`Remove proof ${i + 1}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                            <div className="text-[9px] font-semibold text-white/90 uppercase tracking-wider">
                              Proof #{i + 1}
                            </div>
                          </div>
                        </div>
                      ))}

                      {proofs.length < MAX_PROOFS && (
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="aspect-square rounded-xl border-2 border-dashed border-white/15 hover:border-emerald-400/60 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-1.5 transition-all group"
                          aria-label="Add more proofs"
                        >
                          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Plus className="w-4 h-4 text-emerald-300" />
                          </div>
                          <span className="text-[10px] text-white/80 font-semibold">
                            Add more
                          </span>
                          <span className="text-[9px] text-muted-foreground/70">
                            {MAX_PROOFS - proofs.length} left
                          </span>
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground/80 mt-2.5 flex items-start gap-1.5 leading-snug">
                      <Info className="w-3 h-3 mt-0.5 shrink-0 text-emerald-400/80" />
                      <span>
                        Paid in parts? Add a screenshot for each transfer — all
                        proofs are stitched into one image and sent together to
                        the merchant for review.
                      </span>
                    </p>
                  </>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFiles(e.target.files);
                    }
                    // Reset so the same file can be re-picked
                    e.target.value = "";
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
                disabled={!utr.trim() || proofs.length === 0 || submit.isPending}
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
                className="flex-1 py-3 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 font-bold text-sm hover:bg-emerald-500/25 hover:border-emerald-500/60 hover:text-emerald-100 shadow-[0_0_20px_-8px_rgba(16,185,129,0.45)] transition-all"
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

      {/* High-load delay banner: shows when any pending deposit is older
           than 30 minutes — this is the user-facing tail of the merchant
           escalation chain (10m → call merchant, 15m → call admin, 30m →
           tell user there's a backlog). */}
      {(() => {
        const stuck = (historyResp?.deposits ?? []).some(
          (d) =>
            d.status === "pending" &&
            Date.now() - new Date(d.createdAt).getTime() > 30 * 60 * 1000,
        );
        return stuck ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold">Heavy load — review delayed</div>
              <div className="opacity-80 mt-0.5">
                Our payment team is processing a high volume of requests. Your deposit is queued and
                will be approved shortly. No action needed from your side.
              </div>
            </div>
          </div>
        ) : null;
      })()}

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
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md overflow-y-auto overscroll-contain"
            onClick={() => setQrModalOpen(false)}
            style={{
              paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
              paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)",
            }}
          >
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="fixed top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white inline-flex items-center justify-center transition-colors shadow-lg"
              style={{ top: "max(env(safe-area-inset-top), 0.75rem)" }}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="min-h-full flex items-start sm:items-center justify-center px-4 py-14">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-sm flex flex-col items-center gap-4"
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
                    className="w-full max-h-[55vh] object-contain rounded-xl mx-auto"
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

async function combineProofsToSingleImage(
  dataUrls: string[],
): Promise<string | null> {
  if (dataUrls.length === 0) return null;
  if (dataUrls.length === 1) return dataUrls[0];

  // Load all images
  const images = await Promise.all(
    dataUrls.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () =>
            reject(new Error("Could not decode one of the proof images"));
          img.src = url;
        }),
    ),
  );

  // Cap each image to MAX_W wide so the combined output stays manageable
  const MAX_W = 1100;
  const dims = images.map((img) => {
    const scale = Math.min(1, MAX_W / Math.max(1, img.naturalWidth));
    return {
      w: Math.max(1, Math.round(img.naturalWidth * scale)),
      h: Math.max(1, Math.round(img.naturalHeight * scale)),
    };
  });

  const canvasW = Math.max(...dims.map((d) => d.w), 600);
  const GAP = 14;
  const LABEL_H = 32;
  const totalH =
    dims.reduce((sum, d) => sum + d.h + LABEL_H + GAP, 0) - GAP;

  const canvas = document.createElement("canvas");
  canvas.width = canvasW;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrls[0];

  // Dark background to match panel theme
  ctx.fillStyle = "#0a0d12";
  ctx.fillRect(0, 0, canvasW, totalH);

  let y = 0;
  for (let i = 0; i < images.length; i++) {
    // Label bar
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, y, canvasW, LABEL_H);
    ctx.fillStyle = "#fcd535";
    ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(
      `Proof #${i + 1} of ${images.length}`,
      14,
      y + LABEL_H / 2,
    );
    y += LABEL_H;
    // Image (centered horizontally)
    const x = Math.round((canvasW - dims[i].w) / 2);
    ctx.drawImage(images[i], x, y, dims[i].w, dims[i].h);
    y += dims[i].h + GAP;
  }

  // JPEG with reasonable quality keeps the size down vs PNG
  return canvas.toDataURL("image/jpeg", 0.85);
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
