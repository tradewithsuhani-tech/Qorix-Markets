import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckCircle2, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getMerchantToken,
  merchantApiUrl,
  merchantAuthFetch,
} from "@/lib/merchant-auth-fetch";

interface PendingDeposit {
  id: number;
  userId: number;
  amountInr: string;
  amountUsdt: string;
  utr: string;
  status: string;
  createdAt: string;
  methodDisplayName: string;
  methodType: string;
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
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  // null = haven't done initial snapshot yet
  // Set  = ids that were already pending when this tab loaded
  // We only popup for ids that arrive AFTER the initial snapshot.
  const seenIdsRef = useRef<Set<number> | null>(null);
  const dismissedIdsRef = useRef<Set<number>>(new Set());
  const [popup, setPopup] = useState<PendingDeposit | null>(null);

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

  useEffect(() => {
    if (!data?.deposits) return;
    const currentIds = new Set(data.deposits.map((d) => d.id));

    // First successful response → snapshot only, do NOT popup.
    if (seenIdsRef.current === null) {
      seenIdsRef.current = currentIds;
      return;
    }

    // Find the freshest deposit that's brand new and not yet dismissed.
    const fresh = data.deposits.find(
      (d) =>
        !seenIdsRef.current!.has(d.id) && !dismissedIdsRef.current.has(d.id),
    );

    if (fresh && !popup) {
      setPopup(fresh);
      playChime();
    }

    seenIdsRef.current = currentIds;
  }, [data, popup]);

  const approve = useMutation({
    mutationFn: async (id: number) =>
      merchantAuthFetch(merchantApiUrl(`/merchant/inr-deposits/${id}/approve`), {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-deposits"] });
      qc.invalidateQueries({ queryKey: ["merchant-dashboard"] });
      qc.invalidateQueries({ queryKey: ["merchant-pending-notify"] });
      toast({
        title: "Deposit approved",
        description: "USDT credited to user wallet.",
      });
      if (popup) dismissedIdsRef.current.add(popup.id);
      setPopup(null);
    },
    onError: (e) =>
      toast({
        title: "Approve failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  if (!popup) return null;

  const { utr, senderName, methodLabel } = parseDepositRef(popup.utr);
  const displayName = senderName || `User #${popup.userId}`;

  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open && !approve.isPending) {
          dismissedIdsRef.current.add(popup.id);
          setPopup(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md border-amber-500/40 bg-slate-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-300">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            New Payment Request
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            A user has submitted a deposit on your method. Verify it in your
            bank/UPI app, then take action.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">
              From
            </div>
            <div className="text-2xl font-bold text-white leading-tight">
              {displayName}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              User ID #{popup.userId}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                UTR No
              </div>
              <div className="text-sm font-mono text-slate-100 break-all">
                {utr || (
                  <span className="text-slate-500 italic font-sans">
                    not provided
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Amount
              </div>
              <div className="text-base font-semibold text-amber-300">
                {formatINR(popup.amountInr)}
              </div>
              <div className="text-[10px] text-slate-500">
                → {formatUSDT(popup.amountUsdt)}
              </div>
            </div>
          </div>

          {(methodLabel || popup.methodDisplayName) && (
            <div className="pt-3 border-t border-slate-800">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Method
              </div>
              <div className="text-xs text-slate-300">
                {popup.methodDisplayName}
                {methodLabel ? ` · ${methodLabel}` : ""}
                {popup.methodType
                  ? ` · ${popup.methodType.toUpperCase()}`
                  : ""}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={approve.isPending}
            onClick={() => {
              dismissedIdsRef.current.add(popup.id);
              setPopup(null);
              navigate("/merchant/deposits");
            }}
          >
            <Eye className="h-4 w-4 mr-2" /> View
          </Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => approve.mutate(popup.id)}
            disabled={approve.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {approve.isPending ? "Approving…" : "Approve"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
