import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Hand,
  AlertTriangle,
  Inbox,
  ArrowUpCircle,
  X,
} from "lucide-react";
import { MerchantLayout } from "@/components/merchant-layout";
import { merchantApiUrl, merchantAuthFetch } from "@/lib/merchant-auth-fetch";
import { useToast } from "@/hooks/use-toast";
import {
  PageHeader,
  PremiumCard,
  StatusPill,
  SectionLabel,
  GhostButton,
  DangerButton,
  SuccessButton,
  InitialAvatar,
  formatINR,
  formatUSDT,
  timeAgo,
} from "@/components/merchant-ui";
import { cn } from "@/lib/utils";

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
    queryFn: () =>
      merchantAuthFetch(
        merchantApiUrl(`/merchant/inr-withdrawals?status=${tab}`),
      ),
    refetchInterval: tab === "pending" ? 10_000 : false,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const claim = useMutation({
    mutationFn: async (id: number) =>
      merchantAuthFetch(
        merchantApiUrl(`/merchant/inr-withdrawals/${id}/claim`),
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-withdrawals"] });
      toast({ title: "Withdrawal claimed — process within 15 min" });
    },
    onError: (e) =>
      toast({
        title: "Claim failed",
        description: String(e),
        variant: "destructive",
      }),
  });

  const approve = useMutation({
    mutationFn: async (params: {
      id: number;
      payoutReference: string | null;
      adminNote: string | null;
    }) =>
      merchantAuthFetch(
        merchantApiUrl(`/merchant/inr-withdrawals/${params.id}/approve`),
        { method: "POST", body: JSON.stringify(params) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setReference("");
      setNote("");
      toast({ title: "Withdrawal marked paid" });
    },
    onError: (e) =>
      toast({
        title: "Approve failed",
        description: String(e),
        variant: "destructive",
      }),
  });

  const reject = useMutation({
    mutationFn: async (params: { id: number; adminNote: string }) =>
      merchantAuthFetch(
        merchantApiUrl(`/merchant/inr-withdrawals/${params.id}/reject`),
        { method: "POST", body: JSON.stringify(params) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setNote("");
      toast({ title: "Withdrawal rejected & refunded" });
    },
    onError: (e) =>
      toast({
        title: "Reject failed",
        description: String(e),
        variant: "destructive",
      }),
  });

  const count = data?.withdrawals.length ?? 0;

  return (
    <MerchantLayout>
      <PageHeader
        title="INR Withdrawals"
        subtitle="Pay out user requests; first to claim owns the case."
        action={
          <StatusPill variant={tab === "pending" ? "warning" : "neutral"}>
            {count} {tab.split(" ")[0]}
          </StatusPill>
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:flex-initial sm:px-5",
              tab === t.key
                ? "bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 shadow-[0_3px_10px_-2px_rgba(252,213,53,0.4)]"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <PremiumCard className="flex items-center justify-center py-20 text-sm text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading withdrawals…
        </PremiumCard>
      ) : !data?.withdrawals.length ? (
        <PremiumCard className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <Inbox className="h-6 w-6 text-slate-500" />
          </div>
          <div className="mt-4 text-sm font-semibold text-white">
            No {tab} withdrawals
          </div>
          <div className="mt-1 text-xs text-slate-500">
            New payout requests will appear here in real time.
          </div>
        </PremiumCard>
      ) : (
        <PremiumCard className="overflow-hidden">
          <ul className="divide-y divide-white/[0.04]">
            {data.withdrawals.map((w) => (
              <WithdrawalRow
                key={w.id}
                w={w}
                tab={tab}
                claiming={claim.isPending}
                onClaim={() => claim.mutate(w.id)}
                onClick={() => {
                  setSelected(w);
                  setReference(w.payoutReference ?? "");
                  setNote("");
                }}
              />
            ))}
          </ul>
        </PremiumCard>
      )}

      {selected && (
        <WithdrawalDetailModal
          w={selected}
          onClose={() => setSelected(null)}
          reference={reference}
          setReference={setReference}
          note={note}
          setNote={setNote}
          onApprove={() =>
            approve.mutate({
              id: selected.id,
              payoutReference: reference || null,
              adminNote: note || null,
            })
          }
          onReject={() => {
            if (!note.trim()) {
              toast({
                title: "Add a reject reason",
                variant: "destructive",
              });
              return;
            }
            reject.mutate({ id: selected.id, adminNote: note });
          }}
          approving={approve.isPending}
          rejecting={reject.isPending}
        />
      )}
    </MerchantLayout>
  );
}

function WithdrawalRow({
  w,
  tab,
  claiming,
  onClaim,
  onClick,
}: {
  w: InrWithdrawal;
  tab: string;
  claiming: boolean;
  onClaim: () => void;
  onClick: () => void;
}) {
  const ageMin = Math.max(
    0,
    Math.round((Date.now() - new Date(w.createdAt).getTime()) / 60_000),
  );
  const isClaimed = Boolean(w.assignedMerchantId);
  const isOverdue = tab === "pending" && ageMin >= 10;

  return (
    <li className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.025]">
      <InitialAvatar seed={`U${w.userId}`} />
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tabular-nums text-white">
            {formatINR(w.amountInr)}
          </span>
          <span className="text-xs text-slate-500">
            ({formatUSDT(w.amountUsdt)} USDT held)
          </span>
        </div>
        <div className="mt-0.5 truncate text-xs text-slate-400">
          <span className="text-slate-500">User</span>{" "}
          <span className="font-mono text-slate-300">#{w.userId}</span>
          <span className="mx-1.5 text-slate-700">•</span>
          {w.payoutMethod === "upi" ? (
            <>
              <span className="text-slate-500">UPI</span>{" "}
              <span className="font-mono text-slate-300">{w.upiId}</span>
            </>
          ) : (
            <>
              {w.bankName ?? "Bank"}{" "}
              <span className="font-mono text-slate-300">
                A/C {w.accountNumber ?? ""}
              </span>
            </>
          )}
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {tab === "pending" && (
          <>
            {!isClaimed ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClaim();
                }}
                disabled={claiming}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-b from-yellow-300 to-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-[0_3px_10px_-2px_rgba(252,213,53,0.4)] hover:from-yellow-200 hover:to-amber-400 disabled:opacity-50"
              >
                <Hand className="h-3.5 w-3.5" /> Claim
              </button>
            ) : (
              <StatusPill variant="gold">Mine</StatusPill>
            )}
            {isOverdue && (
              <StatusPill variant="danger">
                <AlertTriangle className="mr-0.5 h-3 w-3" /> Escalated
              </StatusPill>
            )}
          </>
        )}
        {tab === "approved" && <StatusPill variant="success">Paid</StatusPill>}
        {tab === "rejected" && (
          <StatusPill variant="danger">Rejected</StatusPill>
        )}
        <span className="text-[10px] text-slate-500">{timeAgo(w.createdAt)}</span>
      </div>
    </li>
  );
}

function WithdrawalDetailModal({
  w,
  onClose,
  reference,
  setReference,
  note,
  setNote,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  w: InrWithdrawal;
  onClose: () => void;
  reference: string;
  setReference: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 to-slate-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
              <ArrowUpCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Withdrawal #{w.id}
              </h3>
              <div className="text-[11px] text-slate-500">
                Submitted {new Date(w.createdAt).toLocaleString()}
              </div>
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
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionLabel>Payout Amount</SectionLabel>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-white">
                {formatINR(w.amountInr)}
              </span>
              <span className="text-sm text-slate-400">
                ({formatUSDT(w.amountUsdt)} USDT held)
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Detail label="User" value={`#${w.userId}`} mono />
            <Detail label="Method" value={w.payoutMethod.toUpperCase()} />
            {w.payoutMethod === "upi" ? (
              <Detail label="UPI ID" value={w.upiId ?? "—"} mono accent />
            ) : (
              <>
                <Detail label="Account holder" value={w.accountHolder ?? "—"} />
                <Detail
                  label="Account number"
                  value={w.accountNumber ?? "—"}
                  mono
                  accent
                />
                <Detail label="IFSC" value={w.ifsc ?? "—"} mono accent />
                <Detail label="Bank" value={w.bankName ?? "—"} />
              </>
            )}
          </div>

          {w.status === "pending" && (
            <div className="mt-5 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <SectionLabel>Mark as Paid</SectionLabel>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Payout reference (UTR / txn id)
                </label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. 412221384793"
                  className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Note <span className="text-slate-600">(optional)</span>
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Reason for reject, or note for approve…"
                  className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          )}
        </div>

        {w.status === "pending" ? (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
            <DangerButton onClick={onReject} disabled={approving || rejecting}>
              <XCircle className="h-4 w-4" /> Reject & Refund
            </DangerButton>
            <SuccessButton onClick={onApprove} disabled={approving || rejecting}>
              {approving && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" /> Mark Paid
            </SuccessButton>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span
        className={cn(
          "text-sm text-slate-200",
          mono && "font-mono",
          accent && "text-amber-300",
        )}
      >
        {value}
      </span>
    </div>
  );
}
