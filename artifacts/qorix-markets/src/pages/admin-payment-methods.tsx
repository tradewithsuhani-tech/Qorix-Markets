import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  Banknote,
  Smartphone,
  Plus,
  Trash2,
  Pencil,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  Upload,
  X,
  ImageIcon,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL ?? "/";
function getApiUrl(p: string) {
  return `${BASE_URL}api${p}`;
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

interface AdminInrDeposit {
  id: number;
  userId: number;
  userEmail: string | null;
  userName: string | null;
  paymentMethodId: number;
  amountInr: string;
  amountUsdt: string;
  rateUsed: string;
  utr: string;
  proofImageBase64: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
}

const emptyForm: Partial<PaymentMethod> = {
  type: "bank",
  displayName: "",
  accountHolder: "",
  accountNumber: "",
  ifsc: "",
  bankName: "",
  upiId: "",
  qrImageBase64: null,
  minAmount: "100",
  maxAmount: "500000",
  instructions: "",
  isActive: true,
  sortOrder: 0,
};

function MethodForm({
  initial,
  onCancel,
  onSave,
  saving,
}: {
  initial: Partial<PaymentMethod>;
  onCancel: () => void;
  onSave: (m: Partial<PaymentMethod>) => void;
  saving: boolean;
}) {
  const [m, setM] = useState<Partial<PaymentMethod>>(initial);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleQr = (file: File) => {
    if (file.size > 1024 * 1024) {
      toast({ title: "QR too large", description: "Max 1 MB", variant: "destructive" });
      return;
    }
    const r = new FileReader();
    r.onload = () => setM({ ...m, qrImageBase64: r.result as string });
    r.readAsDataURL(file);
  };

  const set = (k: keyof PaymentMethod, v: any) => setM({ ...m, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => set("type", "bank")}
          className={cn(
            "p-3 rounded-xl border flex items-center gap-2 transition-all",
            m.type === "bank"
              ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
              : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/5"
          )}
        >
          <Banknote className="w-4 h-4" />
          <span className="text-sm font-semibold">Bank</span>
        </button>
        <button
          onClick={() => set("type", "upi")}
          className={cn(
            "p-3 rounded-xl border flex items-center gap-2 transition-all",
            m.type === "upi"
              ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
              : "border-white/10 bg-white/[0.02] text-muted-foreground hover:bg-white/5"
          )}
        >
          <Smartphone className="w-4 h-4" />
          <span className="text-sm font-semibold">UPI</span>
        </button>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Display name</label>
        <input
          className="field-input"
          value={m.displayName ?? ""}
          onChange={(e) => set("displayName", e.target.value)}
          placeholder={m.type === "bank" ? "HDFC Bank — Main" : "GPay / PhonePe"}
        />
      </div>

      {m.type === "bank" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Bank name</label>
              <input className="field-input" value={m.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">IFSC</label>
              <input className="field-input" value={m.ifsc ?? ""} onChange={(e) => set("ifsc", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Account holder</label>
            <input className="field-input" value={m.accountHolder ?? ""} onChange={(e) => set("accountHolder", e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Account number</label>
            <input className="field-input" value={m.accountNumber ?? ""} onChange={(e) => set("accountNumber", e.target.value)} />
          </div>
        </div>
      )}

      {m.type === "upi" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">UPI ID</label>
            <input className="field-input" value={m.upiId ?? ""} onChange={(e) => set("upiId", e.target.value)} placeholder="example@oksbi" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">QR image</label>
            {!m.qrImageBase64 ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full border border-dashed border-white/15 hover:border-white/30 rounded-xl p-4 flex items-center justify-center gap-2 transition-colors text-xs text-muted-foreground"
              >
                <Upload className="w-4 h-4" />
                Upload QR
              </button>
            ) : (
              <div className="relative inline-block">
                <img src={m.qrImageBase64} alt="qr" className="max-h-32 rounded-xl border border-white/10 bg-white p-2" />
                <button
                  type="button"
                  onClick={() => set("qrImageBase64", null)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
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
                if (f) handleQr(f);
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Min amount (₹)</label>
          <input
            type="number"
            className="field-input"
            value={m.minAmount ?? ""}
            onChange={(e) => set("minAmount", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Max amount (₹)</label>
          <input
            type="number"
            className="field-input"
            value={m.maxAmount ?? ""}
            onChange={(e) => set("maxAmount", e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Instructions (optional)</label>
        <textarea
          className="field-input"
          rows={3}
          value={m.instructions ?? ""}
          onChange={(e) => set("instructions", e.target.value)}
          placeholder="Any note shown to users above the form"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-white"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(m)}
          disabled={saving || !m.displayName}
          className="btn-primary"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="inline-flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save</span>}
        </button>
      </div>
    </div>
  );
}

export default function AdminPaymentMethodsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: methodsResp } = useQuery<{ methods: PaymentMethod[] }>({
    queryKey: ["admin-payment-methods"],
    queryFn: () => authFetch(getApiUrl("/admin/payment-methods")),
  });
  const methods = methodsResp?.methods ?? [];

  const { data: depositsResp } = useQuery<{ deposits: AdminInrDeposit[] }>({
    queryKey: ["admin-inr-deposits", "pending"],
    queryFn: () => authFetch(getApiUrl("/admin/inr-deposits?status=pending")),
    refetchInterval: 15000,
  });
  const deposits = depositsResp?.deposits ?? [];

  const { data: rateResp } = useQuery<{ rate: number }>({
    queryKey: ["admin-inr-rate"],
    queryFn: () => authFetch(getApiUrl("/admin/inr-rate")),
  });
  const [rateInput, setRateInput] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [previewProof, setPreviewProof] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (m: Partial<PaymentMethod>) =>
      authFetch(getApiUrl("/admin/payment-methods"), { method: "POST", body: JSON.stringify(m) }),
    onSuccess: () => {
      toast({ title: "Method created" });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: ({ id, ...rest }: Partial<PaymentMethod> & { id: number }) =>
      authFetch(getApiUrl(`/admin/payment-methods/${id}`), { method: "PATCH", body: JSON.stringify(rest) }),
    onSuccess: () => {
      toast({ title: "Method updated" });
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      authFetch(getApiUrl(`/admin/payment-methods/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Method deleted" });
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const setRate = useMutation({
    mutationFn: (rate: number) =>
      authFetch(getApiUrl("/admin/inr-rate"), { method: "POST", body: JSON.stringify({ rate }) }),
    onSuccess: () => {
      toast({ title: "Rate updated" });
      setRateInput("");
      qc.invalidateQueries({ queryKey: ["admin-inr-rate"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: ({ id, note, amountUsdt }: { id: number; note?: string; amountUsdt?: string }) =>
      authFetch(getApiUrl(`/admin/inr-deposits/${id}/approve`), {
        method: "POST",
        body: JSON.stringify({ adminNote: note, amountUsdt }),
      }),
    onSuccess: () => {
      toast({ title: "Deposit approved", description: "USDT credited to user wallet" });
      qc.invalidateQueries({ queryKey: ["admin-inr-deposits", "pending"] });
    },
    onError: (e: any) => toast({ title: "Approve failed", description: e?.message, variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      authFetch(getApiUrl(`/admin/inr-deposits/${id}/reject`), {
        method: "POST",
        body: JSON.stringify({ adminNote: note }),
      }),
    onSuccess: () => {
      toast({ title: "Deposit rejected" });
      qc.invalidateQueries({ queryKey: ["admin-inr-deposits", "pending"] });
    },
    onError: (e: any) => toast({ title: "Reject failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight gradient-text">INR Payments</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage Bank/UPI methods, conversion rate, and approve INR deposits.
            </p>
          </div>
          <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
        </div>

        {/* Rate */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <SettingsIcon className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-white">INR → USDT rate</span>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Current rate (₹ per 1 USDT)</label>
              <input
                type="number"
                step="0.01"
                className="field-input"
                placeholder={rateResp?.rate ? String(rateResp.rate) : "85.00"}
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const n = Number(rateInput);
                if (!n || n <= 0) {
                  toast({ title: "Invalid rate", variant: "destructive" });
                  return;
                }
                setRate.mutate(n);
              }}
              disabled={setRate.isPending || !rateInput}
              className="btn-primary"
            >
              {setRate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update rate"}
            </button>
          </div>
          {rateResp?.rate && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Current: <span className="text-white font-semibold">1 USDT = ₹{rateResp.rate}</span>
            </p>
          )}
        </div>

        {/* Pending deposits */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-white/8 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Pending INR deposits</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{deposits.length} awaiting review</div>
            </div>
          </div>
          {deposits.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-muted-foreground">No pending deposits</div>
          ) : (
            <div className="divide-y divide-white/5">
              {deposits.map((d) => (
                <PendingDepositRow
                  key={d.id}
                  d={d}
                  onApprove={(note, amt) => approve.mutate({ id: d.id, note, amountUsdt: amt })}
                  onReject={(note) => reject.mutate({ id: d.id, note })}
                  busy={approve.isPending || reject.isPending}
                  onPreview={setPreviewProof}
                />
              ))}
            </div>
          )}
        </div>

        {/* Payment methods */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-white/8 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Payment methods</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{methods.length} configured</div>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="btn-primary"
            >
              <span className="inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</span>
            </button>
          </div>

          {showAdd && (
            <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02]">
              <MethodForm
                initial={emptyForm}
                onCancel={() => setShowAdd(false)}
                onSave={(m) => create.mutate(m)}
                saving={create.isPending}
              />
            </div>
          )}

          {methods.length === 0 && !showAdd ? (
            <div className="px-5 py-10 text-center text-xs text-muted-foreground">No methods yet — click Add to create one</div>
          ) : (
            <div className="divide-y divide-white/5">
              {methods
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((m) => (
                  <div key={m.id} className="px-5 py-3">
                    {editing?.id === m.id ? (
                      <MethodForm
                        initial={editing}
                        onCancel={() => setEditing(null)}
                        onSave={(updated) => update.mutate({ ...updated, id: m.id })}
                        saving={update.isPending}
                      />
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                          m.type === "bank" ? "bg-blue-500/15 text-blue-400" : "bg-violet-500/15 text-violet-400"
                        )}>
                          {m.type === "bank" ? <Banknote className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{m.displayName}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {m.type === "bank"
                              ? `${m.bankName ?? "—"} · ${m.accountNumber ? "••••" + m.accountNumber.slice(-4) : "no a/c"}`
                              : m.upiId ?? "no UPI ID"}
                            {" · "}₹{Number(m.minAmount).toLocaleString("en-IN")} – ₹{Number(m.maxAmount).toLocaleString("en-IN")}
                          </div>
                        </div>
                        <button
                          onClick={() => update.mutate({ id: m.id, isActive: !m.isActive })}
                          className={cn(
                            "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            m.isActive
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                              : "bg-white/5 text-muted-foreground border-white/10"
                          )}
                        >
                          {m.isActive ? "Active" : "Off"}
                        </button>
                        <button
                          onClick={() => update.mutate({ id: m.id, sortOrder: m.sortOrder - 1 })}
                          className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-md"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => update.mutate({ id: m.id, sortOrder: m.sortOrder + 1 })}
                          className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-md"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditing(m)}
                          className="p-1.5 text-muted-foreground hover:text-white hover:bg-white/5 rounded-md"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${m.displayName}"?`)) remove.mutate(m.id);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Proof preview modal */}
      {previewProof && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewProof(null)}
        >
          <div className="relative max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewProof(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={previewProof} alt="proof" className="max-w-full max-h-[85vh] rounded-xl border border-white/10" />
          </div>
        </div>
      )}
    </Layout>
  );
}

function PendingDepositRow({
  d,
  onApprove,
  onReject,
  busy,
  onPreview,
}: {
  d: AdminInrDeposit;
  onApprove: (note?: string, amountUsdt?: string) => void;
  onReject: (note: string) => void;
  busy: boolean;
  onPreview: (src: string) => void;
}) {
  const [note, setNote] = useState("");
  const [overrideUsdt, setOverrideUsdt] = useState("");
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="px-5 py-4">
      <div className="flex items-start gap-3">
        {d.proofImageBase64 ? (
          <button
            onClick={() => onPreview(d.proofImageBase64!)}
            className="w-12 h-12 rounded-lg border border-white/10 overflow-hidden shrink-0 bg-white/5"
          >
            <img src={d.proofImageBase64} alt="proof" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <ImageIcon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">
            ₹{Number(d.amountInr).toLocaleString("en-IN")}
            <span className="text-[11px] text-muted-foreground font-normal ml-2">
              → {Number(d.amountUsdt).toFixed(2)} USDT @ ₹{d.rateUsed}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {d.userName ?? d.userEmail ?? `user#${d.userId}`} · UTR <span className="font-mono text-white">{d.utr}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(d.createdAt).toLocaleString()}
          </div>
        </div>
        <button
          onClick={() => setShowActions(!showActions)}
          className="px-3 py-1.5 text-xs rounded-md bg-white/5 hover:bg-white/10 text-white"
        >
          Review
        </button>
      </div>
      {showActions && (
        <div className="mt-3 pl-15 space-y-2 pt-3 border-t border-white/5">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Admin note (optional for approve, required for reject)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field-input text-xs"
            />
            <input
              type="number"
              step="0.01"
              placeholder={`Override USDT (default ${Number(d.amountUsdt).toFixed(2)})`}
              value={overrideUsdt}
              onChange={(e) => setOverrideUsdt(e.target.value)}
              className="field-input text-xs"
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => onReject(note || "Rejected by admin")}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25 inline-flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={() => onApprove(note || undefined, overrideUsdt || undefined)}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/25 inline-flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Approve & Credit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
