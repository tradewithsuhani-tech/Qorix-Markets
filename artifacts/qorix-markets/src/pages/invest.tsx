import {
  useGetInvestment,
  useStartInvestment,
  useStopInvestment,
  useToggleCompounding,
  useUpdateProtection,
  useGetWallet,
  useGetDashboardFundStats,
  getGetWalletQueryKey,
  getGetInvestmentQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Zap, BarChart2, Play, Square, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle, ChevronRight,
  ArrowUpRight, Info, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

const RISK_PROFILES = [
  {
    id: "LOW",
    label: "Conservative",
    tagline: "Capital-first strategy",
    description: "Minimal volatility with steady, predictable gains. Ideal for capital preservation.",
    icon: Shield,
    multiplier: 0.6,
    minDailyPct: 0.3,
    maxDailyPct: 0.6,
    drawdownLimit: 3,
    volatility: "Low",
    score: 2,
    color: "text-blue-400",
    gradientFrom: "from-blue-500/20",
    gradientTo: "to-blue-600/5",
    borderActive: "border-blue-400/50",
    borderIdle: "border-white/8",
    glowColor: "rgba(59,130,246,0.15)",
    glowActive: "0 0 30px rgba(59,130,246,0.2), 0 4px 24px rgba(0,0,0,0.4)",
    badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    barColor: "#3b82f6",
    barWidth: "20%",
    features: [
      "Max 3% drawdown protection",
      "0.3–0.6% effective daily rate",
      "Low volatility exposure",
    ],
  },
  {
    id: "MEDIUM",
    label: "Balanced",
    tagline: "Optimized risk/reward",
    description: "Best of both worlds. Consistent returns with moderate market exposure.",
    icon: BarChart2,
    multiplier: 1.0,
    minDailyPct: 0.5,
    maxDailyPct: 1.0,
    drawdownLimit: 5,
    volatility: "Medium",
    score: 5,
    color: "text-indigo-400",
    gradientFrom: "from-indigo-500/20",
    gradientTo: "to-indigo-600/5",
    borderActive: "border-indigo-400/50",
    borderIdle: "border-white/8",
    glowColor: "rgba(99,102,241,0.15)",
    glowActive: "0 0 30px rgba(99,102,241,0.2), 0 4px 24px rgba(0,0,0,0.4)",
    badgeColor: "bg-indigo-500/15 text-indigo-400 border-indigo-500/25",
    barColor: "#6366f1",
    barWidth: "50%",
    features: [
      "Max 5% drawdown protection",
      "0.5–1.0% effective daily rate",
      "Balanced market exposure",
    ],
    recommended: true,
  },
  {
    id: "HIGH",
    label: "Aggressive",
    tagline: "Maximum yield strategy",
    description: "Higher returns with elevated market exposure. Suitable for risk-tolerant investors.",
    icon: Zap,
    multiplier: 1.5,
    minDailyPct: 0.75,
    maxDailyPct: 1.5,
    drawdownLimit: 10,
    volatility: "High",
    score: 8,
    color: "text-orange-400",
    gradientFrom: "from-orange-500/20",
    gradientTo: "to-red-600/5",
    borderActive: "border-orange-400/50",
    borderIdle: "border-white/8",
    glowColor: "rgba(249,115,22,0.15)",
    glowActive: "0 0 30px rgba(249,115,22,0.2), 0 4px 24px rgba(0,0,0,0.4)",
    badgeColor: "bg-orange-500/15 text-orange-400 border-orange-500/25",
    barColor: "#f97316",
    barWidth: "80%",
    features: [
      "Max 10% drawdown protection",
      "0.75–1.5% effective daily rate",
      "High market exposure",
    ],
  },
];

const RISK_DEFAULT_DRAWDOWN: Record<string, number> = {
  low: 3,
  medium: 5,
  high: 10,
};

function RiskMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full transition-all duration-300"
          style={{
            background: i < score
              ? score <= 3 ? "#3b82f6"
                : score <= 6 ? "#6366f1"
                : "#f97316"
              : "rgba(255,255,255,0.08)",
          }}
        />
      ))}
    </div>
  );
}

function ExpectedReturns({ profile, amount }: { profile: typeof RISK_PROFILES[0]; amount: number }) {
  const dailyMin = (amount * profile.minDailyPct) / 100;
  const dailyMax = (amount * profile.maxDailyPct) / 100;
  const monthlyMin = dailyMin * 30;
  const monthlyMax = dailyMax * 30;
  const protection = (amount * profile.drawdownLimit) / 100;

  return (
    <motion.div
      key={`${profile.id}-${amount}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Daily Est.</div>
          <div className="font-bold text-green-400 text-sm">
            +${dailyMin.toFixed(2)} – ${dailyMax.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {profile.minDailyPct}–{profile.maxDailyPct}% rate
          </div>
        </div>
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Monthly Est.</div>
          <div className="font-bold text-emerald-400 text-sm">
            +${monthlyMin.toFixed(2)} – ${monthlyMax.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">30-day projection</div>
        </div>
      </div>
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Drawdown Protection</div>
          <div className="font-semibold text-sm">Max ${protection.toFixed(2)} loss</div>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full border font-medium ${
          profile.drawdownLimit <= 3 ? "bg-blue-500/15 text-blue-400 border-blue-500/25" :
          profile.drawdownLimit <= 5 ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/25" :
          "bg-orange-500/15 text-orange-400 border-orange-500/25"
        }`}>
          {profile.drawdownLimit}% limit
        </div>
      </div>
    </motion.div>
  );
}

type InvestmentData = {
  isActive: boolean;
  isPaused: boolean;
  amount: number;
  drawdown: number;
  drawdownLimit: number;
  riskLevel: string;
  pausedAt?: string | null;
  totalProfit: number;
  peakBalance?: number;
  drawdownFromPeak?: number;
  recoveryPct?: number;
};

function CapitalProtectionPanel({
  investment,
  pendingLimit,
  setPendingLimit,
  onSave,
  isSaving,
}: {
  investment: InvestmentData;
  pendingLimit: number | null;
  setPendingLimit: (v: number) => void;
  onSave: (limit: number) => void;
  isSaving: boolean;
}) {
  const drawdownPct = investment.amount > 0
    ? (investment.drawdown / investment.amount) * 100
    : 0;
  const limitPct = investment.drawdownLimit;
  const usagePct = limitPct > 0 ? Math.min((drawdownPct / limitPct) * 100, 100) : 0;
  const isTriggered = drawdownPct >= limitPct;
  const selectedLimit = pendingLimit ?? limitPct;
  const hasChanges = pendingLimit !== null && pendingLimit !== limitPct;
  const [showConfirm, setShowConfirm] = useState(false);

  const statusColor = isTriggered
    ? "text-red-400"
    : usagePct > 70
    ? "text-orange-400"
    : "text-green-400";
  const statusLabel = isTriggered ? "Triggered" : "Active";
  const statusBg = isTriggered
    ? "bg-red-500/15 text-red-400 border-red-500/25"
    : usagePct > 70
    ? "bg-orange-500/15 text-orange-400 border-orange-500/25"
    : "bg-green-500/15 text-green-400 border-green-500/25";

  const barColor = isTriggered
    ? "#ef4444"
    : usagePct > 70
    ? "#f97316"
    : "#22c55e";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card p-5 rounded-2xl"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Shield style={{ width: 16, height: 16 }} className="text-blue-400" />
          <h3 className="font-semibold">Capital Protection</h3>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold flex items-center gap-1.5 ${statusBg}`}>
          {!isTriggered && <span className="live-dot" style={{ width: 5, height: 5 }} />}
          {statusLabel}
        </span>
      </div>

      {/* Drawdown gauge */}
      <div className="mb-5">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-muted-foreground">Current Drawdown</span>
          <span className={`font-bold ${statusColor}`}>
            ${investment.drawdown.toFixed(2)} ({drawdownPct.toFixed(2)}%)
          </span>
        </div>
        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${usagePct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${barColor}99, ${barColor})` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
          <span>$0</span>
          <span>Limit: ${((investment.amount * limitPct) / 100).toFixed(2)} ({limitPct}%)</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Protection Limit", value: `${limitPct}%`, sub: `$${((investment.amount * limitPct) / 100).toFixed(2)}` },
          { label: "Used", value: `${drawdownPct.toFixed(2)}%`, sub: `of ${limitPct}% limit` },
          { label: "Remaining", value: `$${Math.max(0, (investment.amount * limitPct / 100) - investment.drawdown).toFixed(2)}`, sub: "buffer left" },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
            <div className="text-[10px] text-muted-foreground mb-1">{s.label}</div>
            <div className="font-bold text-sm">{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Limit selector */}
      <div className="pt-4 border-t border-white/8">
        <div className="text-xs text-muted-foreground mb-2.5">Adjust protection limit</div>
        <div className="flex gap-2 mb-3">
          {[3, 5, 10].map((pct) => (
            <button
              key={pct}
              onClick={() => setPendingLimit(pct)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                selectedLimit === pct
                  ? "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                  : "bg-white/3 text-muted-foreground border-white/8 hover:border-white/15 hover:text-white"
              }`}
            >
              {pct}%
            </button>
          ))}
        </div>
        <AnimatePresence>
          {hasChanges && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              onClick={() => setShowConfirm(true)}
              disabled={isSaving}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <CheckCircle style={{ width: 13, height: 13 }} /> Review Change
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {showConfirm && pendingLimit !== null && (
          <ProtectionConfirmModal
            amount={investment.amount}
            currentLimit={limitPct}
            newLimit={pendingLimit}
            isSaving={isSaving}
            onCancel={() => setShowConfirm(false)}
            onConfirm={() => {
              onSave(pendingLimit);
              setShowConfirm(false);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProtectionConfirmModal({
  amount,
  currentLimit,
  newLimit,
  isSaving,
  onCancel,
  onConfirm,
}: {
  amount: number;
  currentLimit: number;
  newLimit: number;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const currentBuffer = (amount * currentLimit) / 100;
  const newBuffer = (amount * newLimit) / 100;
  const diff = newBuffer - currentBuffer;
  const isWider = newLimit > currentLimit;
  const labelFor = (p: number) => (p <= 3 ? "Conservative" : p <= 5 ? "Balanced" : "Aggressive");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0b1020] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Shield style={{ width: 16, height: 16 }} className="text-blue-400" />
            <h3 className="font-semibold">Confirm Protection Change</h3>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Review how this change affects your capital protection before applying.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Current */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</div>
              <div className="text-2xl font-bold">{currentLimit}%</div>
              <div className="text-[11px] text-muted-foreground">{labelFor(currentLimit)}</div>
              <div className="pt-2 border-t border-white/5 mt-2">
                <div className="text-[10px] text-muted-foreground">Max loss buffer</div>
                <div className="text-sm font-semibold text-white">${currentBuffer.toFixed(2)}</div>
              </div>
            </div>
            {/* New */}
            <div className={`rounded-xl border p-3 space-y-1 ${isWider ? "border-amber-500/35 bg-amber-500/5" : "border-emerald-500/35 bg-emerald-500/5"}`}>
              <div className={`text-[10px] uppercase tracking-wider ${isWider ? "text-amber-400" : "text-emerald-400"}`}>After change</div>
              <div className={`text-2xl font-bold ${isWider ? "text-amber-300" : "text-emerald-300"}`}>{newLimit}%</div>
              <div className="text-[11px] text-muted-foreground">{labelFor(newLimit)}</div>
              <div className="pt-2 border-t border-white/5 mt-2">
                <div className="text-[10px] text-muted-foreground">Max loss buffer</div>
                <div className={`text-sm font-semibold ${isWider ? "text-amber-300" : "text-emerald-300"}`}>${newBuffer.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Impact line */}
          <div className={`rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2 ${
            isWider ? "border-amber-500/25 bg-amber-500/5 text-amber-300/95" : "border-emerald-500/25 bg-emerald-500/8 text-emerald-300/95"
          }`}>
            {isWider ? (
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <span>
              {isWider
                ? <>You are <b>widening</b> the cap — trading can run longer in losses. Your stop-out will now trigger at a <b>${Math.abs(diff).toFixed(2)} larger</b> drawdown.</>
                : <>You are <b>tightening</b> the cap — trading will stop sooner. Your stop-out will now trigger at a <b>${Math.abs(diff).toFixed(2)} smaller</b> drawdown for faster capital protection.</>}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <><RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> Applying…</>
              ) : (
                <>Apply {newLimit}% Limit</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProtectionTriggeredView({
  investment,
  activeProfile,
  onRestart,
}: {
  investment: InvestmentData;
  activeProfile: typeof RISK_PROFILES[0];
  onRestart: () => void;
}) {
  const drawdownPct = investment.amount > 0
    ? (investment.drawdown / investment.amount) * 100
    : 0;
  const peakBalance = investment.peakBalance ?? investment.amount;
  const drawdownFromPeak = investment.drawdownFromPeak ?? drawdownPct;
  const recoveryPct = investment.recoveryPct ?? 0;
  const capitalPreserved = Math.max(0, investment.amount - investment.drawdown);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Alert banner */}
      <div className="glass-card p-6 md:p-8 rounded-2xl border border-red-500/30 relative overflow-hidden"
        style={{ boxShadow: "0 0 30px rgba(239,68,68,0.12), 0 4px 24px rgba(0,0,0,0.4)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <Shield style={{ width: 22, height: 22 }} className="text-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-red-400">Capital Protection Triggered</h2>
              </div>
              <p className="text-muted-foreground text-sm">
                Your trading was automatically stopped because your drawdown reached the{" "}
                <span className="text-white font-semibold">{investment.drawdownLimit}% protection limit</span>.
                Your remaining capital is secured.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            {[
              { label: "Capital Invested", value: `$${investment.amount.toFixed(2)}`, color: "text-white" },
              { label: "Total Drawdown", value: `$${investment.drawdown.toFixed(2)}`, color: "text-red-400" },
              { label: "Drawdown %", value: `${drawdownPct.toFixed(2)}%`, color: "text-orange-400" },
              { label: "Capital Preserved", value: `$${capitalPreserved.toFixed(2)}`, color: "text-green-400" },
            ].map((s) => (
              <div key={s.label} className="stat-card p-4 rounded-xl">
                <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Peak balance & recovery row */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Peak Balance</div>
              <div className="text-base font-bold text-white tabular-nums">${peakBalance.toFixed(2)}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                -{drawdownFromPeak.toFixed(2)}% from peak
              </div>
            </div>
            <div className={`p-3 rounded-xl border ${recoveryPct > 0 ? "bg-blue-500/8 border-blue-500/20" : "bg-emerald-500/8 border-emerald-500/20"}`}>
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Recovery Target</div>
              {recoveryPct > 0 ? (
                <>
                  <div className="text-base font-bold text-blue-400 tabular-nums">+{recoveryPct.toFixed(2)}%</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">gain needed to reach peak</div>
                </>
              ) : (
                <>
                  <div className="text-base font-bold text-emerald-400">At Peak</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">no recovery needed</div>
                </>
              )}
            </div>
          </div>

          {investment.pausedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
              <AlertTriangle style={{ width: 13, height: 13 }} className="text-orange-400" />
              Protection triggered at {new Date(investment.pausedAt).toLocaleString()}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/8">
            <button
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]"
            >
              <Play style={{ width: 14, height: 14 }} className="fill-current" />
              Restart Trading
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-3 bg-white/3 border border-white/8 rounded-xl">
              <Info style={{ width: 13, height: 13 }} />
              Funds are safe in your wallet. Review your strategy before restarting.
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="glass-card p-5 rounded-2xl">
        <h3 className="font-semibold text-sm mb-4 text-muted-foreground">What happened?</h3>
        <div className="space-y-3 text-sm">
          {[
            { icon: TrendingUp, text: `You started trading with $${investment.amount.toFixed(2)} USD at ${activeProfile.label} risk. Peak balance reached: $${peakBalance.toFixed(2)}.`, color: "text-blue-400" },
            { icon: AlertTriangle, text: `Market conditions caused a $${investment.drawdown.toFixed(2)} drawdown (${drawdownPct.toFixed(2)}% of your capital, -${drawdownFromPeak.toFixed(2)}% from peak).`, color: "text-orange-400" },
            { icon: Shield, text: `Your ${investment.drawdownLimit}% protection limit was reached, triggering an automatic stop.`, color: "text-red-400" },
            { icon: CheckCircle, text: `$${capitalPreserved.toFixed(2)} USD secured. ${recoveryPct > 0 ? `Restart and earn +${recoveryPct.toFixed(2)}% to return to your peak.` : "Your balance is at peak."}`, color: "text-green-400" },
          ].map(({ icon: Icon, text, color }, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <Icon style={{ width: 14, height: 14 }} className={`${color} mt-0.5 shrink-0`} />
              <span className="text-muted-foreground">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function InvestPage() {
  const { data: investment, isLoading } = useGetInvestment();
  const { data: wallet } = useGetWallet();
  const { data: fundStats } = useGetDashboardFundStats({ query: { refetchInterval: 30000 } });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [riskLevel, setRiskLevel] = useState("MEDIUM");
  const [pendingLimit, setPendingLimit] = useState<number | null>(null);

  const selectedProfile = useMemo(
    () => RISK_PROFILES.find(p => p.id === riskLevel) ?? RISK_PROFILES[1]!,
    [riskLevel]
  );

  const numAmount = parseFloat(amount) || 0;
  const maxAmount = wallet?.tradingBalance || 0;
  const canDeploy = numAmount > 0 && numAmount <= maxAmount;

  const startMutation = useStartInvestment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Investment Started", description: "Your automated trading has begun." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setAmount("");
        if (pendingLimit !== null) {
          protectionMutation.mutate({ data: { drawdownLimit: pendingLimit } });
        }
      },
      onError: (err: any) => {
        toast({ title: "Failed to start", description: err.message, variant: "destructive" });
      },
    },
  });

  const stopMutation = useStopInvestment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Investment Stopped", description: "Funds returned to trading balance." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Failed to stop", description: err.message, variant: "destructive" });
      },
    },
  });

  const compoundMutation = useToggleCompounding({
    mutation: {
      onSuccess: () => {
        toast({ title: "Compounding updated" });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
      },
    },
  });

  const protectionMutation = useUpdateProtection({
    mutation: {
      onSuccess: () => {
        toast({ title: "Protection updated", description: "Capital protection limit has been saved." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        setPendingLimit(null);
      },
      onError: (err: any) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      },
    },
  });

  const activeProfile = RISK_PROFILES.find(
    p => p.id === investment?.riskLevel?.toUpperCase()
  ) ?? RISK_PROFILES[1]!;

  return (
    <Layout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Investment Center</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Configure your risk profile and deploy capital into automated strategies.
          </p>
        </div>

        {/* Limited Slots Banner */}
        {fundStats && fundStats.maxSlots > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${
              fundStats.isFull
                ? "bg-red-500/8 border-red-500/25"
                : fundStats.availableSlots !== null && fundStats.availableSlots <= Math.ceil(fundStats.maxSlots * 0.2)
                ? "bg-red-500/8 border-red-500/20"
                : "bg-amber-500/8 border-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${fundStats.isFull ? "bg-red-500/15" : "bg-amber-500/15"}`}>
                <Zap style={{ width: 14, height: 14, color: fundStats.isFull ? "#f87171" : "#fbbf24" }} />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${fundStats.isFull ? "text-red-400" : "text-amber-400"}`}>
                  {fundStats.isFull ? "All Investor Slots Are Full" : "⚡ Limited Slots Available"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {fundStats.isFull
                    ? `All ${fundStats.maxSlots} slots are currently occupied — new investments paused`
                    : `Only ${fundStats.availableSlots} of ${fundStats.maxSlots} investor slots remain open`}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="text-xs tabular-nums font-semibold" style={{ color: fundStats.isFull ? "#f87171" : "#fbbf24" }}>
                {fundStats.activeInvestors}/{fundStats.maxSlots}
              </div>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (fundStats.activeInvestors / fundStats.maxSlots) * 100)}%`,
                    background: fundStats.isFull ? "#ef4444" : "linear-gradient(90deg, #f59e0b, #f97316)"
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full" />
          </div>
        ) : (investment?.isPaused && !investment?.isActive) ? (
          /* ── PROTECTION TRIGGERED / PAUSED STATE ────────────────── */
          <ProtectionTriggeredView
            investment={investment}
            activeProfile={RISK_PROFILES.find(p => p.id === investment.riskLevel?.toUpperCase()) ?? RISK_PROFILES[1]!}
            onRestart={() => {
              setAmount("");
              queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
            }}
          />
        ) : investment?.isActive ? (
          /* ── ACTIVE INVESTMENT VIEW ──────────────────────────────── */
          <div className="space-y-5">
            {/* Active Banner */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 md:p-8 rounded-2xl relative overflow-hidden"
              style={{ boxShadow: activeProfile.glowActive }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${activeProfile.gradientFrom} ${activeProfile.gradientTo} pointer-events-none`} />

              <div className="relative">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeProfile.gradientFrom} border ${activeProfile.borderActive}`}>
                      <activeProfile.icon style={{ width: 20, height: 20 }} className={activeProfile.color} />
                    </div>
                    <div>
                      <div className="font-bold text-lg">{activeProfile.label} Strategy</div>
                      <div className="text-xs text-muted-foreground">{activeProfile.tagline}</div>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/15 text-green-400 rounded-full text-xs font-semibold border border-green-500/25">
                    <span className="live-dot" style={{ width: 6, height: 6 }} />
                    Trading Active
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: "Invested Capital", value: <><AnimatedCounter value={investment.amount} prefix="$" /></>, color: "text-white" },
                    { label: "Total Profit", value: <><AnimatedCounter value={investment.totalProfit} prefix="$" /></>, color: "text-green-400" },
                    { label: "Today's Profit", value: <><AnimatedCounter value={investment.dailyProfit} prefix="$" /></>, color: "text-emerald-400" },
                    { label: "Drawdown", value: `$${investment.drawdown.toFixed(2)}`, color: "text-orange-400" },
                  ].map((item, i) => (
                    <motion.div
                      key={item.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="stat-card p-4 rounded-xl"
                    >
                      <div className="text-xs text-muted-foreground mb-1.5">{item.label}</div>
                      <div className={`text-xl font-bold ${item.color}`}>{item.value}</div>
                    </motion.div>
                  ))}
                </div>

                {/* Risk Meter */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Risk Exposure</span>
                    <span className={`font-semibold ${activeProfile.color}`}>
                      {activeProfile.volatility} · {activeProfile.score}/10
                    </span>
                  </div>
                  <RiskMeter score={activeProfile.score} />
                </div>

                {/* Drawdown Progress */}
                <div className="mb-6">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-muted-foreground">Drawdown Usage</span>
                    <span className="text-muted-foreground">
                      ${investment.drawdown.toFixed(2)} / ${((investment.amount * activeProfile.drawdownLimit) / 100).toFixed(2)} max
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min((investment.drawdown / ((investment.amount * activeProfile.drawdownLimit) / 100)) * 100, 100)}%`
                      }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${activeProfile.barColor}, ${activeProfile.barColor}99)`
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/8">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={investment.autoCompound}
                      onCheckedChange={(checked) => compoundMutation.mutate({ data: { autoCompound: checked } })}
                    />
                    <span className="text-sm font-medium flex items-center gap-2">
                      <RefreshCw style={{ width: 14, height: 14 }} className="text-blue-400" />
                      Auto-Compound Profits
                    </span>
                    {investment.autoCompound && (
                      <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 px-2 py-0.5 rounded-full">ON</span>
                    )}
                  </div>
                  <button
                    onClick={() => stopMutation.mutate({})}
                    disabled={stopMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/15 border border-red-500/25 rounded-xl font-medium transition-all text-sm disabled:opacity-50"
                  >
                    <Square style={{ width: 14, height: 14 }} />
                    {stopMutation.isPending ? "Stopping..." : "Stop Trading"}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Features of current profile */}
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Info style={{ width: 14, height: 14 }} className="text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Active Strategy Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {activeProfile.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle style={{ width: 14, height: 14 }} className={activeProfile.color} />
                    <span className="text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Capital Protection Panel */}
            <CapitalProtectionPanel
              investment={investment}
              pendingLimit={pendingLimit}
              setPendingLimit={setPendingLimit}
              onSave={(limit) => protectionMutation.mutate({ data: { drawdownLimit: limit } })}
              isSaving={protectionMutation.isPending}
            />
          </div>
        ) : (
          /* ── SETUP VIEW ──────────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Left: Strategy Selection + Amount */}
            <div className="lg:col-span-3 space-y-5">

              {/* Risk Profile Cards */}
              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">Select Strategy Profile</h2>
                  <span className="text-xs text-muted-foreground">3 profiles available</span>
                </div>
                <div className="space-y-3">
                  {RISK_PROFILES.map((profile, i) => {
                    const isSelected = riskLevel === profile.id;
                    return (
                      <motion.button
                        key={profile.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        onClick={() => setRiskLevel(profile.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                          isSelected
                            ? `${profile.borderActive} bg-gradient-to-r ${profile.gradientFrom} ${profile.gradientTo}`
                            : "border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15"
                        }`}
                        style={isSelected ? { boxShadow: `0 0 20px ${profile.glowColor}` } : {}}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? `bg-gradient-to-br ${profile.gradientFrom} ${profile.gradientTo} border ${profile.borderActive}`
                              : "bg-white/5 border border-white/8"
                          }`}>
                            <profile.icon style={{ width: 18, height: 18 }} className={isSelected ? profile.color : "text-muted-foreground"} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold">{profile.label}</span>
                              {profile.recommended && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded font-bold uppercase tracking-wide">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">{profile.description}</div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${profile.badgeColor}`}>
                                {profile.minDailyPct}–{profile.maxDailyPct}% daily
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {profile.drawdownLimit}% max drawdown
                              </span>
                              <span className={`text-xs ${
                                profile.volatility === "Low" ? "text-blue-400"
                                : profile.volatility === "Medium" ? "text-indigo-400"
                                : "text-orange-400"
                              }`}>
                                {profile.volatility} volatility
                              </span>
                            </div>
                          </div>
                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-2 ${profile.badgeColor} border`}
                              >
                                <CheckCircle style={{ width: 12, height: 12 }} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Risk Meter Bar */}
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-3 pt-3 border-t border-white/8"
                          >
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                              <span>Risk exposure</span>
                              <span className={`font-medium ${profile.color}`}>{profile.score}/10</span>
                            </div>
                            <RiskMeter score={profile.score} />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Input */}
              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Capital Allocation</h2>
                  <span className="text-xs text-muted-foreground">
                    Available:{" "}
                    <span className="text-blue-400 font-semibold">${maxAmount.toFixed(2)} USD</span>
                  </span>
                </div>

                <div className="relative mb-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-2xl font-bold text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:outline-none pr-24 transition-all"
                    placeholder="0.00"
                    min="0"
                    max={maxAmount}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      onClick={() => setAmount(String(Math.floor(maxAmount * 100) / 100))}
                      className="text-xs text-blue-400 font-semibold px-2 py-1 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition border border-blue-500/20"
                    >
                      MAX
                    </button>
                    <span className="text-muted-foreground text-sm font-medium">USD</span>
                  </div>
                </div>

                {/* Quick amount buttons */}
                <div className="flex gap-2 flex-wrap">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setAmount(String(Math.floor(maxAmount * pct / 100 * 100) / 100))}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/15 transition-all text-muted-foreground hover:text-white font-medium"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                {amount && numAmount > maxAmount && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="flex items-center gap-2 mt-3 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2"
                  >
                    <AlertTriangle style={{ width: 12, height: 12 }} />
                    Exceeds available trading balance
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right: Summary + Deploy */}
            <div className="lg:col-span-2 space-y-4">
              {/* Capital Protection Setup */}
              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <Shield style={{ width: 15, height: 15 }} className="text-blue-400" />
                  <h3 className="font-semibold text-sm">Capital Protection</h3>
                  <span className="ml-auto text-xs bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full">Always Active</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Trading stops automatically if losses reach your set limit, protecting your capital.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 5, 10].map((pct) => {
                    const isSelected = (pendingLimit ?? (RISK_DEFAULT_DRAWDOWN[riskLevel.toLowerCase()] ?? 5)) === pct;
                    return (
                      <button
                        key={pct}
                        onClick={() => setPendingLimit(pct)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                          isSelected
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                            : "bg-white/3 text-muted-foreground border-white/8 hover:border-white/15 hover:text-white"
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 text-xs text-center text-muted-foreground">
                  {pendingLimit !== null
                    ? `Trading will stop if losses exceed ${pendingLimit}% of invested capital`
                    : `Default: ${RISK_DEFAULT_DRAWDOWN[riskLevel.toLowerCase()] ?? 5}% for ${selectedProfile.label} strategy`
                  }
                </div>
              </div>

              {/* Expected Returns Panel */}
              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp style={{ width: 15, height: 15 }} className={selectedProfile.color} />
                  <h3 className="font-semibold text-sm">Expected Returns</h3>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={selectedProfile.id}
                      initial={{ opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -4 }}
                      className={`ml-auto text-xs px-2 py-0.5 rounded-full border ${selectedProfile.badgeColor}`}
                    >
                      {selectedProfile.label}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait">
                  {numAmount > 0 ? (
                    <ExpectedReturns
                      key={`${selectedProfile.id}-${numAmount}`}
                      profile={selectedProfile}
                      amount={numAmount}
                    />
                  ) : (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-6 text-muted-foreground"
                    >
                      <TrendingUp style={{ width: 28, height: 28 }} className="mx-auto mb-2 opacity-20" />
                      <p className="text-xs">Enter an amount to see projections</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Strategy Summary */}
              <div className="glass-card p-5 rounded-2xl">
                <h3 className="font-semibold text-sm mb-4">Deployment Summary</h3>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: "Capital", value: numAmount > 0 ? `$${numAmount.toFixed(2)} USD` : "—" },
                    { label: "Strategy", value: selectedProfile.label },
                    { label: "Daily Rate", value: `${selectedProfile.minDailyPct}–${selectedProfile.maxDailyPct}%`, highlight: true },
                    { label: "Risk Level", value: selectedProfile.volatility },
                    { label: "Drawdown Limit", value: `${selectedProfile.drawdownLimit}%` },
                    { label: "Compounding", value: "Configurable post-start" },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="flex justify-between items-center py-1 border-b border-white/[0.04] last:border-0">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-medium ${highlight ? "text-green-400" : "text-white"}`}>{value}</span>
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={canDeploy ? { scale: 1.01 } : {}}
                  whileTap={canDeploy ? { scale: 0.99 } : {}}
                  onClick={() => startMutation.mutate({ data: { amount: numAmount, riskLevel } })}
                  disabled={startMutation.isPending || !canDeploy}
                  className={`w-full mt-5 font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${
                    canDeploy
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)]"
                      : "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/8"
                  }`}
                >
                  {startMutation.isPending ? (
                    <>
                      <RefreshCw style={{ width: 15, height: 15 }} className="animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Play style={{ width: 15, height: 15 }} className="fill-current" />
                      Deploy Capital
                      <ChevronRight style={{ width: 14, height: 14 }} className="opacity-60" />
                    </>
                  )}
                </motion.button>

                {!canDeploy && numAmount === 0 && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Enter an amount to deploy
                  </p>
                )}
              </div>

              {/* Features */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedProfile.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="glass-card p-4 rounded-2xl"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <selectedProfile.icon style={{ width: 13, height: 13 }} className={selectedProfile.color} />
                    <span className="text-xs text-muted-foreground font-medium">Strategy Includes</span>
                  </div>
                  <div className="space-y-2">
                    {selectedProfile.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ArrowUpRight style={{ width: 11, height: 11 }} className={selectedProfile.color} />
                        {f}
                      </div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.div>
    </Layout>
  );
}
