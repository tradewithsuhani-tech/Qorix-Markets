import { motion } from "framer-motion";
import { Flame, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface IdleBalanceBannerProps {
  /** User's available (non-invested) USDT balance. */
  balance: number;
  /** Whether they currently have an active investment. */
  isActive: boolean;
  /** Reference daily yield used to compute the "lost per day" amount. */
  dailyRate?: number;
}

/**
 * Loss-aversion banner shown on the dashboard when a user is sitting on idle
 * funds without an active investment. Frames inactivity as an active loss
 * ("you're losing $X/day") rather than a missed opportunity, which is the
 * more potent psychological lever.
 *
 * Auto-hides for users with no balance or an already-active fund — no point
 * shaming someone who can't act on it.
 */
export function IdleBalanceBanner({
  balance,
  isActive,
  dailyRate = 0.005, // 0.5% daily reference rate
}: IdleBalanceBannerProps) {
  if (isActive) return null;
  if (!balance || balance < 50) return null;

  const dailyLoss = balance * dailyRate;
  const monthlyLoss = dailyLoss * 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative mb-4 overflow-hidden rounded-2xl border border-rose-400/30 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(244,63,94,0.22),transparent_55%),linear-gradient(to_right,rgba(76,5,25,0.55),rgba(2,6,23,0.85))] px-4 py-3.5 sm:px-5 sm:py-4"
      data-testid="banner-idle-balance-loss"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-400/60 to-transparent" />
      <div className="flex items-center gap-3.5">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/40">
          <Flame className="w-5 h-5 text-rose-300" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-rose-300/85">
            Idle balance alert
          </div>
          <div className="mt-0.5 text-[13.5px] sm:text-[14.5px] font-bold text-white leading-snug">
            Your{" "}
            <span className="text-rose-200">
              ${balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>{" "}
            is losing{" "}
            <span className="text-rose-300">
              ~${dailyLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/day
            </span>{" "}
            <span className="hidden sm:inline text-white/65 font-semibold">
              (≈ ${monthlyLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month)
            </span>
          </div>
        </div>

        <Link
          href="/invest"
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-400 hover:to-orange-400 shadow-[0_6px_18px_-6px_rgba(244,63,94,0.7)] transition-all"
          data-testid="link-idle-balance-activate"
        >
          Activate
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.div>
  );
}
