import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Loader2, Hand, AlertTriangle } from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { useToast } from "@/hooks/use-toast";

interface InrWithdrawal {
  id: number;
  userId: number;
  amountInr: string;
  amountUsdt: string;
  rateUsed: string;
  payoutMethod: "bank" | "upi";
  upiId: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
  status: string;
  adminNote: string | null;
  payoutReference: string | null;
  reviewedAt: string | null;
  reviewedByKind: string | null;
  assignedMerchantId: number | null;
  escalatedToMerchantAt: string | null;
  escalatedToAdminAt: string | null;
  createdAt: string;
}

const tabs = [
  { key: "pending", label: "Pending / Mine" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
] as const;

export default function MerchantWithdrawalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof tabs)[number]["key"]>("pending");
  const [selected, setSelected] = useState<InrWithdrawal | null>(null);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery<{ withdrawals: InrWithdrawal[] }>({
    queryKey: ["merchant-withdrawals", tab],
    queryFn: () => merchantAuthFetch(merchantApiUrl(`/merchant/inr-withdrawals?status=${tab}`)),
    refetchInterval: tab === "pending" ? 15_000 : false,
  });

  const claim = useMutation({
    mutationFn: async (id: number) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/inr-withdrawals/${id}/claim`), { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-withdrawals"] });
      toast({ title: "Withdrawal claimed — process within 15 min" });
    },
    onError: (e) => toast({ title: "Claim failed", description: String(e), variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async (params: { id: number; payoutReference: string | null; adminNote: string | null }) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/inr-withdrawals/${params.id}/approve`), {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setReference("");
      setNote("");
      toast({ title: "Withdrawal marked paid" });
    },
    onError: (e) => toast({ title: "Approve failed", description: String(e), variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async (params: { id: number; adminNote: string }) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/inr-withdrawals/${params.id}/reject`), {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setNote("");
      toast({ title: "Withdrawal rejected & refunded" });
    },
    onError: (e) => toast({ title: "Reject failed", description: String(e), variant: "destructive" }),
  });

  return (
    <MerchantLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">INR Withdrawals</h1>
        <p className="text-sm text-slate-400 mt-1">Pay out user requests; first to claim owns the case.</p>
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
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : !data?.withdrawals.length ? (
        <div className="text-center text-slate-400 py-16 text-sm">No {tab} withdrawals.</div>
      ) : (
        <div className="space-y-2">
          {data.withdrawals.map((w) => {
            const ageMin = Math.max(0, Math.round((Date.now() - new Date(w.createdAt).getTime()) / 60_000));
            const isClaimed = Boolean(w.assignedMerchantId);
            return (
              <div
                key={w.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-start justify-between gap-3"
              >
                <button
                  onClick={() => {
                    setSelected(w);
                    setReference(w.payoutReference ?? "");
                    setNote("");
                  }}
                  className="text-left flex-1"
                >
                  <div className="text-sm font-medium">
                    ₹{parseFloat(w.amountInr).toFixed(2)}{" "}
                    <span className="text-slate-500 font-normal">
                      ({parseFloat(w.amountUsdt).toFixed(2)} USDT held)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    User #{w.userId} • {w.payoutMethod === "upi" ? `UPI ${w.upiId}` : `${w.bankName ?? ""} A/C ${w.accountNumber ?? ""}`}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {new Date(w.createdAt).toLocaleString()} ({ageMin} min ago)
                  </div>
                </button>
                <div className="flex flex-col items-end gap-2">
                  {tab === "pending" && (
                    <>
                      {!isClaimed ? (
                        <button
                          onClick={() => claim.mutate(w.id)}
                          disabled={claim.isPending}
                          className="flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-medium px-2 py-1 disabled:opacity-50"
                        >
                          <Hand className="h-3 w-3" /> Claim
                        </button>
                      ) : (
                        <span className="text-[10px] uppercase tracking-wide text-amber-300 bg-amber-500/15 px-2 py-1 rounded-full">
                          Mine
                        </span>
                      )}
                      {ageMin >= 10 && (
                        <span className="flex items-center gap-1 rounded-full bg-rose-500/15 text-rose-300 text-[10px] px-2 py-1">
                          <AlertTriangle className="h-3 w-3" /> Escalated
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center px-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Withdrawal #{selected.id}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <Row k="User">#{selected.userId}</Row>
              <Row k="Amount">₹{parseFloat(selected.amountInr).toFixed(2)} ({parseFloat(selected.amountUsdt).toFixed(2)} USDT)</Row>
              <Row k="Method">{selected.payoutMethod.toUpperCase()}</Row>
              {selected.payoutMethod === "upi" ? (
                <Row k="UPI ID">
                  <code className="text-amber-300">{selected.upiId}</code>
                </Row>
              ) : (
                <>
                  <Row k="Account holder">{selected.accountHolder}</Row>
                  <Row k="Account number">
                    <code className="text-amber-300">{selected.accountNumber}</code>
                  </Row>
                  <Row k="IFSC">
                    <code className="text-amber-300">{selected.ifsc}</code>
                  </Row>
                  <Row k="Bank">{selected.bankName}</Row>
                </>
              )}
              <Row k="Submitted">{new Date(selected.createdAt).toLocaleString()}</Row>
            </dl>

            {selected.status === "pending" && (
              <div className="mt-5 space-y-3">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-slate-400 mb-1">
                    Payout reference (UTR / txn id)
                  </label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
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
                <div className="flex justify-end gap-3 pt-2">
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
                    <XCircle className="h-4 w-4" /> Reject & Refund
                  </button>
                  <button
                    onClick={() =>
                      approve.mutate({
                        id: selected.id,
                        payoutReference: reference || null,
                        adminNote: note || null,
                      })
                    }
                    disabled={approve.isPending || reject.isPending}
                    className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="h-4 w-4" /> Mark Paid
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </MerchantLayout>
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
