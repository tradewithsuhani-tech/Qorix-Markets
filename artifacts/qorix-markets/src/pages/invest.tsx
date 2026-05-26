import {
  useGetInvestment,
  useStartInvestment,
  useStopInvestment,
  useTopupInvestment,
  useToggleCompounding,
  useUpdateProtection,
  useGetWallet,
  useGetDashboardFundStats,
  getGetWalletQueryKey,
  getGetInvestmentQueryKey,
} from "@workspace/api-client-react";
import { authFetch } from "@/lib/auth-fetch";
import { Layout } from "@/components/layout";
import { AnimatedCounter } from "@/components/animated-counter";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Zap, BarChart2, Play, Square, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle, ChevronRight, Clock,
  ArrowUpRight, Info, X, Wallet, Bot, Cpu, Activity, Terminal, Sparkles, Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
    monthlyMinPct: 2,
    monthlyMaxPct: 5,
    drawdownLimit: 3,
    volatility: "Low",
    score: 1,
    color: "text-emerald-300",
    gradientFrom: "from-emerald-500/20",
    gradientTo: "to-emerald-600/5",
    borderActive: "border-emerald-400/50",
    borderIdle: "border-white/8",
    glowColor: "rgba(16,185,129,0.18)",
    glowActive: "0 0 30px rgba(16,185,129,0.22), 0 4px 24px rgba(0,0,0,0.4)",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    barColor: "#10b981",
    barWidth: "10%",
    features: [
      "Max 3% drawdown protection",
      "2–5% monthly target return",
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
    monthlyMinPct: 4,
    monthlyMaxPct: 6,
    drawdownLimit: 5,
    volatility: "Medium",
    score: 3,
    color: "text-teal-300",
    gradientFrom: "from-teal-500/20",
    gradientTo: "to-teal-600/5",
    borderActive: "border-teal-400/50",
    borderIdle: "border-white/8",
    glowColor: "rgba(20,184,166,0.18)",
    glowActive: "0 0 30px rgba(20,184,166,0.22), 0 4px 24px rgba(0,0,0,0.4)",
    badgeColor: "bg-teal-500/15 text-teal-300 border-teal-500/25",
    barColor: "#14b8a6",
    barWidth: "30%",
    features: [
      "Max 5% drawdown protection",
      "4–6% monthly target return",
      "Balanced market exposure",
    ],
    recommended: true,
  },
  {
    id: "HIGH",
    label: "Growth",
    tagline: "Maximum yield strategy",
    description: "Higher returns with active market participation. Ideal for growth-focused investors.",
    icon: Zap,
    multiplier: 1.5,
    minDailyPct: 0.75,
    maxDailyPct: 1.5,
    monthlyMinPct: 5,
    monthlyMaxPct: 8,
    drawdownLimit: 10,
    volatility: "Active",
    score: 5,
    color: "text-orange-400",
    gradientFrom: "from-orange-500/20",
    gradientTo: "to-red-600/5",
    borderActive: "border-orange-400/50",
    borderIdle: "border-white/8",
    glowColor: "rgba(249,115,22,0.15)",
    glowActive: "0 0 30px rgba(249,115,22,0.2), 0 4px 24px rgba(0,0,0,0.4)",
    badgeColor: "bg-orange-500/15 text-orange-400 border-orange-500/25",
    barColor: "#f97316",
    barWidth: "50%",
    features: [
      "Max 10% drawdown protection",
      "5–8% monthly target return",
      "Active market participation",
    ],
  },
];

const BOT_META: Record<string, {
  codename: string;
  version: string;
  model: string;
  winRate: number;
  tradesPerDay: string;
  latencyMs: number;
  uptime: string;
  pairs: number;
}> = {
  LOW: {
    codename: "QX-Sentinel",
    version: "v1.4",
    model: "defensive-grid",
    winRate: 95,
    tradesPerDay: "8–14",
    latencyMs: 18,
    uptime: "99.97%",
    pairs: 6,
  },
  MEDIUM: {
    codename: "QX-Pilot",
    version: "v2.6",
    model: "adaptive-mean-reversion",
    winRate: 83,
    tradesPerDay: "16–28",
    latencyMs: 12,
    uptime: "99.96%",
    pairs: 12,
  },
  HIGH: {
    codename: "QX-Hunter",
    version: "v3.2",
    model: "momentum-breakout",
    winRate: 75,
    tradesPerDay: "30–55",
    latencyMs: 9,
    uptime: "99.93%",
    pairs: 18,
  },
};

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
              ? score <= 3 ? "#10b981"
                : score <= 6 ? "#14b8a6"
                : "#f97316"
              : "rgba(255,255,255,0.08)",
          }}
        />
      ))}
    </div>
  );
}

function ExpectedReturns({ profile, amount, drawdownLimit }: { profile: typeof RISK_PROFILES[0]; amount: number; drawdownLimit: number }) {
  const monthlyMin = (amount * profile.monthlyMinPct) / 100;
  const monthlyMax = (amount * profile.monthlyMaxPct) / 100;
  const protection = (amount * drawdownLimit) / 100;

  return (
    <motion.div
      key={`${profile.id}-${amount}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-3"
    >
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] border border-emerald-500/20">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] text-emerald-300/90 uppercase tracking-wider font-semibold">Monthly Target Return</div>
          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            {profile.monthlyMinPct}–{profile.monthlyMaxPct}% / month
          </span>
        </div>
        <div className="font-bold text-emerald-300 text-base tabular-nums">
          +${monthlyMin.toFixed(2)} – ${monthlyMax.toFixed(2)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Tier-based projection · auto-distributed monthly
        </div>
      </div>
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Drawdown Protection</div>
          <div className="font-semibold text-sm">Max ${protection.toFixed(2)} loss</div>
        </div>
        <div className={`text-xs px-2 py-1 rounded-full border font-medium ${
          profile.drawdownLimit <= 3 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" :
          profile.drawdownLimit <= 5 ? "bg-teal-500/15 text-teal-300 border-teal-500/25" :
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
  stoppedAt?: string | null;
  totalProfit: number;
  peakBalance?: number;
  drawdownFromPeak?: number;
  recoveryPct?: number;
  autoCompound?: boolean;
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
      className="relative rounded-3xl border border-white/10 overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 0% 0%, rgba(59,130,246,0.10), transparent 55%), linear-gradient(180deg, #0a0f1a 0%, #060912 100%)",
        boxShadow:
          "0 20px 50px -25px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {/* top accent */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(59,130,246,0.55), transparent)",
        }}
      />
      {/* corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 rounded-full"
        style={{
          background: `radial-gradient(closest-side, ${barColor}33, transparent 70%)`,
        }}
      />

      <div className="relative p-5">
        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border border-emerald-400/30 shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.06))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px -6px rgba(59,130,246,0.5)",
              }}
            >
              <Shield style={{ width: 16, height: 16 }} className="text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-white tracking-tight leading-tight">
                Capital Protection
              </h3>
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/45 mt-0.5">
                drawdown · auto-pause
              </div>
            </div>
          </div>
          <span
            className={`text-[10px] px-2.5 py-1 rounded-full border font-mono font-bold uppercase tracking-[0.14em] flex items-center gap-1.5 shrink-0 ${statusBg}`}
          >
            {!isTriggered && (
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-current animate-ping opacity-60" />
                <span className="relative w-1.5 h-1.5 rounded-full bg-current" />
              </span>
            )}
            {statusLabel}
          </span>
        </div>

        {/* ── Hero gauge ─────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 mb-4 border border-white/8"
          style={{
            background: `radial-gradient(120% 100% at 0% 0%, ${barColor}18, transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))`,
          }}
        >
          <div className="flex items-end justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/55 mb-1">
                Current Drawdown
              </div>
              <div
                className={`text-2xl font-bold tabular-nums leading-none ${statusColor}`}
              >
                ${investment.drawdown.toFixed(2)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/45 mb-1">
                of capital
              </div>
              <div className={`text-base font-bold tabular-nums ${statusColor}`}>
                {drawdownPct.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Bar with markers */}
          <div className="relative h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${usagePct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
                boxShadow: `0 0 10px ${barColor}88`,
              }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono uppercase tracking-[0.12em] text-white/40 mt-2">
            <span>$0.00</span>
            <span className="text-white/55">
              limit ${((investment.amount * limitPct) / 100).toFixed(2)} · {limitPct}%
            </span>
          </div>
        </div>

        {/* ── 3 stat tiles ───────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            {
              label: "Protection",
              value: `${limitPct}%`,
              sub: `$${((investment.amount * limitPct) / 100).toFixed(2)} cap`,
              color: "#3b82f6",
            },
            {
              label: "Used",
              value: `${drawdownPct.toFixed(2)}%`,
              sub: `of ${limitPct}% limit`,
              color: barColor,
            },
            {
              label: "Remaining",
              value: `$${Math.max(0, (investment.amount * limitPct) / 100 - investment.drawdown).toFixed(2)}`,
              sub: "buffer left",
              color: "#10b981",
            },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="relative p-3 rounded-xl border border-white/10 overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.005))",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* top dot accent */}
              <div
                aria-hidden
                className="absolute top-0 left-3 right-3 h-px"
                style={{
                  background: `linear-gradient(90deg, transparent, ${s.color}88, transparent)`,
                }}
              />
              <div className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-white/55 mb-1.5 leading-tight">
                {s.label}
              </div>
              <div
                className="text-base font-bold tabular-nums leading-none break-all"
                style={{ color: s.color }}
              >
                {s.value}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/40 mt-1.5 leading-[1.3] break-words">
                {s.sub}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Limit selector ─────────────────────────────── */}
        <div className="pt-4 border-t border-white/8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-white/55">
              Adjust Protection Limit
            </div>
            <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/35">
              tap to change
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { pct: 3, label: "Conservative", tone: "#10b981" },
              { pct: 5, label: "Balanced", tone: "#6366f1" },
              { pct: 10, label: "Aggressive", tone: "#f97316" },
            ].map((opt) => {
              const active = selectedLimit === opt.pct;
              return (
                <button
                  key={opt.pct}
                  onClick={() => setPendingLimit(opt.pct)}
                  className="relative py-2.5 px-2 rounded-xl border transition-all overflow-hidden text-center"
                  style={{
                    background: active
                      ? `linear-gradient(180deg, ${opt.tone}22, ${opt.tone}08)`
                      : "rgba(255,255,255,0.02)",
                    borderColor: active ? `${opt.tone}66` : "rgba(255,255,255,0.08)",
                    boxShadow: active
                      ? `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 18px -6px ${opt.tone}`
                      : "none",
                  }}
                >
                  <div
                    className="text-base font-bold tabular-nums leading-none"
                    style={{ color: active ? opt.tone : "rgba(255,255,255,0.85)" }}
                  >
                    {opt.pct}%
                  </div>
                  <div
                    className="text-[8.5px] font-mono uppercase tracking-[0.12em] mt-1 leading-tight"
                    style={{
                      color: active ? `${opt.tone}cc` : "rgba(255,255,255,0.35)",
                    }}
                  >
                    {opt.label}
                  </div>
                  {active && (
                    <div
                      aria-hidden
                      className="absolute bottom-0 left-2 right-2 h-px"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${opt.tone}, transparent)`,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {hasChanges && (
              <motion.button
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onClick={() => setShowConfirm(true)}
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 border border-emerald-400/40"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(59,130,246,0.9), rgba(37,99,235,0.95))",
                  boxShadow: "0 0 22px -6px rgba(59,130,246,0.65)",
                }}
              >
                <CheckCircle style={{ width: 13, height: 13 }} /> Review Change
              </motion.button>
            )}
          </AnimatePresence>
        </div>
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
            <Shield style={{ width: 16, height: 16 }} className="text-emerald-400" />
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
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
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
            <div className={`p-3 rounded-xl border ${recoveryPct > 0 ? "bg-emerald-500/8 border-emerald-500/20" : "bg-emerald-500/8 border-emerald-500/20"}`}>
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Recovery Target</div>
              {recoveryPct > 0 ? (
                <>
                  <div className="text-base font-bold text-emerald-400 tabular-nums">+{recoveryPct.toFixed(2)}%</div>
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
              className="flex-1 flex items-center justify-center gap-2 py-3 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-sm transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]"
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
            { icon: TrendingUp, text: `You started trading with $${investment.amount.toFixed(2)} USD at ${activeProfile.label} risk. Peak balance reached: $${peakBalance.toFixed(2)}.`, color: "text-emerald-400" },
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
  const [topupAmount, setTopupAmount] = useState("");
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [riskChangeChoice, setRiskChangeChoice] = useState<string | null>(null);
  const [isChangingRisk, setIsChangingRisk] = useState(false);

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
        toast({ title: "Investment Stopped", description: "Funds returned to funding balance." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
      },
      onError: (err: any) => {
        toast({ title: "Failed to stop", description: err.message, variant: "destructive" });
      },
    },
  });

  const topupMutation = useTopupInvestment({
    mutation: {
      onSuccess: () => {
        toast({ title: "Top-Up Successful", description: "Funds added to your active investment." });
        queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        setTopupAmount("");
        setShowTopupModal(false);
      },
      onError: (err: any) => {
        toast({ title: "Top-Up Failed", description: err.message, variant: "destructive" });
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

  const handleChangeRiskLevel = async (newLevel: string) => {
    setIsChangingRisk(true);
    try {
      await authFetch("/api/investment/risk-level", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskLevel: newLevel.toLowerCase() }),
      });
      toast({
        title: "Risk level change queued",
        description: `Your risk level will change to ${newLevel.charAt(0).toUpperCase() + newLevel.slice(1).toLowerCase()} from the next trading day.`,
      });
      queryClient.invalidateQueries({ queryKey: getGetInvestmentQueryKey() });
      setRiskChangeChoice(null);
    } catch (err: any) {
      toast({ title: "Update failed", description: err?.message ?? "Could not update risk level.", variant: "destructive" });
    } finally {
      setIsChangingRisk(false);
    }
  };

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
        {/* Header — Premium bot console */}
        {!investment?.isActive && !investment?.isPaused ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl border border-white/[0.08] overflow-hidden"
            style={{
              background:
                "radial-gradient(ellipse at top left, rgba(59,130,246,0.12), transparent 50%), radial-gradient(ellipse at bottom right, rgba(139,92,246,0.10), transparent 55%), linear-gradient(135deg, rgba(15,23,42,0.7) 0%, rgba(2,6,23,0.85) 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.06), 0 30px 60px -30px rgba(59,130,246,0.25)",
            }}
          >
            {/* Subtle grid backdrop */}
            <div
              className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(96,165,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.5) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />
            {/* Top accent line */}
            <div
              className="absolute top-0 left-8 right-8 h-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(96,165,250,0.5), rgba(167,139,250,0.5), transparent)",
              }}
            />
            {/* Scanning beam */}
            <motion.div
              className="absolute inset-x-0 h-24 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, transparent, rgba(96,165,250,0.06), transparent)",
              }}
              initial={{ y: "-100%" }}
              animate={{ y: "400%" }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />

            <div className="relative p-5 sm:p-6">
              {/* Hero row */}
              <div className="flex items-start gap-4">
                {/* Premium bot avatar */}
                <div className="relative shrink-0">
                  {/* Outer glow */}
                  <div
                    className="absolute -inset-3 rounded-3xl blur-xl opacity-60"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)",
                    }}
                  />
                  {/* Spinning conic ring */}
                  <div
                    className="absolute -inset-1.5 rounded-2xl"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent, rgba(96,165,250,0.6), transparent, rgba(167,139,250,0.5), transparent)",
                      animation: "spin 5s linear infinite",
                    }}
                  />
                  {/* Inner avatar */}
                  <div
                    className="relative w-16 h-16 rounded-2xl flex items-center justify-center border border-emerald-400/30"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.10) 100%)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 24px rgba(59,130,246,0.2)",
                    }}
                  >
                    <Bot style={{ width: 28, height: 28 }} className="text-emerald-200" />
                  </div>
                  {/* Live status dot */}
                  <span className="absolute -top-0.5 -right-0.5 flex w-3.5 h-3.5">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                    <span className="relative w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black/70" />
                  </span>
                </div>

                {/* Title block */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-300/90"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.04))",
                      }}
                    >
                      v3.1
                    </span>
                    <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-slate-500">
                      qorix · ai trading
                    </span>
                  </div>
                  <h1
                    className="text-2xl md:text-3xl font-bold tracking-tight leading-[1.15] mb-1.5"
                    style={{
                      background:
                        "linear-gradient(135deg, #ffffff 0%, #cbd5e1 60%, #6ee7b7 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    AI Trading Bot Setup
                  </h1>
                  <p className="text-slate-400 text-sm leading-snug">
                    Three quick steps to calibrate your bot.
                  </p>
                </div>
              </div>

              {/* Console status strip */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Engine", value: "ONLINE", color: "text-emerald-300", dot: "bg-emerald-400" },
                  { label: "Latency", value: "12ms", color: "text-emerald-300", dot: "bg-emerald-400" },
                  { label: "Uptime", value: "99.96%", color: "text-emerald-300", dot: "bg-emerald-400" },
                  { label: "Status", value: "AWAITING", color: "text-amber-300", dot: "bg-amber-400" },
                ].map((s, idx) => (
                  <div
                    key={s.label}
                    className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-black/30 border border-white/[0.06] backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${idx < 2 ? "animate-pulse" : ""}`} />
                      <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground">{s.label}</span>
                    </div>
                    <span className={`text-[11px] font-mono font-bold tabular-nums ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Terminal command line */}
              <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-emerald-300/90 overflow-x-auto whitespace-nowrap">
                <Terminal style={{ width: 12, height: 12 }} className="shrink-0 text-emerald-400" />
                <span className="text-emerald-400">qorix-bot</span>
                <span className="text-muted-foreground">~</span>
                <span className="text-emerald-300">$</span>
                <span className="text-slate-300">init --calibrate</span>
                <span className="ml-0.5 inline-block w-1.5 h-3 bg-emerald-400 animate-pulse" />
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex items-start gap-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-green-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(16,185,129,0.3)]"
            >
              <Bot style={{ width: 22, height: 22 }} className="text-emerald-300" />
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black/60 animate-pulse" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Trading Bot</h1>
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 font-bold">v3.1</span>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">
                Live trading desk — monitor performance and controls below.
              </p>
            </div>
          </div>
        )}

        {/* Limited Slots Banner */}
        {fundStats && fundStats.maxSlots > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border ${
              fundStats.isFull
                ? "bg-red-500/8 border-red-500/25"
                : fundStats.availableSlots != null && fundStats.availableSlots <= Math.ceil(fundStats.maxSlots * 0.2)
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
            <div className="animate-spin w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full" />
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
            {/* Active Banner — Premium */}
            {(() => {
              const meta = BOT_META[activeProfile.id]!;
              const ddMax = (investment.amount * activeProfile.drawdownLimit) / 100;
              const ddPct = ddMax > 0 ? Math.min((investment.drawdown / ddMax) * 100, 100) : 0;
              const roi = investment.amount > 0 ? (investment.totalProfit / investment.amount) * 100 : 0;
              return (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-3xl overflow-hidden border border-white/10"
              style={{
                background:
                  "radial-gradient(120% 80% at 50% -10%, rgba(16,185,129,0.12), transparent 60%), linear-gradient(180deg, #0a0f1a 0%, #060912 100%)",
                boxShadow:
                  "0 30px 60px -25px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* Top accent line */}
              <div
                aria-hidden
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(16,185,129,0.55), transparent)",
                }}
              />
              {/* Corner sheen */}
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(59,130,246,0.18), transparent 70%)",
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-32 -left-24 w-72 h-72 rounded-full"
                style={{
                  background:
                    "radial-gradient(closest-side, rgba(16,185,129,0.10), transparent 70%)",
                }}
              />

              <div className="relative p-6 md:p-7">
                {/* ── Header ─────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Bot avatar */}
                    <div className="relative shrink-0">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(16,185,129,0.18))",
                          boxShadow:
                            "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 22px -6px rgba(59,130,246,0.45)",
                        }}
                      >
                        <Bot style={{ width: 22, height: 22 }} className="text-white" />
                      </div>
                      {/* Live ring */}
                      <span
                        aria-hidden
                        className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#060912]"
                        style={{
                          background: "#10b981",
                          boxShadow: "0 0 10px rgba(16,185,129,0.8)",
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-emerald-300/85">
                          {meta.codename}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-px rounded border border-white/10 text-white/55">
                          {meta.version}
                        </span>
                      </div>
                      <div className="text-lg md:text-xl font-bold text-white tracking-tight leading-tight">
                        {activeProfile.label} Strategy
                      </div>
                      <div className="text-[11px] text-white/50 mt-0.5 truncate">
                        {meta.model} · {meta.pairs} pairs
                      </div>
                    </div>
                  </div>

                  {/* Live pill */}
                  <div
                    className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/30"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))",
                    }}
                  >
                    <span className="relative flex w-2 h-2">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                      <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-emerald-300">
                      Live
                    </span>
                  </div>
                </div>

                {/* ── Hero KPI: Total Profit + Equity Sparkline ── */}
                <div
                  className="rounded-2xl p-5 mb-5 border border-emerald-400/15 relative overflow-hidden"
                  style={{
                    background:
                      "radial-gradient(120% 120% at 0% 0%, rgba(16,185,129,0.18), transparent 55%), linear-gradient(180deg, rgba(6,15,12,0.7), rgba(6,9,18,0.4))",
                  }}
                >
                  {/* Animated grid */}
                  <div
                    aria-hidden
                    className="absolute inset-0 opacity-[0.05] pointer-events-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />
                  {/* Scanning beam */}
                  <motion.div
                    aria-hidden
                    className="absolute top-0 bottom-0 w-24 pointer-events-none"
                    initial={{ left: "-15%" }}
                    animate={{ left: "115%" }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(16,185,129,0.10), transparent)",
                    }}
                  />
                  {/* Glow orb */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -top-20 -right-10 w-56 h-56 rounded-full"
                    style={{
                      background:
                        "radial-gradient(closest-side, rgba(16,185,129,0.28), transparent 70%)",
                    }}
                  />

                  <div className="relative flex items-end justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Sparkles
                          style={{ width: 12, height: 12 }}
                          className="text-emerald-300"
                        />
                        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300/85 font-bold">
                          Total Profit
                        </span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-px rounded-full border border-emerald-400/35 text-emerald-200 bg-emerald-500/10">
                          +{roi.toFixed(2)}%
                        </span>
                      </div>
                      <div
                        className="text-4xl md:text-5xl font-black tabular-nums tracking-tight leading-none"
                        style={{
                          background:
                            "linear-gradient(135deg, #ffffff 0%, #a7f3d0 50%, #34d399 100%)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          textShadow: "0 0 40px rgba(16,185,129,0.15)",
                        }}
                      >
                        <AnimatedCounter value={investment.totalProfit} prefix="$" />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/50 mb-1">
                        Today
                      </div>
                      <div className="text-lg font-bold text-emerald-300 tabular-nums flex items-center gap-1 justify-end">
                        <ArrowUpRight style={{ width: 14, height: 14 }} />
                        <AnimatedCounter value={investment.dailyProfit} prefix="$" />
                      </div>
                    </div>
                  </div>

                  {/* Equity sparkline */}
                  <div className="relative h-14 -mx-1">
                    <svg
                      viewBox="0 0 200 50"
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full"
                    >
                      <defs>
                        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="sparkLine" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="1" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const seed = Math.max(1, investment.amount + investment.totalProfit * 7);
                        const rng = (i: number) =>
                          (Math.sin(seed * 0.013 + i * 1.7) + 1) / 2;
                        const pts = Array.from({ length: 24 }, (_, i) => {
                          const x = (i / 23) * 200;
                          const trend = 42 - (i / 23) * 30;
                          const noise = (rng(i) - 0.5) * 8;
                          return [x, Math.max(4, Math.min(46, trend + noise))] as const;
                        });
                        const path = pts
                          .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
                          .join(" ");
                        const area = `${path} L200,50 L0,50 Z`;
                        const last = pts[pts.length - 1]!;
                        return (
                          <>
                            <motion.path
                              d={area}
                              fill="url(#sparkFill)"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: 0.6 }}
                            />
                            <motion.path
                              d={path}
                              stroke="url(#sparkLine)"
                              strokeWidth="1.6"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 1.2, ease: "easeOut" }}
                            />
                            <motion.circle
                              cx={last[0]}
                              cy={last[1]}
                              r="2.5"
                              fill="#10b981"
                              initial={{ scale: 0 }}
                              animate={{ scale: [1, 1.6, 1] }}
                              transition={{
                                duration: 1.6,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                            <circle cx={last[0]} cy={last[1]} r="1.4" fill="#fff" />
                          </>
                        );
                      })()}
                    </svg>
                  </div>

                  {/* Mini scale row */}
                  <div className="relative flex items-center justify-between text-[9px] font-mono uppercase tracking-[0.15em] text-white/35 mt-1">
                    <span>24h equity</span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      live
                    </span>
                  </div>
                </div>

                {/* ── Stat grid (premium with rings) ─────────────── */}
                <div className="grid grid-cols-3 gap-2.5 mb-3">
                  {[
                    {
                      label: "Funding Wallet",
                      icon: Wallet,
                      value: <AnimatedCounter value={investment.amount} prefix="$" />,
                      sub: "active capital",
                      tone: "text-white",
                      ringColor: "#3b82f6",
                      ringPct: 100,
                      glow: "rgba(59,130,246,0.18)",
                      tint: "rgba(59,130,246,0.08)",
                    },
                    {
                      label: "Drawdown",
                      icon: Shield,
                      value: `$${investment.drawdown.toFixed(2)}`,
                      sub: `${ddPct.toFixed(0)}% of cap`,
                      tone: "text-orange-300",
                      ringColor: "#f97316",
                      ringPct: ddPct,
                      glow: "rgba(249,115,22,0.22)",
                      tint: "rgba(249,115,22,0.08)",
                    },
                    {
                      label: "Win Rate",
                      icon: TrendingUp,
                      value: `${meta.winRate}%`,
                      sub: `${meta.tradesPerDay} trades/d`,
                      tone: "text-emerald-300",
                      ringColor: "#10b981",
                      ringPct: meta.winRate,
                      glow: "rgba(16,185,129,0.22)",
                      tint: "rgba(16,185,129,0.08)",
                    },
                  ].map((item, i) => {
                    const R = 18;
                    const C = 2 * Math.PI * R;
                    const offset = C - (Math.min(item.ringPct, 100) / 100) * C;
                    return (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.08 }}
                        className="relative rounded-2xl p-3 border border-white/10 overflow-hidden"
                        style={{
                          background: `radial-gradient(110% 90% at 100% 0%, ${item.tint}, transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 6px 20px -10px ${item.glow}`,
                        }}
                      >
                        {/* corner sheen */}
                        <div
                          aria-hidden
                          className="pointer-events-none absolute -top-8 -right-8 w-20 h-20 rounded-full"
                          style={{
                            background: `radial-gradient(closest-side, ${item.glow}, transparent 70%)`,
                          }}
                        />

                        {/* Ring + label header */}
                        <div className="relative flex items-center justify-between gap-2 mb-2.5">
                          <div className="relative w-9 h-9 shrink-0">
                            <svg viewBox="0 0 44 44" className="w-9 h-9 -rotate-90">
                              <circle
                                cx="22"
                                cy="22"
                                r={R}
                                stroke="rgba(255,255,255,0.08)"
                                strokeWidth="3"
                                fill="none"
                              />
                              <motion.circle
                                cx="22"
                                cy="22"
                                r={R}
                                stroke={item.ringColor}
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={C}
                                initial={{ strokeDashoffset: C }}
                                animate={{ strokeDashoffset: offset }}
                                transition={{
                                  duration: 1.1,
                                  ease: "easeOut",
                                  delay: 0.2 + i * 0.08,
                                }}
                                style={{
                                  filter: `drop-shadow(0 0 4px ${item.ringColor})`,
                                }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <item.icon
                                style={{ width: 12, height: 12 }}
                                className="text-white/85"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Label — full width, can wrap */}
                        <div className="text-[9px] font-mono font-bold uppercase tracking-[0.14em] text-white/55 leading-[1.25] mb-1.5 break-words">
                          {item.label}
                        </div>

                        {/* Value */}
                        <div
                          className={`text-[15px] sm:text-[17px] font-bold tabular-nums leading-none ${item.tone} break-all`}
                        >
                          {item.value}
                        </div>

                        {/* Sub-line — wraps freely */}
                        <div className="text-[9px] font-mono uppercase tracking-[0.1em] text-white/40 mt-1.5 leading-[1.3] break-words">
                          {item.sub}
                        </div>

                        {/* bottom accent */}
                        <div
                          aria-hidden
                          className="absolute bottom-0 left-3 right-3 h-px"
                          style={{
                            background: `linear-gradient(90deg, transparent, ${item.ringColor}55, transparent)`,
                          }}
                        />
                      </motion.div>
                    );
                  })}
                </div>

                {/* ── Telemetry strip ────────────────────────────── */}
                <div
                  className="rounded-xl border border-white/8 px-3 py-2.5 mb-3 grid grid-cols-3 gap-2"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
                  }}
                >
                  {[
                    { icon: Activity, label: "Trades/d", value: meta.tradesPerDay },
                    { icon: Zap, label: "Latency", value: `${meta.latencyMs}ms` },
                    { icon: Cpu, label: "Uptime", value: meta.uptime },
                  ].map((t) => (
                    <div key={t.label} className="flex items-center gap-2 min-w-0">
                      <t.icon
                        style={{ width: 12, height: 12 }}
                        className="text-white/40 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono uppercase tracking-[0.12em] text-white/45 leading-none">
                          {t.label}
                        </div>
                        <div className="text-[11px] font-mono font-semibold text-white/85 tabular-nums leading-tight mt-0.5 truncate">
                          {t.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Action Row: Compounding + Top Up + Stop Trading ── */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 mb-5 border-t border-white/8">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={investment.autoCompound}
                      onCheckedChange={(checked) => compoundMutation.mutate({ data: { autoCompound: checked } })}
                    />
                    <span className="text-sm font-medium flex items-center gap-2">
                      <RefreshCw style={{ width: 14, height: 14 }} className="text-emerald-400" />
                      Auto-Compound Profits
                    </span>
                    {investment.autoCompound && (
                      <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-full">ON</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowTopupModal(true)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/15 border border-blue-500/25 rounded-xl font-medium transition-all text-sm"
                    >
                      <Plus style={{ width: 14, height: 14 }} />
                      Top Up
                    </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        disabled={stopMutation.isPending}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/15 border border-red-500/25 rounded-xl font-medium transition-all text-sm disabled:opacity-50"
                      >
                        <Square style={{ width: 14, height: 14 }} />
                        {stopMutation.isPending ? "Stopping..." : "Stop Trading"}
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent
                      className="max-w-md border-red-500/30 bg-[#0a0d12] rounded-2xl p-0 gap-0 overflow-hidden shadow-[0_0_60px_-15px_rgba(239,68,68,0.35)]"
                    >
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full bg-red-500/15 blur-3xl"
                      />
                      <div className="relative p-6 pb-5">
                        <AlertDialogHeader className="space-y-0">
                          <div className="flex items-start gap-3.5">
                            <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0 shadow-[0_0_16px_-4px_rgba(239,68,68,0.4)]">
                              <Square style={{ width: 18, height: 18 }} className="text-red-300" />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <AlertDialogTitle className="text-xl font-bold text-white tracking-tight">
                                Stop Trading?
                              </AlertDialogTitle>
                              <p className="text-[11px] uppercase tracking-[0.18em] text-red-300/80 font-semibold mt-1">
                                This will halt your active strategy
                              </p>
                            </div>
                          </div>
                          <AlertDialogDescription className="pt-5 text-sm text-white/65 leading-relaxed">
                            Daily profits will stop being credited from the next cycle.
                            Your capital is{" "}
                            <span className="text-white font-medium">never locked</span>
                            {" "}— you can resume or redeploy anytime.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                              <Shield style={{ width: 15, height: 15 }} className="text-emerald-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80 font-semibold">
                                Capital Safe
                              </p>
                              <p className="text-sm text-white font-semibold mt-0.5 tabular-nums">
                                ${investment.amount.toFixed(2)}{" "}
                                <span className="text-white/50 font-normal">stays in funding balance</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <AlertDialogFooter className="!flex-row !justify-stretch gap-2.5 px-6 pb-6 pt-4 sm:!space-x-0 border-t border-white/5 bg-white/[0.015]">
                        <AlertDialogCancel className="!mt-0 flex-1 h-11 border-white/10 bg-white/[0.04] text-white/85 hover:bg-white/[0.08] hover:text-white hover:border-white/20 rounded-xl font-semibold transition-all">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => stopMutation.mutate()}
                          className="flex-1 h-11 bg-gradient-to-b from-red-500 to-red-600 text-white border border-red-400/40 hover:from-red-400 hover:to-red-500 rounded-xl font-semibold transition-all shadow-[0_0_20px_-6px_rgba(239,68,68,0.55)] flex items-center justify-center gap-2"
                        >
                          <Square style={{ width: 13, height: 13 }} />
                          Stop Trading
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  </div>
                </div>

                {/* Risk Meter */}
                <div className="mb-5">
                  <div className="flex justify-between items-center text-[11px] mb-2">
                    <span className="text-white/55 font-medium uppercase tracking-wider text-[10px] font-mono">
                      Risk Exposure
                    </span>
                    <span className={`font-semibold ${activeProfile.color}`}>
                      {activeProfile.volatility} · {activeProfile.score}/10
                    </span>
                  </div>
                  <RiskMeter score={activeProfile.score} />
                </div>

                {/* Drawdown Progress */}
                <div className="mb-5">
                  <div className="flex justify-between items-center text-[11px] mb-2">
                    <span className="text-white/55 font-medium uppercase tracking-wider text-[10px] font-mono">
                      Drawdown Usage
                    </span>
                    <span className="text-white/65 tabular-nums">
                      ${investment.drawdown.toFixed(2)}{" "}
                      <span className="text-white/40">/ ${ddMax.toFixed(2)}</span>
                    </span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${ddPct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${activeProfile.barColor}, ${activeProfile.barColor}99)`,
                        boxShadow: `0 0 10px ${activeProfile.barColor}66`,
                      }}
                    />
                  </div>
                </div>

              </div>
            </motion.div>
              );
            })()}

            {/* Features of current profile */}
            <div className="glass-card p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Info style={{ width: 14, height: 14 }} className="text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Active Strategy Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(() => {
                  // Map drawdown limit -> matching strategy tier so the whole
                  // panel stays consistent when user changes protection limit.
                  const lim = investment.drawdownLimit;
                  const tierProfile =
                    lim <= 3 ? RISK_PROFILES[0]! :
                    lim <= 5 ? RISK_PROFILES[1]! :
                    RISK_PROFILES[2]!;
                  return tierProfile.features.map((f, i) => {
                    const displayed = i === 0 && /drawdown protection/i.test(f)
                      ? `Max ${lim}% drawdown protection`
                      : f;
                    return (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle style={{ width: 14, height: 14 }} className={tierProfile.color} />
                        <span className="text-muted-foreground">{displayed}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Pending Risk Level Banner */}
            <AnimatePresence>
              {investment.pendingRiskLevel && (
                <motion.div
                  key="pending-risk-banner"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07]"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
                    <Clock style={{ width: 15, height: 15 }} className="text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-300">
                      Risk level changing to{" "}
                      <span className="capitalize">{investment.pendingRiskLevel}</span> tomorrow
                    </p>
                    <p className="text-xs text-amber-200/60 mt-0.5 leading-relaxed">
                      Your current strategy stays active today. The new risk level takes effect from the next trading session.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Change Risk Level Panel */}
            <div className="glass-card p-5 rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <BarChart2 style={{ width: 14, height: 14 }} className="text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Change Risk Level</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 font-semibold uppercase tracking-wide ml-auto">
                  Effective tomorrow
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Select a new risk level. Today's profit continues at the current rate — the change takes effect from the next trading day.
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {RISK_PROFILES.map((profile) => {
                  const isCurrent = profile.id === investment.riskLevel?.toUpperCase();
                  const isPendingTarget = investment.pendingRiskLevel?.toUpperCase() === profile.id;
                  const isSelected = riskChangeChoice === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      disabled={isCurrent && !investment.pendingRiskLevel}
                      onClick={() => setRiskChangeChoice(isSelected ? null : profile.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all text-sm font-semibold
                        ${isCurrent && !investment.pendingRiskLevel
                          ? "border-white/10 bg-white/[0.03] text-white/30 cursor-default"
                          : isSelected
                            ? "border-blue-500/50 bg-blue-500/15 text-blue-300"
                            : isPendingTarget
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.06]"
                        }`}
                    >
                      {isPendingTarget && (
                        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-px rounded-full bg-amber-500 text-black uppercase tracking-wide">
                          Pending
                        </span>
                      )}
                      {isCurrent && !investment.pendingRiskLevel && (
                        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-px rounded-full bg-emerald-500 text-black uppercase tracking-wide">
                          Active
                        </span>
                      )}
                      <span className={profile.color}>{profile.label}</span>
                      <span className="text-[10px] font-normal text-white/45">{profile.drawdownLimit}% limit</span>
                    </button>
                  );
                })}
              </div>
              {riskChangeChoice && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 pt-1"
                >
                  <button
                    type="button"
                    disabled={isChangingRisk}
                    onClick={() => handleChangeRiskLevel(riskChangeChoice)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {isChangingRisk
                      ? "Queuing change..."
                      : `Switch to ${RISK_PROFILES.find(p => p.id === riskChangeChoice)?.label ?? riskChangeChoice} tomorrow`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiskChangeChoice(null)}
                    className="p-2.5 rounded-xl border border-white/10 text-white/50 hover:bg-white/[0.06] transition-all"
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </motion.div>
              )}
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
            {/* Post-Stop Banner: shown when user has previously stopped an
                investment but hasn't deployed a new one yet. Reassures them
                that their capital is safe and withdrawable. */}
            {investment?.stoppedAt && !investment.isActive && !investment.isPaused && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="lg:col-span-5 relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.03] to-transparent p-4 sm:p-5"
              >
                <div
                  aria-hidden
                  className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl pointer-events-none"
                />
                <div className="relative flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <Wallet style={{ width: 18, height: 18 }} className="text-amber-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-[15px] font-semibold text-white">
                      Trading stopped on{" "}
                      <span className="text-amber-300">
                        {new Date(investment.stoppedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
                      Your{" "}
                      <span className="text-amber-300 font-semibold tabular-nums">
                        ${investment.amount.toFixed(2)}
                      </span>{" "}
                      capital is safe and ready to withdraw — or deploy a new strategy below.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Left: Strategy Selection + Amount */}
            <div className="lg:col-span-3 space-y-5">

              {/* Risk Profile Cards */}
              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">STEP 01</span>
                    <h2 className="font-semibold">Choose Bot Personality</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">3 presets</span>
                </div>
                <div className="space-y-4">
                  {RISK_PROFILES.map((profile, i) => {
                    const isSelected = riskLevel === profile.id;
                    const meta = BOT_META[profile.id]!;
                    return (
                      <motion.button
                        key={profile.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07, duration: 0.4 }}
                        onClick={() => setRiskLevel(profile.id)}
                        className={`w-full text-left rounded-3xl border transition-all duration-300 relative overflow-hidden group ${
                          isSelected
                            ? `${profile.borderActive}`
                            : "border-white/[0.06] hover:border-white/15"
                        }`}
                        style={
                          isSelected
                            ? {
                                background:
                                  `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)`,
                                boxShadow: `0 0 0 1px ${profile.glowColor}, 0 20px 40px -20px ${profile.glowColor}, inset 0 1px 0 rgba(255,255,255,0.06)`,
                              }
                            : {
                                background:
                                  "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                              }
                        }
                      >
                        {/* Ambient color wash on selection */}
                        {isSelected && (
                          <div
                            className={`absolute inset-0 bg-gradient-to-br ${profile.gradientFrom} ${profile.gradientTo} opacity-60 pointer-events-none`}
                          />
                        )}
                        {/* Top accent line */}
                        <div
                          className="absolute top-0 left-6 right-6 h-px pointer-events-none"
                          style={{
                            background: isSelected
                              ? `linear-gradient(90deg, transparent, ${profile.barColor}, transparent)`
                              : "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
                          }}
                        />
                        {/* Corner sheen */}
                        <div
                          className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-50"
                          style={{ background: isSelected ? profile.glowColor : "transparent" }}
                        />

                        <div className="relative p-5 sm:p-6">
                          {/* Header strip: codename · version · status · recommended */}
                          <div className="flex items-center justify-between gap-2 mb-5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`font-mono text-[11px] font-bold tracking-wider truncate ${
                                isSelected ? profile.color : "text-slate-300"
                              }`}>
                                {meta.codename}
                              </span>
                              <span className="text-[9px] font-mono text-muted-foreground/80 border border-white/10 px-1.5 py-px rounded">
                                {meta.version}
                              </span>
                              <span className="text-[9px] font-mono text-emerald-400/90 flex items-center gap-1 shrink-0">
                                <span className="relative flex w-1.5 h-1.5">
                                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                                  <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                </span>
                                LIVE
                              </span>
                            </div>
                            {profile.recommended && (
                              <span className="text-[9px] px-2 py-0.5 bg-gradient-to-r from-emerald-500/25 to-teal-500/25 text-emerald-200 border border-emerald-400/40 rounded-full font-bold uppercase tracking-wider shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                                ★ Recommended
                              </span>
                            )}
                          </div>

                          {/* Hero row: avatar + personality */}
                          <div className="flex items-center gap-4 mb-5">
                            {/* Premium bot avatar */}
                            <div className="relative shrink-0">
                              {/* Outer glow ring */}
                              {isSelected && (
                                <div
                                  className="absolute -inset-2 rounded-3xl blur-md opacity-70"
                                  style={{ background: `radial-gradient(circle, ${profile.glowColor} 0%, transparent 70%)` }}
                                />
                              )}
                              {/* Rotating ring */}
                              <div className={`absolute -inset-1 rounded-2xl ${isSelected ? "opacity-100" : "opacity-0"} transition-opacity`}
                                style={{
                                  background: `conic-gradient(from 0deg, transparent, ${profile.barColor}55, transparent, transparent)`,
                                  animation: isSelected ? "spin 4s linear infinite" : undefined,
                                }}
                              />
                              <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center ${
                                isSelected
                                  ? `bg-gradient-to-br ${profile.gradientFrom} ${profile.gradientTo} border ${profile.borderActive}`
                                  : "bg-white/[0.04] border border-white/10"
                              }`}>
                                <Bot style={{ width: 24, height: 24 }} className={isSelected ? profile.color : "text-slate-400"} />
                              </div>
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="text-xl font-bold tracking-tight text-white leading-tight mb-0.5">
                                {profile.label}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.15em] truncate">
                                {meta.model}
                              </div>
                            </div>

                            <AnimatePresence>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${profile.badgeColor} border`}
                                >
                                  <CheckCircle style={{ width: 14, height: 14 }} />
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Description */}
                          <p className="text-[13px] text-slate-400 leading-relaxed mb-5">
                            {profile.description}
                          </p>

                          {/* Telemetry strip — clean inline */}
                          <div className="grid grid-cols-3 rounded-2xl bg-black/40 border border-white/[0.06] overflow-hidden mb-4">
                            <div className="px-3 py-3 border-r border-white/[0.06]">
                              <div className="text-[9px] text-muted-foreground/80 uppercase tracking-[0.12em] font-mono mb-0.5">Win Rate</div>
                              <div className={`text-base font-bold tabular-nums ${profile.color}`}>{meta.winRate}<span className="text-xs opacity-70">%</span></div>
                            </div>
                            <div className="px-3 py-3 border-r border-white/[0.06]">
                              <div className="text-[9px] text-muted-foreground/80 uppercase tracking-[0.12em] font-mono mb-0.5">Trades/d</div>
                              <div className="text-base font-bold tabular-nums text-white">{meta.tradesPerDay}</div>
                            </div>
                            <div className="px-3 py-3">
                              <div className="text-[9px] text-muted-foreground/80 uppercase tracking-[0.12em] font-mono mb-0.5">Latency</div>
                              <div className="text-base font-bold tabular-nums text-emerald-300">{meta.latencyMs}<span className="text-xs opacity-70">ms</span></div>
                            </div>
                          </div>

                          {/* Footer pills */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${profile.badgeColor}`}>
                              {profile.monthlyMinPct}–{profile.monthlyMaxPct}% / month
                            </span>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 font-mono">
                              DD≤{profile.drawdownLimit}%
                            </span>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-slate-400 font-mono">
                              {meta.pairs} pairs
                            </span>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/15 text-emerald-300/90 font-mono">
                              ↑ {meta.uptime}
                            </span>
                          </div>

                          {/* Risk Meter Bar — only when selected */}
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="relative mt-5 pt-4 border-t border-white/[0.06]"
                            >
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-2 font-mono uppercase tracking-[0.12em]">
                                <span>Risk Exposure</span>
                                <span className={`font-bold ${profile.color}`}>{profile.score}/10</span>
                              </div>
                              <RiskMeter score={profile.score} />
                            </motion.div>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Amount Input */}
              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/25">STEP 02</span>
                    <h2 className="font-semibold">Fund the Bot</h2>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Available:{" "}
                    <span className="text-emerald-300 font-semibold">${maxAmount.toFixed(2)} USD</span>
                  </span>
                </div>

                <div className="relative mb-3">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-2xl font-bold text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 focus:outline-none pr-24 transition-all"
                    placeholder="0.00"
                    min="0"
                    max={maxAmount}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button
                      onClick={() => setAmount(String(Math.floor(maxAmount * 100) / 100))}
                      className="text-xs text-emerald-300 font-semibold px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition border border-emerald-500/20"
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
                    Exceeds available funding balance
                  </motion.div>
                )}
              </div>
            </div>

            {/* Right: Summary + Deploy */}
            <div className="lg:col-span-2 space-y-4">
              {/* Capital Protection Setup */}
              <div className="glass-card p-5 rounded-2xl">
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-[10px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">STEP 03</span>
                  <Shield style={{ width: 15, height: 15 }} className="text-emerald-400" />
                  <h3 className="font-semibold text-sm">Safety Circuit Breaker</h3>
                  <span className="ml-auto text-xs bg-green-500/15 text-green-400 border border-green-500/25 px-2 py-0.5 rounded-full">Armed</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Bot auto-pauses if drawdown hits your limit — your capital stays safe.
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
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.18)]"
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
                      key={`${selectedProfile.id}-${numAmount}-${pendingLimit ?? selectedProfile.drawdownLimit}`}
                      profile={selectedProfile}
                      amount={numAmount}
                      drawdownLimit={pendingLimit ?? (RISK_DEFAULT_DRAWDOWN[riskLevel.toLowerCase()] ?? selectedProfile.drawdownLimit)}
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
                <div className="flex items-center gap-2 mb-4">
                  <Cpu style={{ width: 15, height: 15 }} className="text-emerald-400" />
                  <h3 className="font-semibold text-sm">Bot Configuration</h3>
                  <span className="ml-auto text-[10px] font-mono text-emerald-300/80">READY TO DEPLOY</span>
                </div>
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: "Capital", value: numAmount > 0 ? `$${numAmount.toFixed(2)} USD` : "—" },
                    { label: "Strategy", value: selectedProfile.label },
                    {
                      // User receives payouts monthly. Use the monthly target
                      // range defined on the profile itself (matches the
                      // numbers already shown in the strategy card features).
                      label: "Monthly Target",
                      value: `${selectedProfile.monthlyMinPct}–${selectedProfile.monthlyMaxPct}%`,
                      highlight: true,
                    },
                    { label: "Risk Level", value: selectedProfile.volatility },
                    { label: "Drawdown Limit", value: `${pendingLimit ?? (RISK_DEFAULT_DRAWDOWN[riskLevel.toLowerCase()] ?? selectedProfile.drawdownLimit)}%` },
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
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.35)]"
                      : "bg-white/5 text-muted-foreground cursor-not-allowed border border-white/8"
                  }`}
                >
                  {startMutation.isPending ? (
                    <>
                      <RefreshCw style={{ width: 15, height: 15 }} className="animate-spin" />
                      Booting bot…
                    </>
                  ) : (
                    <>
                      <Bot style={{ width: 16, height: 16 }} />
                      Activate Bot
                      <ChevronRight style={{ width: 14, height: 14 }} className="opacity-60" />
                    </>
                  )}
                </motion.button>

                {!canDeploy && numAmount === 0 && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Fund the bot to activate
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
                    <span className="text-xs text-muted-foreground font-medium">Bot Capabilities</span>
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

      {/* ── Top Up Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showTopupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => { setShowTopupModal(false); setTopupAmount(""); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-2xl overflow-hidden border border-blue-500/25"
              style={{
                background: "linear-gradient(160deg, #0a0f1e 0%, #060912 100%)",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,0.8), 0 0 40px -15px rgba(59,130,246,0.2)",
              }}
            >
              {/* Top accent */}
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)" }}
              />
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center border border-blue-500/30"
                      style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(59,130,246,0.08))" }}
                    >
                      <Plus style={{ width: 18, height: 18 }} className="text-blue-400" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-base leading-tight">Top Up Investment</div>
                      <div className="text-[11px] text-white/45 mt-0.5">Add funds to active investment</div>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowTopupModal(false); setTopupAmount(""); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/8 transition-all"
                  >
                    <X style={{ width: 14, height: 14 }} className="text-white/60" />
                  </button>
                </div>

                {/* Current investment info */}
                <div className="mb-4 p-3.5 rounded-xl border border-white/8 bg-white/[0.02]">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/50">Current invested</span>
                    <span className="font-semibold text-white tabular-nums">
                      ${investment?.amount?.toFixed(2) ?? "0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-white/50">Available to top-up</span>
                    <span className="font-semibold text-emerald-400 tabular-nums">
                      ${Math.max(0, (wallet?.tradingBalance ?? 0) - (investment?.amount ?? 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Amount input */}
                <div className="mb-1">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-white/45 mb-2 block">
                    Top-Up Amount (USDT)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-semibold text-sm">$</span>
                    <input
                      type="number"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="any"
                      className="w-full pl-7 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 text-white font-semibold text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                  {/* Quick amount buttons */}
                  <div className="flex gap-2 mt-2">
                    {[25, 50, 100].map((pct) => {
                      const available = Math.max(0, (wallet?.tradingBalance ?? 0) - (investment?.amount ?? 0));
                      const val = +(available * pct / 100).toFixed(2);
                      return (
                        <button
                          key={pct}
                          onClick={() => setTopupAmount(val > 0 ? val.toString() : "")}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white/60 hover:text-blue-300 bg-white/[0.03] hover:bg-blue-500/10 border border-white/8 hover:border-blue-500/30 transition-all"
                        >
                          {pct}%
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        const available = Math.max(0, (wallet?.tradingBalance ?? 0) - (investment?.amount ?? 0));
                        setTopupAmount(available > 0 ? available.toFixed(2) : "");
                      }}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-white/60 hover:text-blue-300 bg-white/[0.03] hover:bg-blue-500/10 border border-white/8 hover:border-blue-500/30 transition-all"
                    >
                      Max
                    </button>
                  </div>
                </div>

                {/* New total preview */}
                {parseFloat(topupAmount) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.05]"
                  >
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/55">New total invested</span>
                      <span className="font-bold text-blue-300 tabular-nums">
                        ${((investment?.amount ?? 0) + (parseFloat(topupAmount) || 0)).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/35 mt-1">
                      ROI will be calculated on the new total from next distribution
                    </div>
                  </motion.div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => { setShowTopupModal(false); setTopupAmount(""); }}
                    className="flex-1 h-11 rounded-xl border border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07] font-semibold text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const amt = parseFloat(topupAmount);
                      if (!amt || amt <= 0) return;
                      topupMutation.mutate({ data: { amount: amt } });
                    }}
                    disabled={
                      topupMutation.isPending ||
                      !parseFloat(topupAmount) ||
                      parseFloat(topupAmount) <= 0 ||
                      parseFloat(topupAmount) > (wallet?.tradingBalance ?? 0)
                    }
                    className="flex-1 h-11 rounded-xl bg-gradient-to-b from-blue-500 to-blue-600 text-white font-semibold text-sm hover:from-blue-400 hover:to-blue-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_-6px_rgba(59,130,246,0.5)]"
                  >
                    {topupMutation.isPending ? (
                      <>
                        <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" />
                        Adding…
                      </>
                    ) : (
                      <>
                        <Plus style={{ width: 14, height: 14 }} />
                        Confirm Top Up
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
