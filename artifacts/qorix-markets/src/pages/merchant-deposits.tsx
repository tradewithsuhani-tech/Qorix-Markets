import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ImageIcon,
  AlertTriangle,
  Inbox,
  ArrowDownCircle,
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
  GoldButton,
  GhostButton,
  DangerButton,
  SuccessButton,
  InitialAvatar,
  formatINR,
  formatUSDT,
  timeAgo,
} from "@/components/merchant-ui";
import { cn } from "@/lib/utils";

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
    queryFn: () =>
      merchantAuthFetch(merchantApiUrl(`/merchant/inr-deposits?status=${tab}`)),
    refetchInterval: tab === "pending" ? 10_000 : false,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const approve = useMutation({
    mutationFn: async (params: {
      id: number;
      amountUsdt?: number;
      adminNote?: string | null;
    }) =>
      merchantAuthFetch(
        merchantApiUrl(`/merchant/inr-deposits/${params.id}/approve`),
        {
          method: "POST",
          body: JSON.stringify({
            amountUsdt: params.amountUsdt,
            adminNote: params.adminNote ?? null,
          }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-deposits"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setOverrideUsdt("");
      setNote("");
      toast({ title: "Deposit approved & USDT credited" });
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
        merchantApiUrl(`/merchant/inr-deposits/${params.id}/reject`),
        {
          method: "POST",
          body: JSON.stringify({ adminNote: params.adminNote }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-deposits"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      setSelected(null);
      setNote("");
      toast({ title: "Deposit rejected" });
    },
    onError: (e) =>
      toast({
        title: "Reject failed",
        description: String(e),
        variant: "destructive",
      }),
  });

  const count = data?.deposits.length ?? 0;

  return (
    <MerchantLayout>
      <PageHeader
        title="INR Deposits"
        subtitle="User deposits posted to the methods you own."
        action={
          <StatusPill variant={tab === "pending" ? "warning" : "neutral"}>
            {count} {tab}
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
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading deposits…
        </PremiumCard>
      ) : !data?.deposits.length ? (
        <EmptyState tab={tab} />
      ) : (
        <PremiumCard className="overflow-hidden">
          <ul className="divide-y divide-white/[0.04]">
            {data.deposits.map((d) => (
              <DepositRow
                key={d.id}
                d={d}
                tab={tab}
                onClick={() => {
                  setSelected(d);
                  setOverrideUsdt("");
                  setNote("");
                }}
              />
            ))}
          </ul>
        </PremiumCard>
      )}

      {selected && (
        <DepositDetailModal
          d={selected}
          onClose={() => setSelected(null)}
          overrideUsdt={overrideUsdt}
          setOverrideUsdt={setOverrideUsdt}
          note={note}
          setNote={setNote}
          onApprove={() => {
            const v = overrideUsdt ? Number(overrideUsdt) : undefined;
            if (overrideUsdt && (!Number.isFinite(v) || (v ?? 0) <= 0)) {
              toast({ title: "Bad USDT override", variant: "destructive" });
              return;
            }
            approve.mutate({
              id: selected.id,
              amountUsdt: v,
              adminNote: note || null,
            });
          }}
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

function DepositRow({
  d,
  tab,
  onClick,
}: {
  d: MerchantInrDeposit;
  tab: string;
  onClick: () => void;
}) {
  const ageMin = Math.max(
    0,
    Math.round((Date.now() - new Date(d.createdAt).getTime()) / 60_000),
  );
  const isOverdue = tab === "pending" && ageMin >= 10;

  return (
    <li>
      <button
        onClick={onClick}
        className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.025]"
      >
        <InitialAvatar seed={`U${d.userId}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold tabular-nums text-white">
              {formatINR(d.amountInr)}
            </span>
            <span className="text-xs text-slate-500">
              → {formatUSDT(d.amountUsdt)} USDT
            </span>
          </div>
          <div className="mt-0.5 truncate text-xs text-slate-400">
            <span className="text-slate-500">User</span>{" "}
            <span className="font-mono text-slate-300">#{d.userId}</span>
            <span className="mx-1.5 text-slate-700">•</span>
            <span className="text-slate-500">via</span>{" "}
            {d.methodDisplayName}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500">
            UTR <span className="font-mono text-slate-400">{d.utr}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {d.status === "pending" && (
            <StatusPill variant="warning" pulse>
              Pending
            </StatusPill>
          )}
          {d.status === "approved" && (
            <StatusPill variant="success">Approved</StatusPill>
          )}
          {d.status === "rejected" && (
            <StatusPill variant="danger">Rejected</StatusPill>
          )}
          {isOverdue && (
            <StatusPill variant="danger">
              <AlertTriangle className="mr-0.5 h-3 w-3" /> Escalated
            </StatusPill>
          )}
          <span className="text-[10px] text-slate-500">{timeAgo(d.createdAt)}</span>
        </div>
      </button>
    </li>
  );
}

function EmptyState({ tab }: { tab: string }) {
  return (
    <PremiumCard className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <Inbox className="h-6 w-6 text-slate-500" />
      </div>
      <div className="mt-4 text-sm font-semibold text-white">
        No {tab} deposits
      </div>
      <div className="mt-1 text-xs text-slate-500">
        New requests will appear here in real time.
      </div>
    </PremiumCard>
  );
}

function DepositDetailModal({
  d,
  onClose,
  overrideUsdt,
  setOverrideUsdt,
  note,
  setNote,
  onApprove,
  onReject,
  approving,
  rejecting,
}: {
  d: MerchantInrDeposit;
  onClose: () => void;
  overrideUsdt: string;
  setOverrideUsdt: (v: string) => void;
  note: string;
  setNote: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
  rejecting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900 to-slate-950 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Deposit #{d.id}
              </h3>
              <div className="text-[11px] text-slate-500">
                Submitted {new Date(d.createdAt).toLocaleString()}
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
          {/* Hero amounts */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <SectionLabel>Amount</SectionLabel>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-white">
                {formatINR(d.amountInr)}
              </span>
              <span className="text-sm text-slate-400">
                → {formatUSDT(d.amountUsdt)} USDT
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Rate used: ₹{parseFloat(d.rateUsed).toFixed(2)} per USDT
            </div>
          </div>

          {/* Details grid */}
          <dl className="mt-4 grid grid-cols-2 gap-3">
            <DetailItem label="User" value={`#${d.userId}`} mono />
            <DetailItem
              label="Method"
              value={`${d.methodDisplayName} · ${d.methodType.toUpperCase()}`}
            />
            <DetailItem
              label="UTR / Reference"
              value={d.utr}
              mono
              fullWidth
              accent
            />
          </dl>

          {/* Proof */}
          <div className="mt-4">
            <SectionLabel>Proof of Payment</SectionLabel>
            {d.proofImageBase64 ? (
              <img
                src={d.proofImageBase64}
                alt="proof"
                className="mt-2 max-h-72 rounded-xl border border-white/[0.06] object-contain"
              />
            ) : (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-6 text-xs text-slate-500">
                <ImageIcon className="h-4 w-4" /> No proof image attached
              </div>
            )}
          </div>

          {/* Action form */}
          {d.status === "pending" && (
            <div className="mt-5 space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <SectionLabel>Action</SectionLabel>
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Override USDT amount{" "}
                  <span className="text-slate-600">(optional)</span>
                </label>
                <input
                  value={overrideUsdt}
                  onChange={(e) => setOverrideUsdt(e.target.value)}
                  placeholder={parseFloat(d.amountUsdt).toFixed(2)}
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
                  placeholder="Reason for reject, or audit note for approve…"
                  className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          )}

          {d.status !== "pending" && (
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400">
              Reviewed{" "}
              {d.reviewedAt
                ? new Date(d.reviewedAt).toLocaleString()
                : "—"}{" "}
              by <span className="text-slate-200">{d.reviewedByKind ?? "admin"}</span>.
              {d.adminNote && (
                <div className="mt-1.5 text-slate-300">Note: {d.adminNote}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {d.status === "pending" && (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
            <DangerButton
              onClick={onReject}
              disabled={approving || rejecting}
            >
              <XCircle className="h-4 w-4" /> Reject
            </DangerButton>
            <SuccessButton
              onClick={onApprove}
              disabled={approving || rejecting}
            >
              {approving && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" /> Approve & Credit
            </SuccessButton>
          </div>
        )}
        {d.status !== "pending" && (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
            <GhostButton onClick={onClose}>Close</GhostButton>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono,
  accent,
  fullWidth,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-white/[0.02] p-3",
        fullWidth && "col-span-2",
      )}
    >
      <SectionLabel>{label}</SectionLabel>
      <div
        className={cn(
          "mt-1 break-all text-sm text-slate-200",
          mono && "font-mono",
          accent && "text-amber-300",
        )}
      >
        {value}
      </div>
    </div>
  );
}

