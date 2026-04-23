import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Copy, Check, ArrowRight, Sparkles, BadgePercent, Timer, X } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface OfferResponse {
  alreadyRedeemed: boolean;
  redemption: {
    code: string;
    status: "redeemed" | "credited";
    bonusPercent: number;
    bonusAmount: number | null;
    redeemedAt: string | null;
    creditedAt: string | null;
  } | null;
  active: boolean;
  code: string;
  bonusPercent: number;
  windowStart: number;
  expiresAt: number;   // ms epoch — offer redemption cutoff
  nextOfferAt: number; // ms epoch — next new offer window
  serverTime: number;  // for clock-skew correction
}

function formatMs(ms: number): string {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Rotating 5–10% deposit-bonus promo banner on the dashboard.
 * - Every 30-minute window the backend produces a NEW system-wide offer
 *   (new code + new bonus % between 2% and 10%).
 * - Each offer is REDEEMABLE for only the first 10 minutes of its window
 *   (live countdown shown). After that, banner hides until the next window.
 * - Any user can redeem at most ONE offer for life; bonus credits to the
 *   TRADING balance (non-withdrawable) on their next confirmed deposit.
 */
export function PromoBonusBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Per-user per-day dismissal cap: banner shows max 2 times per calendar day.
  // Each X click increments the daily counter in localStorage; once the
  // counter hits 2, the banner stays hidden for the rest of that day.
  const todayKey = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `promoBanner:dismissed:${user?.id ?? "anon"}:${y}-${m}-${day}`;
  }, [user?.id]);

  const [dismissCount, setDismissCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      return parseInt(localStorage.getItem(todayKey) ?? "0", 10) || 0;
    } catch {
      return 0;
    }
  });

  // Re-read the counter whenever the day-key changes (e.g. after midnight
  // the key changes, so we reset the in-memory count from storage).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissCount(parseInt(localStorage.getItem(todayKey) ?? "0", 10) || 0);
    } catch {
      setDismissCount(0);
    }
  }, [todayKey]);

  const handleDismiss = () => {
    const next = dismissCount + 1;
    setDismissCount(next);
    try {
      localStorage.setItem(todayKey, String(next));
    } catch {}
  };

  const { data: offer } = useQuery<OfferResponse>({
    queryKey: ["promo-offer"],
    queryFn: () => authFetch<OfferResponse>("/api/promo/offer"),
    refetchInterval: 30000,
    retry: false,
    enabled: !!user,
  });

  // Tick the countdown every second while an active offer is visible.
  useEffect(() => {
    if (!offer?.active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [offer?.active]);

  // When the current window ends, refetch to pick up the next window's offer.
  useEffect(() => {
    if (!offer) return;
    // Use serverTime to neutralize clock skew
    const skew = offer.serverTime - Date.now();
    const msUntilEnd = offer.expiresAt - Date.now() - skew;
    const msUntilNext = offer.nextOfferAt - Date.now() - skew;
    const delays = [msUntilEnd + 500, msUntilNext + 500].filter((d) => d > 0 && d < 35 * 60 * 1000);
    const timers = delays.map((d) =>
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["promo-offer"] }), d),
    );
    return () => timers.forEach(clearTimeout);
  }, [offer, queryClient]);

  const redeemMut = useMutation({
    mutationFn: (code: string) =>
      authFetch<{ success: boolean; message: string; bonusPercent: number }>(
        "/api/promo/redeem",
        {
          method: "POST",
          body: JSON.stringify({ code }),
        },
      ),
    onSuccess: (res) => {
      toast({
        title: `${res.bonusPercent}% bonus locked in`,
        description:
          "Your bonus will be added to your Trading Balance on your next confirmed deposit. Bonus is non-withdrawable — only realized profits can be withdrawn.",
      });
      queryClient.invalidateQueries({ queryKey: ["promo-offer"] });
    },
    onError: (err: any) => {
      toast({
        title: "Could not apply promo",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCopy = async () => {
    if (!offer?.code) return;
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const msLeft = useMemo(() => {
    if (!offer) return 0;
    const skew = offer.serverTime - Date.now();
    return Math.max(0, offer.expiresAt - now - skew);
  }, [offer, now]);

  // Hide only if offer failed to load or user has actually redeemed.
  // Banner is pinned — no per-window dismiss, no auto-hide.
  if (!offer) return null;
  if (offer.alreadyRedeemed) return null;
  if (!offer.active) return null;
  // Respect the 2-per-day dismissal cap.
  if (dismissCount >= 2) return null;

  // Progress for the 10-minute active window
  const totalActiveMs = offer.expiresAt - offer.windowStart;
  const progressPct = Math.max(0, Math.min(100, (msLeft / totalActiveMs) * 100));
  const bonusStr = Number.isInteger(offer.bonusPercent)
    ? `${offer.bonusPercent}`
    : offer.bonusPercent.toFixed(1);
  const urgent = msLeft < 60_000;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={offer.windowStart}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl border border-amber-400/40 bg-gradient-to-br from-[#1a1205] via-[#1d1307] to-[#120a04] shadow-[0_14px_40px_-12px_rgba(245,158,11,0.45),0_1px_0_rgba(255,255,255,0.06)_inset]"
      >
        {/* Shimmer overlay */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          initial={{ x: "-100%" }}
          animate={{ x: "200%" }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 4 }}
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(253,224,71,0.12) 40%, rgba(253,224,71,0.22) 50%, rgba(253,224,71,0.12) 60%, transparent 100%)",
          }}
        />
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300 to-transparent" />

        {/* Close / dismiss — daily cap 2 */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss offer"
          className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 border border-amber-300/30 hover:border-amber-300/60 text-amber-200/80 hover:text-amber-100 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="absolute -top-24 -right-16 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-60 h-60 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-4 sm:px-5 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Icon */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400/40 blur-xl rounded-full animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300/30 via-yellow-400/20 to-orange-500/25 border border-amber-300/60 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                <Gift className="w-7 h-7 text-amber-200" strokeWidth={2} />
              </div>
            </div>
            {/* Mobile: only the Live Offer badge (timer lives near the code) */}
            <div className="flex flex-col gap-1.5 lg:hidden">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                <Sparkles className="w-3 h-3" /> Live Offer
              </span>
            </div>
          </div>

          {/* Message + code */}
          <div className="min-w-0 flex-1">
            <div className="hidden lg:flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold uppercase tracking-[0.18em]">
                <Sparkles className="w-3 h-3" /> Limited · One-time per user
              </span>
            </div>
            <h3 className="text-base md:text-lg font-extrabold leading-tight">
              <span className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent">
                Deposit now & get {bonusStr}% extra bonus
              </span>
            </h3>
            <p className="mt-0.5 text-xs md:text-[13px] text-white/65 leading-snug">
              Apply this code on your next USDT deposit. Bonus credits to your{" "}
              <span className="text-amber-200 font-semibold">Trading Balance</span>.{" "}
              <span className="text-white/40">T&amp;C apply.</span>
            </p>

            {/* Countdown bar */}
            <div className="mt-2 h-1 w-full bg-black/40 rounded-full overflow-hidden">
              <motion.div
                className={
                  "h-full " +
                  (urgent
                    ? "bg-gradient-to-r from-red-400 to-orange-400"
                    : "bg-gradient-to-r from-amber-400 to-yellow-300")
                }
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, ease: "linear" }}
              />
            </div>

            {/* Code box + countdown timer — side-by-side */}
            <div className="mt-3 flex flex-wrap items-stretch gap-2">
              <div className="inline-flex items-stretch rounded-xl border border-amber-300/40 bg-black/40 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2">
                  <BadgePercent className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="font-mono text-sm md:text-base font-bold tracking-[0.15em] text-amber-100">
                    {offer.code}
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="px-3 border-l border-amber-300/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  aria-label="Copy promo code"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied
                    </>
                  ) : (
                    <>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </>
                )}
              </button>
              </div>

              {/* Countdown pill — lives right next to the code */}
              <div
                className={
                  "inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2 shadow-sm " +
                  (urgent
                    ? "bg-red-500/15 border-red-400/50 animate-pulse"
                    : "bg-black/40 border-amber-300/40")
                }
                aria-label="Offer countdown"
              >
                <Timer
                  className={"w-5 h-5 shrink-0 " + (urgent ? "text-red-300" : "text-amber-300")}
                />
                <div className="flex flex-col leading-none">
                  <span
                    className={
                      "text-[9px] font-bold uppercase tracking-[0.18em] " +
                      (urgent ? "text-red-300" : "text-amber-300/90")
                    }
                  >
                    Ends in
                  </span>
                  <span
                    className={
                      "mt-1 text-2xl md:text-3xl font-black tabular-nums tracking-tight drop-shadow-[0_2px_8px_rgba(253,224,71,0.35)] " +
                      (urgent ? "text-red-200" : "text-amber-100")
                    }
                  >
                    {formatMs(msLeft)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <Link
              href="/deposit"
              onClick={() => {
                if (!offer.alreadyRedeemed && !redeemMut.isPending) {
                  redeemMut.mutate(offer.code);
                }
              }}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-black text-sm font-bold shadow-lg shadow-amber-500/40 transition-all"
            >
              Deposit & Apply
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
