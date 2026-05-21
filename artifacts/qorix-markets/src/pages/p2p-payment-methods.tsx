import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, AlertCircle, Loader2, CheckCircle2,
  Eye, EyeOff, QrCode, X, Upload, ImageOff,
} from "lucide-react";

const METHOD_COLORS: Record<string, string> = {
  UPI: "bg-slate-400", PHONEPE: "bg-purple-500", GPAY: "bg-blue-500",
  PAYTM: "bg-sky-400", IMPS: "bg-orange-500", NEFT: "bg-teal-500",
  RTGS: "bg-teal-600", BANK: "bg-amber-500", DIGITAL_ERUPEE: "bg-cyan-500",
};
const METHOD_LABELS: Record<string, string> = {
  UPI: "UPI", PHONEPE: "PhonePe", GPAY: "Google Pay",
  PAYTM: "Paytm", IMPS: "IMPS", NEFT: "NEFT",
  RTGS: "RTGS", BANK: "Bank Transfer", DIGITAL_ERUPEE: "Digital eRupee",
};

const UPI_TYPES = ["UPI", "PHONEPE", "GPAY", "PAYTM", "DIGITAL_ERUPEE"];
const BANK_TYPES = ["BANK", "IMPS", "NEFT", "RTGS"];

type PaymentMethod = {
  id: number; type: string; displayName: string;
  upiId: string | null; bankName: string | null;
  accountHolder: string | null; accountNumber: string | null;
  ifsc: string | null; isActive: boolean; createdAt: string;
  qrCodeData: string | null;
};

function QrModal({ method, onClose }: { method: PaymentMethod; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full ${METHOD_COLORS[method.type] ?? "bg-slate-500"}`} />
            <span className="font-bold text-gray-900">{METHOD_LABELS[method.type] ?? method.type}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="text-center px-5 pb-2">
          <p className="font-bold text-sm uppercase tracking-wide" style={{ color: "#7c3aed" }}>ACCEPTED HERE</p>
          <p className="text-gray-500 text-xs mt-1">Scan & Pay Using {METHOD_LABELS[method.type] ?? method.type} App</p>
        </div>
        <div className="px-5 pb-5">
          <img src={method.qrCodeData!} alt="QR Code" className="w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function MethodCard({ method, onDelete }: { method: PaymentMethod; onDelete: (id: number) => void }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const barColor = METHOD_COLORS[method.type] ?? "bg-slate-500";
  const isUpiType = UPI_TYPES.includes(method.type);
  return (
    <>
      {showQr && method.qrCodeData && <QrModal method={method} onClose={() => setShowQr(false)} />}
      <div className="glass-card rounded-xl overflow-hidden">
        {/* Main row */}
        <div className="flex items-stretch">
          <div className={`w-1 ${barColor} shrink-0`} />
          <div className="flex-1 px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-white font-semibold text-sm">{method.displayName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 font-bold">{METHOD_LABELS[method.type] ?? method.type}</span>
              </div>
              {method.upiId && <div className="text-slate-400 text-xs font-mono">{method.upiId}</div>}
              {method.accountHolder && <div className="text-slate-400 text-xs uppercase font-semibold">{method.accountHolder}</div>}
              {method.accountNumber && <div className="text-slate-500 text-xs font-mono">****{method.accountNumber.slice(-4)} · {method.bankName || ""}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {method.qrCodeData && (
                <button onClick={() => setShowQr(true)} title="View QR Code"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors">
                  <QrCode size={14} />
                </button>
              )}
              <button onClick={() => setShowDetails((v) => !v)} title={showDetails ? "Hide" : "View details"}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
                {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button onClick={() => onDelete(method.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Expanded details */}
        {showDetails && (
          <div className="border-t border-white/[0.06] bg-black/20 px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-600 font-bold mb-2">Account Details</p>
            {isUpiType ? (
              <DetailRow label="UPI / ID" value={method.upiId} />
            ) : (
              <>
                <DetailRow label="Account Holder" value={method.accountHolder} />
                <DetailRow label="Account Number" value={method.accountNumber} mono />
                <DetailRow label="IFSC Code" value={method.ifsc} mono />
                <DetailRow label="Bank Name" value={method.bankName} />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-slate-500 text-xs shrink-0">{label}</span>
      <span className={`text-white text-xs font-medium text-right ${mono ? "font-mono tracking-wider" : ""}`}>{value}</span>
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-400/40 placeholder-slate-600";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function P2PPaymentMethodsPage() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    type: "UPI", displayName: "", upiId: "",
    bankName: "", branchName: "", accountHolder: "", accountNumber: "", ifsc: "",
    qrCodeData: "" as string,
  });
  const [submitting, setSubmitting] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscOk, setIfscOk] = useState(false);
  const ifscTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUpiType = UPI_TYPES.includes(form.type);

  async function loadData() {
    setLoading(true);
    try { setMethods(await authFetch<PaymentMethod[]>("/api/p2p/payment-methods")); }
    catch { toast({ title: "Failed to load payment methods", variant: "destructive" }); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadData(); }, []);

  function handleIfscChange(val: string) {
    const code = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    setForm((f) => ({ ...f, ifsc: code, bankName: "", branchName: "" }));
    setIfscOk(false);
    if (ifscTimer.current) clearTimeout(ifscTimer.current);
    if (code.length === 11) {
      setIfscLoading(true);
      ifscTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`https://ifsc.razorpay.com/${code}`);
          if (!res.ok) throw new Error("Invalid IFSC");
          const data = await res.json();
          setForm((f) => ({ ...f, bankName: data.BANK || "", branchName: data.BRANCH || "" }));
          setIfscOk(true);
        } catch {
          setForm((f) => ({ ...f, bankName: "", branchName: "" }));
          setIfscOk(false);
        } finally { setIfscLoading(false); }
      }, 400);
    } else { setIfscLoading(false); }
  }

  function handleQrUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "QR image must be under 500KB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, qrCodeData: ev.target?.result as string }));
    reader.readAsDataURL(file);
  }

  async function handleDelete(id: number) {
    try {
      await authFetch(`/api/p2p/payment-methods/${id}`, { method: "DELETE" });
      setMethods((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "Payment method removed" });
    } catch { toast({ title: "Failed to remove", variant: "destructive" }); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, string | null> = {
        type: form.type, displayName: form.displayName,
        qrCodeData: form.qrCodeData || null,
      };
      if (isUpiType) { body.upiId = form.upiId; }
      else { body.bankName = form.bankName; body.accountHolder = form.accountHolder; body.accountNumber = form.accountNumber; body.ifsc = form.ifsc; }

      const created = await authFetch<PaymentMethod>("/api/p2p/payment-methods", { method: "POST", body: JSON.stringify(body) });
      setMethods((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ type: "UPI", displayName: "", upiId: "", bankName: "", branchName: "", accountHolder: "", accountNumber: "", ifsc: "", qrCodeData: "" });
      setIfscOk(false);
      toast({ title: "Payment method added!" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to add method", variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center gap-3">
          <Link href="/p2p">
            <button className="p-2 rounded-xl glass-card text-slate-400 hover:text-white"><ArrowLeft size={16} /></button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">P2P Payment Methods</h1>
            <p className="text-slate-400 text-xs mt-0.5">Manage accounts used for P2P trades</p>
          </div>
        </div>

        {/* Add button */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">My Methods</h2>
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all">
            <Plus size={12} /> Add Method
          </button>
        </div>

        {/* ── Add Form ─────────────────────────────────────────────── */}
        {showForm && (
          <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-sm">Add New Payment Method</h3>

            {/* Type selector */}
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Type</p>
              <div className="flex flex-wrap gap-2">
                {[...UPI_TYPES, ...BANK_TYPES].map((t) => (
                  <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      form.type === t
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : "bg-white/[0.03] border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${METHOD_COLORS[t] ?? "bg-slate-500"}`} />
                    {METHOD_LABELS[t] ?? t}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Display Name" required>
              <input required value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder={`e.g. My ${METHOD_LABELS[form.type] ?? form.type}`} className={inputCls} />
            </Field>

            {isUpiType ? (
              <Field label={form.type === "PHONEPE" || form.type === "GPAY" || form.type === "PAYTM" ? "UPI ID / Phone Number" : "UPI ID"} required>
                <input required value={form.upiId} onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
                  placeholder={form.type === "PHONEPE" ? "phone@ybl or 9876543210" : form.type === "GPAY" ? "phone@okicici or phone number" : "yourname@upi"}
                  className={inputCls} />
              </Field>
            ) : (
              <>
                <Field label="Account Holder" required>
                  <input required value={form.accountHolder} onChange={(e) => setForm((f) => ({ ...f, accountHolder: e.target.value }))}
                    placeholder="Full name as per bank" className={inputCls} />
                </Field>
                <Field label="Account Number" required>
                  <input required value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="Enter account number" className={inputCls} />
                </Field>
                <Field label="IFSC Code" required>
                  <div className="relative">
                    <input required value={form.ifsc} onChange={(e) => handleIfscChange(e.target.value)}
                      placeholder="e.g. HDFC0001234" maxLength={11}
                      className={`${inputCls} pr-9 font-mono tracking-widest uppercase`} />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {ifscLoading && <Loader2 size={14} className="text-slate-400 animate-spin" />}
                      {!ifscLoading && ifscOk && <CheckCircle2 size={14} className="text-emerald-400" />}
                    </div>
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bank Name">
                    <input readOnly value={form.bankName} placeholder="Auto-filled from IFSC" className={`${inputCls} bg-white/[0.02] cursor-default`} />
                  </Field>
                  <Field label="Branch">
                    <input readOnly value={form.branchName} placeholder="Auto-filled from IFSC" className={`${inputCls} bg-white/[0.02] cursor-default`} />
                  </Field>
                </div>
              </>
            )}

            {/* QR Code Upload */}
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
                QR Code <span className="text-slate-600 normal-case font-normal">(optional — for buyers to scan)</span>
              </p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
              {form.qrCodeData ? (
                <div className="relative inline-block">
                  <img src={form.qrCodeData} alt="QR preview" className="w-32 h-32 rounded-xl border border-white/10 object-contain bg-white" />
                  <button type="button" onClick={() => { setForm((f) => ({ ...f, qrCodeData: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card border border-dashed border-white/15 text-slate-400 hover:text-white hover:border-white/30 text-sm transition-all">
                  <Upload size={14} />
                  Upload QR Code
                </button>
              )}
              <p className="text-xs text-slate-600 mt-1.5">Image will be shown to buyers so they can scan & pay directly.</p>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Adding…" : "Add Method"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2.5 rounded-xl glass-card text-slate-400 text-sm hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Method list ──────────────────────────────────────────── */}
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />)
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <ImageOff size={28} className="text-slate-600" />
            <p className="text-slate-500 text-sm">No payment methods added yet</p>
            <p className="text-slate-600 text-xs text-center">Add a UPI, bank account or digital wallet to start trading</p>
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((m) => <MethodCard key={m.id} method={m} onDelete={handleDelete} />)}
          </div>
        )}

        <div className="flex items-start gap-2 glass-card rounded-xl p-3 text-xs text-slate-500">
          <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-500" />
          <span>Your account details are only shared with trading counterparties during an active order. Maximum 10 methods.</span>
        </div>
      </div>
    </Layout>
  );
}
