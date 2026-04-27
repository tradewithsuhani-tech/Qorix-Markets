import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, ImageIcon, AlertTriangle } from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { useToast } from "@/hooks/use-toast";

interface MerchantInrDeposit {
  id: number;
  userId: number;
  paymentMethodId: number;
  amountInr: string;
  amountUsdt: string;
  rateUsed: string;
  utr: string;
  proofImageBase64: string | null;
  status: "pending" | "approved" | "rejected";
  adminNote: string | null;
  reviewedAt: string | null;
  reviewedByKind: string | null;
  escalatedToMerchantAt: string | null;
  escalatedToAdminAt: string | null;
  createdAt: string;
  methodDisplayName: string;
  methodType: "bank" | "upi";
}

const tabs = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export default function MerchantDepositsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("pending");
  const [selected, setSelected] = useState<MerchantInrDeposit | null>(null);
  const [overrideUsdt, setOverrideUsdt] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery<{ deposits: MerchantInrDeposit[] }>({
    queryKey: ["merchant-deposits", tab],
    queryFn: () => merchantAuthFetch(merchantApiUrl(`/merchant/inr-deposits?status=${tab}`)),
    refetchInterval: tab === "pending" ? 15_000 : false,
  });

  const approve = useMutation({
    mutationFn: async (params: { id: number; amountUsdt?: number; adminNote?: string | null }) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/inr-deposits/${params.id}/approve`), {
        method: "POST",
        body: JSON.stringify({
          amountUsdt: params.amountUsdt,
          adminNote: params.adminNote ?? null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-deposits"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setOverrideUsdt("");
      setNote("");
      toast({ title: "Deposit approved & USDT credited" });
    },
    onError: (e) => toast({ title: "Approve failed", description: String(e), variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async (params: { id: number; adminNote: string }) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/inr-deposits/${params.id}/reject`), {
        method: "POST",
        body: JSON.stringify({ adminNote: params.adminNote }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-deposits"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setNote("");
      toast({ title: "Deposit rejected" });
    },
    onError: (e) => toast({ title: "Reject failed", description: String(e), variant: "destructive" }),
  });

  return (
    <MerchantLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">INR Deposits</h1>
        <p className="text-sm text-slate-400 mt-1">User deposits posted to the methods you own.</p>
      </div>

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-xs rounded-full ${
              tab === t.key
                ? "bg-amber-500 text-slate-950"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Centered>
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </Centered>
      ) : !data?.deposits.length ? (
        <Centered>No {tab} deposits.</Centered>
      ) : (
        <div className="space-y-2">
          {data.deposits.map((d) => {
            const ageMin = Math.max(0, Math.round((Date.now() - new Date(d.createdAt).getTime()) / 60_000));
            return (
              <button
                key={d.id}
                onClick={() => {
                  setSelected(d);
                  setOverrideUsdt("");
                  setNote("");
                }}
                className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/60 p-4 hover:border-amber-500/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      ₹{parseFloat(d.amountInr).toFixed(2)}{" "}
                      <span className="text-slate-500 font-normal">→ ${parseFloat(d.amountUsdt).toFixed(2)} USDT</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      User #{d.userId} • UTR {d.utr} • via {d.methodDisplayName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(d.createdAt).toLocaleString()} ({ageMin} min ago)
                    </div>
                  </div>
                  {tab === "pending" && ageMin >= 10 && (
                    <span className="flex items-center gap-1 rounded-full bg-rose-500/15 text-rose-300 text-[10px] px-2 py-1">
                      <AlertTriangle className="h-3 w-3" /> Escalated
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Deposit #{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <Row k="User">#{selected.userId}</Row>
              <Row k="Method">
                {selected.methodDisplayName} ({selected.methodType.toUpperCase()})
              </Row>
              <Row k="Amount (INR)">₹{parseFloat(selected.amountInr).toFixed(2)}</Row>
              <Row k="USDT to credit (proposed)">${parseFloat(selected.amountUsdt).toFixed(2)}</Row>
              <Row k="Rate used">₹{parseFloat(selected.rateUsed).toFixed(2)} / USDT</Row>
              <Row k="UTR / Reference">
                <code className="text-amber-300">{selected.utr}</code>
              </Row>
              <Row k="Submitted">{new Date(selected.createdAt).toLocaleString()}</Row>
              {selected.proofImageBase64 ? (
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400 mt-3 mb-1">Proof</div>
                  <img
                    src={selected.proofImageBase64}
                    alt="proof"
                    className="max-h-72 rounded border border-slate-700"
                  />
                </div>
              ) : (
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> No proof image attached
                </div>
              )}
            </dl>

            {selected.status === "pending" && (
              <div className="mt-5 space-y-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Override USDT amount (optional)
                  </label>
                  <input
                    value={overrideUsdt}
                    onChange={(e) => setOverrideUsdt(e.target.value)}
                    placeholder={parseFloat(selected.amountUsdt).toFixed(2)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Note (optional)
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => {
                      if (!note.trim()) {
                        toast({ title: "Add a reject reason", variant: "destructive" });
                        return;
                      }
                      reject.mutate({ id: selected.id, adminNote: note });
                    }}
                    disabled={reject.isPending || approve.isPending}
                    className="rounded-lg border border-rose-500/40 text-rose-300 px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                  <button
                    onClick={() => {
                      const v = overrideUsdt ? Number(overrideUsdt) : undefined;
                      if (overrideUsdt && (!Number.isFinite(v) || (v ?? 0) <= 0)) {
                        toast({ title: "Bad USDT override", variant: "destructive" });
                        return;
                      }
                      approve.mutate({ id: selected.id, amountUsdt: v, adminNote: note || null });
                    }}
                    disabled={approve.isPending || reject.isPending}
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4" /> Approve & Credit
                  </button>
                </div>
              </div>
            )}

            {selected.status !== "pending" && (
              <div className="mt-5 text-xs text-slate-400">
                Reviewed {selected.reviewedAt ? new Date(selected.reviewedAt).toLocaleString() : ""}{" "}
                by {selected.reviewedByKind ?? "admin"}.
                {selected.adminNote && <div className="mt-1">Note: {selected.adminNote}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </MerchantLayout>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm">{children}</div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400 text-xs uppercase tracking-wide">{k}</dt>
      <dd className="text-slate-100 text-right">{children}</dd>
    </div>
  );
}
