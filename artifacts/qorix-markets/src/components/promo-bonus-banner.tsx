import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Gift, Copy, Check, ArrowRight, X, Sparkles, BadgePercent } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface PromoOffer {
  code: string;
  status: "issued" | "redeemed" | "credited";
  bonusPercent: number;
  redeemedAt: string | null;
  creditedAt: string | null;
  bonusAmount: number | null;
  available: boolean;
}

const REAPPEAR_MS = 30 * 60 * 1000; // 30 minutes
const DISMISS_KEY = "qrx_promo_bonus_hide_until";

/**
 * Persistent 5% deposit-bonus promo banner on the dashboard.
 * - Shows every 30 minutes if the user hasn't redeemed yet
 * - One-time-use code per user (backend enforced)
 * - "Copy" button copies the code; "Deposit & Apply" locks redemption and
 *   navigates to /deposit. Bonus credits on next confirmed on-chain deposit.
 */
export function PromoBonusBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Number(localStorage.getItem(DISMISS_KEY) ?? 0) > Date.now();
  });

  // Re-show after 30 min
  useEffect(() => {
    if (!hidden) return;
    const until = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    const delay = Math.max(0, until - Date.now());
    const t = setTimeout(() => setHidden(false), delay + 250);
    return () => clearTimeout(t);
  }, [hidden]);

  const { data: offer } = useQuery<PromoOffer>({
    queryKey: ["promo-offer"],
    queryFn: () => authFetch<PromoOffer>("/api/promo/offer"),
    refetchInterval: 60000,
    retry: false,
    enabled: !!user, // Skip network call for guests
  });

  const redeemMut = useMutation({
    mutationFn: (code: string) =>
      authFetch<{ success: boolean; message: string }>("/api/promo/redeem", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      toast({
        title: "Promo locked in",
        description:
          "Your 5% bonus will be added to your Trading Balance on your next confirmed deposit. Bonus is non-withdrawable — only realized profits can be withdrawn.",
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

  const handleDismiss = () => {
    const until = Date.now() + REAPPEAR_MS;
    try { localStorage.setItem(DISMISS_KEY, String(until)); } catch {}
    setHidden(true);
  };

  // Hide if: no offer yet, dismissed, or already used
  if (!offer || hidden || !offer.available) return null;

  return (
    <AnimatePresence>
      <motion.div
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
        <div className="absolute -top-24 -right-16 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-16 w-60 h-60 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="relative px-4 sm:px-5 py-4 sm:py-5 flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Icon + badge */}
          <div className="shrink-0 flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400/40 blur-xl rounded-full animate-pulse" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300/30 via-yellow-400/20 to-orange-500/25 border border-amber-300/60 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                <Gift className="w-7 h-7 text-amber-200" strokeWidth={2} />
              </div>
            </div>
            <span className="lg:hidden inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
              <Sparkles className="w-3 h-3" /> Limited Offer
            </span>
          </div>

          {/* Message + code */}
          <div className="min-w-0 flex-1">
            <div className="hidden lg:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold uppercase tracking-[0.18em] mb-1.5">
              <Sparkles className="w-3 h-3" /> Limited Offer · One-time use
            </div>
            <h3 className="text-base md:text-lg font-extrabold leading-tight">
              <span className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent">
                Deposit now & get {offer.bonusPercent}% extra bonus
              </span>
            </h3>
            <p className="mt-0.5 text-xs md:text-[13px] text-white/65 leading-snug">
              Apply your personal code on the next USDT deposit. Bonus credits to your{" "}
              <span className="text-amber-200 font-semibold">Trading Balance</span> (non-withdrawable
              — grows your fund, profits are withdrawable).{" "}
              <span className="text-white/40">T&amp;C apply.</span>
            </p>

            {/* Code box */}
            <div className="mt-3 inline-flex items-stretch rounded-xl border border-amber-300/40 bg-black/40 overflow-hidden">
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
          </div>

          {/* CTA */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <Link
              href="/deposit"
              onClick={() => {
                if (offer.status === "issued" && !redeemMut.isPending) {
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
