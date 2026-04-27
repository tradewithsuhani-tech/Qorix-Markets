import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote,
  Smartphone,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Copy,
  CheckCheck,
  Info,
  ImageIcon,
  X,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
    >
      {copied ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
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
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold border px-1.5 py-0.5 rounded-full uppercase tracking-wider", cls)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export function InrDepositTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

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

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = methods.find((m) => m.id === selectedId) ?? null;
  const amountNum = Number(amount);
  const min = selected ? Number(selected.minAmount) : 0;
  const max = selected ? Number(selected.maxAmount) : 0;
  const amountValid = selected && amountNum >= min && amountNum <= max;
  const usdtPreview = amountNum > 0 && rate > 0 ? (amountNum / rate).toFixed(2) : "0.00";

  const submit = useMutation({
    mutationFn: () =>
      authFetch(getApiUrl("/inr-deposits"), {
        method: "POST",
        body: JSON.stringify({
          paymentMethodId: selectedId,
          amountInr: amount,
          utr: utr.trim(),
          proofImageBase64: proof,
        }),
      }),
    onSuccess: () => {
      toast({ title: "Deposit submitted", description: "Admin will verify and credit your wallet shortly." });
      setSelectedId(null);
      setAmount("");
      setUtr("");
      setProof(null);
      qc.invalidateQueries({ queryKey: ["inr-deposits-mine"] });
    },
    onError: (e: any) => {
      toast({ title: "Failed", description: e?.message ?? "Could not submit", variant: "destructive" });
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

  return (
    <div className="space-y-6">
      {/* Rate banner */}
      <div className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-xs text-muted-foreground">Conversion rate</span>
        </div>
        <div className="text-sm font-bold text-white">
          1 USDT = ₹{rate}
        </div>
      </div>

      {/* Step 1: Select method */}
      {!selected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="text-sm font-semibold text-white mb-3">Choose payment method</div>
          <div className="grid gap-3">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className="w-full text-left p-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 transition-all flex items-center gap-3"
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  m.type === "bank" ? "bg-blue-500/15 text-blue-400" : "bg-violet-500/15 text-violet-400"
                )}>
                  {m.type === "bank" ? <Banknote className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{m.displayName}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    ₹{Number(m.minAmount).toLocaleString("en-IN")} – ₹{Number(m.maxAmount).toLocaleString("en-IN")}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{m.type}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Step 2: Selected method details + form */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center",
                  selected.type === "bank" ? "bg-blue-500/15 text-blue-400" : "bg-violet-500/15 text-violet-400"
                )}>
                  {selected.type === "bank" ? <Banknote className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                </div>
                <div className="text-sm font-semibold text-white">{selected.displayName}</div>
              </div>
              <button
                onClick={() => { setSelectedId(null); setAmount(""); setUtr(""); setProof(null); }}
                className="text-[11px] text-muted-foreground hover:text-white"
              >
                Change
              </button>
            </div>

            {/* Bank or UPI details */}
            {selected.type === "bank" && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2 text-xs">
                {selected.bankName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span className="text-white font-medium">{selected.bankName}</span>
                  </div>
                )}
                {selected.accountHolder && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Account holder</span>
                    <span className="text-white font-medium">{selected.accountHolder}</span>
                  </div>
                )}
                {selected.accountNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">A/C number</span>
                    <span className="text-white font-mono">
                      {selected.accountNumber}
                      <CopyChip text={selected.accountNumber} />
                    </span>
                  </div>
                )}
                {selected.ifsc && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">IFSC</span>
                    <span className="text-white font-mono">
                      {selected.ifsc}
                      <CopyChip text={selected.ifsc} />
                    </span>
                  </div>
                )}
              </div>
            )}

            {selected.type === "upi" && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
                {selected.upiId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">UPI ID</span>
                    <span className="text-white font-mono">
                      {selected.upiId}
                      <CopyChip text={selected.upiId} />
                    </span>
                  </div>
                )}
                {selected.qrImageBase64 && (
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <img
                      src={selected.qrImageBase64}
                      alt="UPI QR"
                      className="w-44 h-44 rounded-xl border border-white/10 object-contain bg-white p-2"
                    />
                    <span className="text-[10px] text-muted-foreground">Scan with any UPI app</span>
                  </div>
                )}
              </div>
            )}

            {selected.instructions && (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-blue-100/80 leading-relaxed">
                {selected.instructions}
              </div>
            )}
          </div>

          {/* Amount + UTR + Proof */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                Amount (INR)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="field-input"
                placeholder={`Between ₹${Number(selected.minAmount)} and ₹${Number(selected.maxAmount)}`}
                min={Number(selected.minAmount)}
                max={Number(selected.maxAmount)}
              />
              {amount && !amountValid && (
                <p className="text-[11px] text-red-400 mt-1">
                  Amount must be between ₹{Number(selected.minAmount).toLocaleString("en-IN")} and ₹{Number(selected.maxAmount).toLocaleString("en-IN")}
                </p>
              )}
              {amountValid && (
                <p className="text-[11px] text-emerald-400 mt-1">
                  You will receive ≈ <span className="font-bold">{usdtPreview} USDT</span> after approval
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                UTR / Transaction reference
              </label>
              <input
                type="text"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                className="field-input"
                placeholder="12-digit UTR or transaction ID"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Found in your bank/UPI app after payment. Required for verification.
              </p>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                Payment screenshot <span className="text-muted-foreground/70">(optional, max 2 MB)</span>
              </label>
              {!proof ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full border border-dashed border-white/15 hover:border-white/30 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload screenshot</span>
                </button>
              ) : (
                <div className="relative inline-block">
                  <img src={proof} alt="proof" className="max-h-40 rounded-xl border border-white/10" />
                  <button
                    type="button"
                    onClick={() => setProof(null)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
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

            <button
              type="button"
              onClick={() => submit.mutate()}
              disabled={!amountValid || !utr.trim() || submit.isPending}
              className="btn-primary w-full"
            >
              {submit.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                </span>
              ) : (
                "Submit deposit for review"
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* History */}
      <div className="glass-card rounded-2xl overflow-hidden">
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
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
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
    </div>
  );
}
