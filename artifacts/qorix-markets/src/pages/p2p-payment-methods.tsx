import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Plus, Trash2, CreditCard, Smartphone,
  Building2, AlertCircle, Loader2, CheckCircle2,
} from "lucide-react";

type PaymentMethod = {
  id: number; type: string; displayName: string;
  upiId: string | null; bankName: string | null;
  accountHolder: string | null; accountNumber: string | null;
  ifsc: string | null; isActive: boolean; createdAt: string;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  UPI: Smartphone, BANK: Building2, IMPS: CreditCard,
};

function MethodCard({ method, onDelete }: { method: PaymentMethod; onDelete: (id: number) => void }) {
  const Icon = TYPE_ICONS[method.type] ?? CreditCard;
  return (
    <div className="glass-card rounded-xl p-4 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <Icon size={16} className="text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-semibold text-sm">{method.displayName}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400 font-bold uppercase tracking-wider">{method.type}</span>
        </div>
        {method.upiId && <div className="text-slate-400 text-xs">{method.upiId}</div>}
        {method.bankName && <div className="text-slate-400 text-xs">{method.bankName}{method.accountNumber ? ` · ****${method.accountNumber.slice(-4)}` : ""}</div>}
        {method.ifsc && <div className="text-slate-500 text-xs mt-0.5">IFSC: {method.ifsc}</div>}
      </div>
      <button
        onClick={() => onDelete(method.id)}
        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function P2PPaymentMethodsPage() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    type: "UPI", displayName: "", upiId: "",
    bankName: "", branchName: "", accountHolder: "", accountNumber: "", ifsc: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [ifscLoading, setIfscLoading] = useState(false);
  const [ifscOk, setIfscOk] = useState(false);
  const ifscTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const m = await authFetch<PaymentMethod[]>("/api/p2p/payment-methods");
      setMethods(m);
    } catch { toast({ title: "Failed to load data", variant: "destructive" }); }
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
        } finally {
          setIfscLoading(false);
        }
      }, 400);
    } else {
      setIfscLoading(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await authFetch(`/api/p2p/payment-methods/${id}`, { method: "DELETE" });
      setMethods((prev) => prev.filter((m) => m.id !== id));
      toast({ title: "Payment method removed" });
    } catch { toast({ title: "Failed to remove method", variant: "destructive" }); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, string> = { type: form.type, displayName: form.displayName };
      if (form.type === "UPI") body.upiId = form.upiId;
      else { body.bankName = form.bankName; body.accountHolder = form.accountHolder; body.accountNumber = form.accountNumber; body.ifsc = form.ifsc; }

      const created = await authFetch<PaymentMethod>("/api/p2p/payment-methods", {
        method: "POST", body: JSON.stringify(body),
      });
      setMethods((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ type: "UPI", displayName: "", upiId: "", bankName: "", branchName: "", accountHolder: "", accountNumber: "", ifsc: "" });
      setIfscOk(false);
      toast({ title: "Payment method added" });
    } catch (err: any) {
      toast({ title: err.message || "Failed to add method", variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center gap-3">
          <Link href="/p2p">
            <button className="p-2 rounded-xl glass-card text-slate-400 hover:text-white">
              <ArrowLeft size={16} />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">P2P Settings</h1>
            <p className="text-slate-400 text-xs mt-0.5">Manage your payment methods for P2P trading</p>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Payment Methods</h2>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all"
            >
              <Plus size={12} /> Add Method
            </button>
          </div>

          {/* Add Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="glass-card rounded-xl p-5 space-y-4">
              <h3 className="text-white font-semibold text-sm">Add New Method</h3>

              {/* Type */}
              <div className="flex gap-2">
                {["UPI", "BANK", "IMPS"].map((t) => (
                  <button
                    key={t} type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      form.type === t
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                        : "bg-white/[0.03] border-white/10 text-slate-400"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <Field label="Display Name" required>
                <input required value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="e.g. My UPI ID" className={inputCls} />
              </Field>

              {form.type === "UPI" ? (
                <Field label="UPI ID" required>
                  <input required value={form.upiId} onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))}
                    placeholder="yourname@upi" className={inputCls} />
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
                      <input
                        required
                        value={form.ifsc}
                        onChange={(e) => handleIfscChange(e.target.value)}
                        placeholder="e.g. HDFC0001234"
                        maxLength={11}
                        className={`${inputCls} pr-9 font-mono tracking-widest uppercase`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {ifscLoading && <Loader2 size={14} className="text-slate-400 animate-spin" />}
                        {!ifscLoading && ifscOk && <CheckCircle2 size={14} className="text-emerald-400" />}
                      </div>
                    </div>
                  </Field>
                  {/* Auto-filled bank info */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bank Name">
                      <input
                        readOnly
                        value={form.bankName}
                        placeholder="Auto-filled from IFSC"
                        className={`${inputCls} bg-white/[0.02] text-slate-300 cursor-default`}
                      />
                    </Field>
                    <Field label="Branch">
                      <input
                        readOnly
                        value={form.branchName}
                        placeholder="Auto-filled from IFSC"
                        className={`${inputCls} bg-white/[0.02] text-slate-300 cursor-default`}
                      />
                    </Field>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold disabled:opacity-50">
                  {submitting ? "Adding..." : "Add Method"}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl glass-card text-slate-400 text-sm hover:text-white">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <div key={i} className="glass-card rounded-xl h-20 animate-pulse" />)
          ) : methods.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <AlertCircle size={28} className="text-slate-600" />
              <p className="text-slate-500 text-sm">No payment methods added yet</p>
              <p className="text-slate-600 text-xs">Add a UPI ID or bank account to start selling USDT</p>
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map((m) => <MethodCard key={m.id} method={m} onDelete={handleDelete} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

const inputCls = "w-full px-3 py-2.5 bg-black/30 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-400/40";

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
