import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownCircle,
  CheckCircle2,
  Eye,
  Loader2,
  X,
  XCircle,
  ChevronUp,
  ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
} from "@/lib/merchant-auth-fetch";
import { cn } from "@/lib/utils";

interface PendingDeposit {
  id: number;
  userId: number;
  paymentMethodId: number;
  amountInr: string;
  amountUsdt: string;
  rateUsed: string;
  utr: string;
  proofImageBase64: string | null;
  status: string;
  createdAt: string;
  methodDisplayName: string;
  methodType: "bank" | "upi";
}

interface ListResponse {
  deposits: PendingDeposit[];
}

function parseDepositRef(raw: string): {
  utr: string;
  senderName: string;
  methodLabel: string;
} {
  const parts = (raw ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  let utr = "";
  let senderName = "";
  let methodLabel = "";
  for (const p of parts) {
    if (/^QM-/i.test(p)) methodLabel = p;
    else if (/^\d{8,}$/.test(p) && !utr) utr = p;
    else senderName = senderName ? senderName + " " + p : p;
  }
  return { utr, senderName, methodLabel };
}

function formatINR(s: string): string {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return "₹0.00";
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatUSDT(s: string): string {
  const n = parseFloat(s);
  return "$" + (Number.isFinite(n) ? n.toFixed(2) : "0.00") + " USDT";
}

function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // best-effort; some browsers block audio without a gesture
  }
}

export function MerchantDepositNotifier() {
  const qc = useQueryClient();
  const { toast } = useToast();

  // null = haven't done initial snapshot yet
  // Set  = ids that were already pending when this tab loaded
  // We only popup for ids that arrive AFTER the initial snapshot.
  const seenIdsRef = useRef<Set<number> | null>(null);
  const dismissedIdsRef = useRef<Set<number>>(new Set());
  const [popup, setPopup] = useState<PendingDeposit | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overrideUsdt, setOverrideUsdt] = useState("");
  const [note, setNote] = useState("");
  const [zoomed, setZoomed] = useState(false);

  const tokenPresent = Boolean(getMerchantToken());

  const { data } = useQuery<ListResponse>({
    queryKey: ["merchant-pending-notify"],
    queryFn: () =>
      merchantAuthFetch<ListResponse>(
        merchantApiUrl("/merchant/inr-deposits?status=pending"),
      ),
    enabled: tokenPresent,
    refetchInterval: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });

  // Keep popup data fresh; if the popped deposit gets resolved elsewhere, close.
  useEffect(() => {
    if (!data?.deposits) return;
    const currentIds = new Set(data.deposits.map((d) => d.id));

    // First successful response → snapshot only, do NOT popup.
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return;
    }

    // If currently shown popup got approved/rejected elsewhere → dismiss
    if (popup && !currentIds.has(popup.id)) {
      setPopup(null);
      setExpanded(false);
      setOverrideUsdt("");
      setNote("");
      seenIdsRef.current = currentIds;
      return;
    }

    // Refresh popup record so proof image / latest fields stay in sync
    if (popup) {
      const latest = data.deposits.find((d) => d.id === popup.id);
      if (latest && latest !== popup) setPopup(latest);
    }

    // Find the freshest deposit that's brand new and not yet dismissed.
    const fresh = data.deposits.find(
      (d) =>
        !seenIdsRef.current!.has(d.id) && !dismissedIdsRef.current.has(d.id),
    );

    if (fresh && !popup) {
      setPopup(fresh);
      setExpanded(false);
      setOverrideUsdt("");
      setNote("");
      playChime();
    }

    seenIdsRef.current = currentIds;
  }, [data, popup]);

  function dismiss() {
    if (popup) dismissedIdsRef.current.add(popup.id);
    setPopup(null);
    setExpanded(false);
    setOverrideUsdt("");
    setNote("");
    setZoomed(false);
  }

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
      qc.invalidateQueries({ queryKey: ["merchant-pending-notify"] });
      toast({
        title: "Deposit approved",
        description: "USDT credited to user wallet.",
      });
      dismiss();
    },
    onError: (e) =>
      toast({
        title: "Approve failed",
        description: e instanceof Error ? e.message : String(e),
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
      qc.invalidateQueries({ queryKey: ["merchant-pending-notify"] });
      toast({
        title: "Deposit rejected",
        description: "User has been notified.",
      });
      dismiss();
    },
    onError: (e) =>
      toast({
        title: "Reject failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  if (!popup) return null;

  const { utr, senderName, methodLabel } = parseDepositRef(popup.utr);
  // Always show payer name in uppercase — matches bank statements & makes
  // verification against the actual UPI/bank receipt easier for the merchant.
  const displayName = (senderName || `User #${popup.userId}`).toUpperCase();
  const ageMin = Math.max(
    0,
    Math.round((Date.now() - new Date(popup.createdAt).getTime()) / 60_000),
  );
  const busy = approve.isPending || reject.isPending;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-md px-4 py-6"
      onClick={() => !busy && dismiss()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-slate-900 to-slate-950",
          "shadow-[0_30px_80px_-20px_rgba(252,213,53,0.25),0_0_0_1px_rgba(252,213,53,0.08)]",
          expanded ? "max-w-xl" : "max-w-md",
          "transition-[max-width] duration-300 ease-out",
        )}
      >
        {/* Gold ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl"
        />

        {/* Header */}
        <div className="relative flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300">
              <ArrowDownCircle className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {expanded ? `Deposit #${popup.id}` : "New Payment Request"}
              </h3>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {expanded
                  ? `Submitted ${new Date(popup.createdAt).toLocaleString()}`
                  : `Pending · ${ageMin}m ago · on your ${popup.methodDisplayName}`}
              </div>
            </div>
          </div>
          <button
            onClick={dismiss}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[68vh] overflow-y-auto">
          {!expanded ? (
            // ───── Compact view ─────
            <div className="space-y-4 px-6 py-5">
              <p className="text-xs text-slate-400 leading-relaxed -mt-1">
                A user just submitted a deposit on your method. Verify it in
                your bank/UPI app, then take action below.
              </p>

              {/* From */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  From
                </div>
                <div className="text-2xl font-bold text-white leading-tight mt-1">
                  {displayName}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  User ID #{popup.userId}
                </div>
              </div>

              {/* UTR + Amount */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.05]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    UTR No
                  </div>
                  <div className="text-sm font-mono text-slate-100 break-all mt-1">
                    {utr || (
                      <span className="text-slate-500 italic font-sans">
                        not provided
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Amount
                  </div>
                  <div className="text-xl font-bold text-amber-300 tabular-nums mt-1">
                    {formatINR(popup.amountInr)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    → {formatUSDT(popup.amountUsdt)}
                  </div>
                </div>
              </div>

              {/* Method */}
              <div className="pt-4 border-t border-white/[0.05]">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Method
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {popup.methodDisplayName}
                  {methodLabel ? ` · ${methodLabel}` : ""}
                  {popup.methodType
                    ? ` · ${popup.methodType.toUpperCase()}`
                    : ""}
                </div>
              </div>
            </div>
          ) : (
            // ───── Expanded view ─────
            <div className="space-y-4 px-6 py-5">
              {/* Hero amount */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Amount
                </div>
                <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-bold tabular-nums text-white">
                    {formatINR(popup.amountInr)}
                  </span>
                  <span className="text-sm text-slate-400">
                    → {formatUSDT(popup.amountUsdt)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Rate used: ₹{parseFloat(popup.rateUsed).toFixed(2)} per USDT
                </div>
              </div>

              {/* User + Method grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    User
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white truncate">
                    {displayName}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    #{popup.userId}
                  </div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Method
                  </div>
                  <div className="mt-1 text-sm text-slate-200 truncate">
                    {popup.methodDisplayName}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {popup.methodType?.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* UTR */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  UTR / Reference
                </div>
                <div className="mt-1 break-all font-mono text-sm text-amber-300">
                  {popup.utr}
                </div>
              </div>

              {/* Proof */}
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1.5">
                  Proof of Payment
                </div>
                {popup.proofImageBase64 ? (
                  <button
                    type="button"
                    onClick={() => setZoomed(true)}
                    className="group block w-full rounded-xl border border-white/[0.06] overflow-hidden bg-black/40 hover:border-amber-500/40 transition-colors"
                  >
                    <img
                      src={popup.proofImageBase64}
                      alt="Payment proof"
                      className="max-h-72 w-full object-contain"
                    />
                    <div className="px-3 py-1.5 bg-black/40 text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 group-hover:text-amber-300 transition-colors">
                      <Eye className="h-3 w-3" /> Tap to zoom
                    </div>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] px-4 py-6 text-xs text-slate-500">
                    <ImageIcon className="h-4 w-4" /> No proof image attached
                  </div>
                )}
              </div>

              {/* Action form */}
              <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Action
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Override USDT amount{" "}
                    <span className="text-slate-600">(optional)</span>
                  </label>
                  <input
                    value={overrideUsdt}
                    onChange={(e) => setOverrideUsdt(e.target.value)}
                    placeholder={parseFloat(popup.amountUsdt).toFixed(2)}
                    className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Note{" "}
                    <span className="text-slate-600">
                      (optional for approve, required for reject)
                    </span>
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for reject, or audit note for approve…"
                    className="w-full rounded-lg border border-white/[0.08] bg-slate-950/50 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!expanded ? (
          <div className="flex items-center gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
            <button
              onClick={() => setExpanded(true)}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
            >
              <Eye className="h-4 w-4" /> View Details
            </button>
            <button
              onClick={() => approve.mutate({ id: popup.id })}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_4px_14px_-2px_rgba(16,185,129,0.4)] hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-50 transition-all"
            >
              {approve.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {approve.isPending ? "Approving…" : "Approve"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
            <button
              onClick={() => setExpanded(false)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs font-semibold text-slate-300 hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
              title="Collapse"
            >
              <ChevronUp className="h-4 w-4" />
              <span className="hidden sm:inline">Less</span>
            </button>
            <div className="flex-1" />
            <button
              onClick={() => {
                if (!note.trim()) {
                  toast({
                    title: "Add a reject reason",
                    description: "Use the Note field above.",
                    variant: "destructive",
                  });
                  return;
                }
                reject.mutate({ id: popup.id, adminNote: note });
              }}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 hover:border-rose-500/60 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
            >
              {reject.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Reject
            </button>
            <button
              onClick={() => {
                const v = overrideUsdt ? Number(overrideUsdt) : undefined;
                if (overrideUsdt && (!Number.isFinite(v) || (v ?? 0) <= 0)) {
                  toast({
                    title: "Bad USDT override",
                    variant: "destructive",
                  });
                  return;
                }
                approve.mutate({
                  id: popup.id,
                  amountUsdt: v,
                  adminNote: note || null,
                });
              }}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_4px_14px_-2px_rgba(16,185,129,0.4)] hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-50 transition-all"
            >
              {approve.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve & Credit
            </button>
          </div>
        )}
      </div>

      {/* Zoomed proof image overlay */}
      {zoomed && popup.proofImageBase64 && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/92 px-4 py-6"
          onClick={(e) => {
            e.stopPropagation();
            setZoomed(false);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(false);
            }}
            className="fixed top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur p-2 text-white transition-colors"
            aria-label="Close zoom"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={popup.proofImageBase64}
            alt="Payment proof zoomed"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-[0_30px_80px_-10px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
