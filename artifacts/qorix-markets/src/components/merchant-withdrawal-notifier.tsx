import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpCircle, Hand, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
} from "@/lib/merchant-auth-fetch";
import { formatINR, formatUSDT } from "@/components/merchant-ui";
import { cn } from "@/lib/utils";

interface PendingWithdrawal {
  id: number;
  userId: number;
  amountInr: string;
  amountUsdt: string;
  payoutMethod: "bank" | "upi";
  upiId: string | null;
  accountHolder: string | null;
  accountNumber: string | null;
  ifsc: string | null;
  bankName: string | null;
  status: string;
  assignedMerchantId: number | null;
  createdAt: string;
}

interface ListResponse {
  withdrawals: PendingWithdrawal[];
}

function playWithdrawalChime() {
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
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.setValueAtTime(990, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // best-effort; some browsers block audio without a gesture
  }
}

export function MerchantWithdrawalNotifier() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const seenIdsRef = useRef<Set<number> | null>(null);
  const dismissedIdsRef = useRef<Set<number>>(new Set());
  const [popup, setPopup] = useState<PendingWithdrawal | null>(null);

  const tokenPresent = Boolean(getMerchantToken());

  const { data } = useQuery<ListResponse>({
    queryKey: ["merchant-pending-withdrawals-notify"],
    queryFn: () =>
      merchantAuthFetch<ListResponse>(
        merchantApiUrl("/merchant/inr-withdrawals?status=pending"),
      ),
    enabled: tokenPresent,
    refetchInterval: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!data?.withdrawals) return;

    const unclaimed = data.withdrawals.filter(
      (w) => w.assignedMerchantId === null,
    );
    const currentIds = new Set(unclaimed.map((w) => w.id));

    // Build the next "seen" set such that:
    //   - ids that disappeared from current (claimed/processed) are dropped
    //   - ids that were already seen stay seen
    //   - brand-new ids are NOT auto-marked seen — they remain eligible to
    //     pop on a future tick (so a burst of 5 withdrawals all get a popup,
    //     not just the first one)
    function nextSeenFrom(prior: Set<number>, popJustShownId?: number) {
      const next = new Set<number>();
      for (const id of currentIds) {
        if (prior.has(id)) next.add(id);
      }
      if (popJustShownId !== undefined) next.add(popJustShownId);
      return next;
    }

    // First successful response → snapshot everything currently pending so we
    // don't flood the merchant with backlog popups on tab open.
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return;
    }

    // If currently shown popup got claimed by someone else → silently dismiss
    // and re-evaluate (without losing track of other unseen items).
    if (popup && !currentIds.has(popup.id)) {
      setPopup(null);
      seenIdsRef.current = nextSeenFrom(seenIdsRef.current);
      return;
    }

    // Refresh popup record so latest fields stay in sync.
    if (popup) {
      const latest = unclaimed.find((w) => w.id === popup.id);
      if (latest && latest !== popup) setPopup(latest);
    }

    // Find the freshest unclaimed withdrawal that's brand new and not dismissed.
    const fresh = unclaimed.find(
      (w) =>
        !seenIdsRef.current!.has(w.id) && !dismissedIdsRef.current.has(w.id),
    );

    if (fresh && !popup) {
      setPopup(fresh);
      playWithdrawalChime();
      seenIdsRef.current = nextSeenFrom(seenIdsRef.current, fresh.id);
    } else {
      // Either nothing fresh, or popup already shown. Either way, do NOT
      // auto-mark unseen ids as seen — let them pop on a later tick.
      seenIdsRef.current = nextSeenFrom(seenIdsRef.current);
    }
  }, [data, popup]);

  function dismiss() {
    if (popup) dismissedIdsRef.current.add(popup.id);
    setPopup(null);
  }

  const claim = useMutation({
    mutationFn: async (id: number) =>
      merchantAuthFetch(
        merchantApiUrl(`/merchant/inr-withdrawals/${id}/claim`),
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      qc.invalidateQueries({
        queryKey: ["merchant-pending-withdrawals-notify"],
      });
      toast({
        title: "Withdrawal claimed",
        description: "Process within 15 min on the Withdrawals page.",
      });
      dismiss();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      // Backend returns 409 with body "Withdrawal already claimed by another
      // merchant" when we lose the race. That's an expected outcome of the
      // first-claim-wins broadcast, NOT an error — show a calmer toast and
      // close the now-stale popup so the merchant can move on.
      const isLostRace = /already claimed/i.test(msg);
      toast({
        title: isLostRace ? "Already claimed" : "Claim failed",
        description: isLostRace
          ? "Another merchant claimed this withdrawal first."
          : msg,
        variant: isLostRace ? "default" : "destructive",
      });
      if (isLostRace) {
        qc.invalidateQueries({
          queryKey: ["merchant-pending-withdrawals-notify"],
        });
        dismiss();
      }
    },
  });

  if (!popup) return null;

  const busy = claim.isPending;
  const submittedTs = new Date(popup.createdAt).toLocaleString();
  const methodLabel = popup.payoutMethod === "upi" ? "UPI" : "Bank";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-md px-4 py-6"
      onClick={() => !busy && dismiss()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-md overflow-hidden rounded-2xl border border-rose-500/40 bg-gradient-to-br from-slate-900 to-slate-950",
          "shadow-[0_30px_80px_-20px_rgba(244,63,94,0.25),0_0_0_1px_rgba(244,63,94,0.08)]",
        )}
      >
        {/* Rose ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-rose-500/15 blur-3xl"
        />

        {/* Header */}
        <div className="relative flex items-start justify-between border-b border-white/[0.06] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300">
              <ArrowUpCircle className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Withdrawal #{popup.id}
              </h3>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Submitted {submittedTs}
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
        <div className="space-y-3 px-6 py-5">
          {/* Payout Amount hero */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Payout Amount
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold tabular-nums text-white">
                {formatINR(popup.amountInr)}
              </span>
              <span className="text-xs text-slate-400">
                ({formatUSDT(popup.amountUsdt)} USDT held)
              </span>
            </div>
          </div>

          {/* User */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              User
            </div>
            <div className="text-sm font-mono font-semibold text-white">
              #{popup.userId}
            </div>
          </div>

          {/* Method */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Method
            </div>
            <div className="text-sm font-semibold text-white">
              {methodLabel}
            </div>
          </div>

          {/* Payout target — UPI ID or Bank A/C details */}
          {popup.payoutMethod === "upi" ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 shrink-0">
                UPI ID
              </div>
              <div className="text-sm font-mono text-amber-300 break-all text-right">
                {popup.upiId ?? "—"}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 shrink-0">
                  A/C No
                </div>
                <div className="text-sm font-mono text-amber-300 break-all text-right">
                  {popup.accountNumber ?? "—"}
                </div>
              </div>
              {popup.ifsc && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 shrink-0">
                    IFSC
                  </div>
                  <div className="text-sm font-mono text-slate-200 break-all text-right">
                    {popup.ifsc}
                  </div>
                </div>
              )}
              {popup.accountHolder && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 shrink-0">
                    Holder
                  </div>
                  <div className="text-sm text-slate-200 break-all text-right">
                    {popup.accountHolder}
                  </div>
                </div>
              )}
              {popup.bankName && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 shrink-0">
                    Bank
                  </div>
                  <div className="text-sm text-slate-200 break-all text-right">
                    {popup.bankName}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-white/[0.06] bg-slate-950/50 px-6 py-4">
          <button
            onClick={dismiss}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-white/20 hover:bg-white/[0.05] disabled:opacity-50 transition-colors"
          >
            Close
          </button>
          <div className="flex-1" />
          <button
            onClick={() => claim.mutate(popup.id)}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-b from-rose-400 to-rose-600 shadow-[0_4px_14px_-2px_rgba(244,63,94,0.4)] hover:from-rose-300 hover:to-rose-500 disabled:opacity-50 transition-all"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Hand className="h-4 w-4" />
            )}
            {busy ? "Claiming…" : "Claim"}
          </button>
        </div>
      </div>
    </div>
  );
}
