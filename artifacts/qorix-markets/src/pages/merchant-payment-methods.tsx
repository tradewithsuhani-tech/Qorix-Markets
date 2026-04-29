import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Loader2, Banknote, Smartphone, X } from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { InputField } from "@/components/ui/input-field";

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

const empty: Partial<PaymentMethod> = {
  type: "upi",
  displayName: "",
  minAmount: "100",
  maxAmount: "500000",
  isActive: true,
};

export default function MerchantPaymentMethodsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<PaymentMethod> | null>(null);

  const { data, isLoading } = useQuery<{ methods: PaymentMethod[] }>({
    queryKey: ["merchant-methods"],
    queryFn: () => merchantAuthFetch(merchantApiUrl("/merchant/payment-methods")),
  });

  const saveM = useMutation({
    mutationFn: async (m: Partial<PaymentMethod>) => {
      const isEdit = Boolean(m.id);
      return merchantAuthFetch(
        merchantApiUrl(isEdit ? `/merchant/payment-methods/${m.id}` : "/merchant/payment-methods"),
        { method: isEdit ? "PATCH" : "POST", body: JSON.stringify(m) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-methods"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setEditing(null);
      toast({ title: "Method saved" });
    },
    onError: (err) => toast({ title: "Save failed", description: String(err), variant: "destructive" }),
  });

  const delM = useMutation({
    mutationFn: async (id: number) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/payment-methods/${id}`), { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-methods"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      toast({ title: "Method deleted" });
    },
    onError: (err) => toast({ title: "Delete failed", description: String(err), variant: "destructive" }),
  });

  async function handleQrFile(f: File | null) {
    if (!f || !editing) return;
    if (f.size > 1_500_000) {
      toast({ title: "QR too large (max 1.5MB)", variant: "destructive" });
      return;
    }
    const buf = await f.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    setEditing({ ...editing, qrImageBase64: `data:${f.type};base64,${b64}` });
  }

  return (
    <MerchantLayout>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Payment Methods</h1>
          <p className="text-sm text-slate-400 mt-1">UPI / bank accounts users will see when depositing INR.</p>
        </div>
        <button
          onClick={() => setEditing({ ...empty })}
          className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-3 py-2 text-sm"
        >
          <Plus className="h-4 w-4" /> Add method
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : !data?.methods.length ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
          No methods yet. Add your first UPI ID or bank account.
        </div>
      ) : (
        <div className="space-y-3">
          {data.methods.map((m) => (
            <div
              key={m.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex items-start gap-4"
            >
              <div className="rounded-lg bg-slate-800 p-3">
                {m.type === "upi" ? (
                  <Smartphone className="h-5 w-5 text-amber-300" />
                ) : (
                  <Banknote className="h-5 w-5 text-emerald-300" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{m.displayName}</div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase ${
                      m.isActive
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-700 text-slate-400"
                    }`}
                  >
                    {m.isActive ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {m.type === "upi" ? m.upiId : `${m.bankName ?? "Bank"} • ${m.accountNumber ?? ""}`}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  ₹{Number(m.minAmount).toLocaleString()} – ₹{Number(m.maxAmount).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(m)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${m.displayName}? Pending deposits on this method will become unreviewable.`)) {
                      delM.mutate(m.id);
                    }
                  }}
                  className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editing.id ? "Edit method" : "New method"}</h3>
              <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, type: "upi" })}
                  className={`rounded-lg border p-3 text-sm ${
                    editing.type === "upi"
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  <Smartphone className="h-4 w-4 inline mr-2" /> UPI
                </button>
                <button
                  type="button"
                  onClick={() => setEditing({ ...editing, type: "bank" })}
                  className={`rounded-lg border p-3 text-sm ${
                    editing.type === "bank"
                      ? "border-amber-500 bg-amber-500/10 text-amber-300"
                      : "border-slate-700 text-slate-300"
                  }`}
                >
                  <Banknote className="h-4 w-4 inline mr-2" /> Bank
                </button>
              </div>

              <InputField
                label="Display name (shown to user)"
                value={editing.displayName ?? ""}
                onChange={(v) => setEditing({ ...editing, displayName: v })}
              />

              {editing.type === "upi" ? (
                <>
                  <InputField
                    label="UPI ID"
                    value={editing.upiId ?? ""}
                    onChange={(v) => setEditing({ ...editing, upiId: v })}
                    placeholder="merchant@bank"
                  />
                  <div>
                    <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                      QR image (PNG/JPG, ≤1.5MB)
                    </label>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={(e) => handleQrFile(e.target.files?.[0] ?? null)}
                      className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-slate-200"
                    />
                    {editing.qrImageBase64 && (
                      <img
                        src={editing.qrImageBase64}
                        alt="QR preview"
                        className="mt-3 h-32 w-32 object-contain border border-slate-700 rounded"
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <InputField
                    label="Account holder"
                    value={editing.accountHolder ?? ""}
                    onChange={(v) => setEditing({ ...editing, accountHolder: v })}
                  />
                  <InputField
                    label="Account number"
                    value={editing.accountNumber ?? ""}
                    onChange={(v) => setEditing({ ...editing, accountNumber: v })}
                  />
                  <InputField
                    label="IFSC"
                    value={editing.ifsc ?? ""}
                    onChange={(v) => setEditing({ ...editing, ifsc: v.toUpperCase() })}
                  />
                  <InputField
                    label="Bank name"
                    value={editing.bankName ?? ""}
                    onChange={(v) => setEditing({ ...editing, bankName: v })}
                  />
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Min amount (₹)"
                  value={String(editing.minAmount ?? "100")}
                  onChange={(v) => setEditing({ ...editing, minAmount: v })}
                />
                <InputField
                  label="Max amount (₹)"
                  value={String(editing.maxAmount ?? "500000")}
                  onChange={(v) => setEditing({ ...editing, maxAmount: v })}
                />
              </div>

              <InputField
                label="Instructions (optional)"
                value={editing.instructions ?? ""}
                onChange={(v) => setEditing({ ...editing, instructions: v })}
                placeholder="e.g. Use only IMPS, no NEFT"
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.isActive ?? true}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                />
                Active (visible to users)
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={() => saveM.mutate(editing)}
                disabled={saveM.isPending || !editing.displayName}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {saveM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </MerchantLayout>
  );
}

