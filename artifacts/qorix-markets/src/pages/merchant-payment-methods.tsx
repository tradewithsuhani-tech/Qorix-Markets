import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Banknote,
  Smartphone,
  X,
  QrCode,
} from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { InputField } from "@/components/ui/input-field";
import {
  PageHeader,
  PremiumCard,
  StatusPill,
  SectionLabel,
  GoldButton,
  GhostButton,
} from "@/components/merchant-ui";
import { cn } from "@/lib/utils";

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
        merchantApiUrl(
          isEdit ? `/merchant/payment-methods/${m.id}` : "/merchant/payment-methods",
        ),
        { method: isEdit ? "PATCH" : "POST", body: JSON.stringify(m) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-methods"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setEditing(null);
      toast({ title: "Method saved" });
    },
    onError: (err) =>
      toast({
        title: "Save failed",
        description: String(err),
        variant: "destructive",
      }),
  });

  const delM = useMutation({
    mutationFn: async (id: number) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/payment-methods/${id}`), {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-methods"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      toast({ title: "Method deleted" });
    },
    onError: (err) =>
      toast({
        title: "Delete failed",
        description: String(err),
        variant: "destructive",
      }),
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
      <PageHeader
        title="Payment Methods"
        subtitle="UPI / bank accounts users will see when depositing INR."
        action={
          <GoldButton onClick={() => setEditing({ ...empty })}>
            <Plus className="h-4 w-4" /> Add method
          </GoldButton>
        }
      />

      {isLoading ? (
        <PremiumCard className="flex items-center justify-center py-20 text-sm text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </PremiumCard>
      ) : !data?.methods.length ? (
        <PremiumCard className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <Smartphone className="h-6 w-6 text-slate-500" />
          </div>
          <div className="mt-4 text-sm font-semibold text-white">
            No payment methods yet
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Add your first UPI ID or bank account to start receiving deposits.
          </div>
          <div className="mt-5">
            <GoldButton onClick={() => setEditing({ ...empty })}>
              <Plus className="h-4 w-4" /> Add your first method
            </GoldButton>
          </div>
        </PremiumCard>
      ) : (
        <div className="grid gap-3">
          {data.methods.map((m) => (
            <MethodCard
              key={m.id}
              m={m}
              onEdit={() => setEditing(m)}
              onDelete={() => {
                if (
                  confirm(
                    `Delete ${m.displayName}? Pending deposits on this method will become unreviewable.`,
                  )
                ) {
                  delM.mutate(m.id);
                }
              }}
            />
          ))}
        </div>
      )}

      {editing && (
        <MethodFormModal
          editing={editing}
          setEditing={setEditing}
          onClose={() => setEditing(null)}
          onSave={() => saveM.mutate(editing)}
          saving={saveM.isPending}
          onQrFile={handleQrFile}
        />
      )}
    </MerchantLayout>
  );
}

function MethodCard({
  m,
  onEdit,
  onDelete,
}: {
  m: PaymentMethod;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <PremiumCard className="flex items-start gap-4 p-4">
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border",
          m.type === "upi"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        )}
      >
        {m.type === "upi" ? (
          <Smartphone className="h-5 w-5" />
        ) : (
          <Banknote className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-white">{m.displayName}</div>
          <StatusPill variant={m.isActive ? "success" : "neutral"}>
            {m.isActive ? "Active" : "Disabled"}
          </StatusPill>
          <StatusPill variant="info">{m.type.toUpperCase()}</StatusPill>
        </div>
        <div className="mt-1 truncate text-xs text-slate-400">
          {m.type === "upi" ? (
            <span className="font-mono text-amber-300">{m.upiId}</span>
          ) : (
            <span>
              {m.bankName ?? "Bank"} ·{" "}
              <span className="font-mono text-amber-300">{m.accountNumber}</span>
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">
          Limit: ₹{Number(m.minAmount).toLocaleString("en-IN")} – ₹
          {Number(m.maxAmount).toLocaleString("en-IN")}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onEdit}
          title="Edit"
          className="rounded-lg p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="rounded-lg p-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </PremiumCard>
  );
}

function MethodFormModal({
  editing,
  setEditing,
  onClose,
  onSave,
  saving,
  onQrFile,
}: {
  editing: Partial<PaymentMethod>;
  setEditing: (m: Partial<PaymentMethod>) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  onQrFile: (f: File | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 to-slate-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div>
            <h3 className="text-base font-bold text-white">
              {editing.id ? "Edit method" : "New method"}
            </h3>
            <div className="text-[11px] text-slate-500">
              Visible to users when they choose how to deposit INR.
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.05] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {/* Type selector */}
          <SectionLabel className="mb-2">Method type</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEditing({ ...editing, type: "upi" })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
                editing.type === "upi"
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-200 shadow-[0_0_0_1px_rgba(252,213,53,0.2)]"
                  : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200",
              )}
            >
              <Smartphone className="h-4 w-4" /> UPI
            </button>
            <button
              type="button"
              onClick={() => setEditing({ ...editing, type: "bank" })}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all",
                editing.type === "bank"
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-200 shadow-[0_0_0_1px_rgba(252,213,53,0.2)]"
                  : "border-white/[0.08] bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-slate-200",
              )}
            >
              <Banknote className="h-4 w-4" /> Bank
            </button>
          </div>

          <div className="mt-5 space-y-4">
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
                  <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    <QrCode className="h-3 w-3" /> QR image (PNG/JPG, ≤1.5MB)
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => onQrFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-xs text-slate-400 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-gradient-to-b file:from-yellow-300 file:to-amber-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950"
                  />
                  {editing.qrImageBase64 && (
                    <img
                      src={editing.qrImageBase64}
                      alt="QR preview"
                      className="mt-3 h-32 w-32 rounded-xl border border-white/[0.06] object-contain"
                    />
                  )}
                </div>
              </>
            ) : (
              <>
                <InputField
                  label="Account holder"
                  value={editing.accountHolder ?? ""}
                  onChange={(v) =>
                    setEditing({ ...editing, accountHolder: v })
                  }
                />
                <InputField
                  label="Account number"
                  value={editing.accountNumber ?? ""}
                  onChange={(v) =>
                    setEditing({ ...editing, accountNumber: v })
                  }
                />
                <InputField
                  label="IFSC"
                  value={editing.ifsc ?? ""}
                  onChange={(v) =>
                    setEditing({ ...editing, ifsc: v.toUpperCase() })
                  }
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

            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={editing.isActive ?? true}
                onChange={(e) =>
                  setEditing({ ...editing, isActive: e.target.checked })
                }
                className="h-4 w-4 accent-amber-400"
              />
              <span className="text-slate-200">Active</span>
              <span className="text-[11px] text-slate-500">
                (visible to users)
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <GoldButton
            onClick={onSave}
            disabled={saving || !editing.displayName}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
