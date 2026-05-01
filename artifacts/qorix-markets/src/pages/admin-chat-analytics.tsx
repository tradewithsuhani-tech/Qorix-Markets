import { useState, useEffect, useCallback, useMemo } from "react";
import { Layout } from "@/components/layout";
import { motion } from "framer-motion";
import {
  BarChart3, RefreshCw, Calendar, MessageCircle, Sparkles,
  MousePointerClick, ArrowRight, DollarSign, TrendingUp, Coins,
  ArrowUpRight, ArrowDownRight, Clock, Languages, AlertOctagon,
  Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-fetch";

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
}

interface IntentRow {
  intent: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
  ctaShown: number;
  ctaClicked: number;
  engaged: number;
}

interface LanguageRow {
  language: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
}

interface VariantRow {
  variant: string;
  shown: number;
  clicked: number;
  ctr: number;
}

interface ObjectionRow {
  objection: string;
  count: number;
}

interface TimeseriesPoint {
  date: string;
  sessions: number;
  conversions: number;
  ctaShown: number;
  ctaClicked: number;
  tokensUsed: number;
  estCostUsd: number;
}

interface Totals {
  sessions: number;
  aiReplies: number;
  tokensUsed: number;
  estimatedCostUsd: number;
  costPerConvertedUsd: number;
  ctaShown: number;
  ctaClicked: number;
  ctaCtr: number;
  depositVisitSessions: number;
  convertedSessions: number;
  conversionRate: number;
  avgEngagement: number;
  avgAiRepliesPerSession: number;
  avgTokensPerSession: number;
  medianTimeToConvertSec: number;
  estOpenaiUsdPerToken: number;
}

interface AnalyticsResponse {
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  totals: Totals;
  previousTotals: Totals;
  funnel: FunnelStage[];
  intents: IntentRow[];
  languages: LanguageRow[];
  ctaVariants: VariantRow[];
  topObjections: ObjectionRow[];
  timeseries: TimeseriesPoint[];
}

function toInputDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Date-range presets the human team uses most frequently. "Today" pins
// from=to=today; the rest pin a backward window of N days from today.
const PRESETS: Array<{ key: string; label: string; days: number | "today" }> = [
  { key: "today",  label: "Today",   days: "today" },
  { key: "7",      label: "7 days",  days: 7 },
  { key: "30",     label: "30 days", days: 30 },
  { key: "90",     label: "90 days", days: 90 },
];

function presetRange(days: number | "today"): { from: string; to: string } {
  const today = toInputDate(new Date());
  if (days === "today") return { from: today, to: today };
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: toInputDate(from), to: today };
}

function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "$—";
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function formatInt(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

// Period-over-period delta. Returns the relative change as a fraction.
// `inverted` is for cost-style metrics where DOWN is good — we flip the
// color but not the sign on the displayed number.
function deltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / previous;
}

const INTENT_LABEL: Record<string, string> = {
  beginner: "Beginner",
  advanced: "Advanced",
  skeptic: "Skeptic",
  price_sensitive: "Price-sensitive",
  ready_to_invest: "Ready to invest",
  support: "Support",
  other: "Other",
  unknown: "Unknown",
};

const INTENT_COLOR: Record<string, string> = {
  beginner: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  advanced: "text-violet-300 bg-violet-500/10 border-violet-500/30",
  skeptic: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  price_sensitive: "text-yellow-300 bg-yellow-500/10 border-yellow-500/30",
  ready_to_invest: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  support: "text-slate-300 bg-slate-500/10 border-slate-500/30",
  other: "text-white/60 bg-white/5 border-white/10",
  unknown: "text-white/40 bg-white/5 border-white/10",
};

const VARIANT_LABEL: Record<string, string> = {
  small_deposit: "Small deposit",
  view_dashboard: "View dashboard",
  talk_to_expert: "Talk to expert",
  unknown: "Unknown",
};

function DeltaBadge({
  delta,
  invertColor = false,
}: {
  delta: number | null;
  invertColor?: boolean;
}) {
  if (delta === null) {
    return <span className="text-[10px] text-white/30">no prior data</span>;
  }
  const isUp = delta > 0;
  const isDown = delta < 0;
  const isFlat = !isUp && !isDown;
  // For most metrics, up = good (green). For cost-style metrics (cost,
  // cost-per-conversion) we invert: up = bad.
  const goodDirection = invertColor ? !isUp : isUp;
  const color = isFlat
    ? "text-white/40"
    : goodDirection
      ? "text-emerald-300"
      : "text-rose-300";
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : ArrowRight;
  return (
    <span className={cn("text-[10px] font-medium inline-flex items-center gap-0.5", color)}>
      <Icon className="w-2.5 h-2.5" />
      {formatPct(Math.abs(delta), 0)}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "blue",
  delta,
  invertColor,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan";
  delta?: number | null;
  invertColor?: boolean;
}) {
  const accentMap = {
    blue:    { gradient: "from-blue-600/20 to-blue-400/5 border-blue-500/20",       icon: "text-blue-300" },
    emerald: { gradient: "from-emerald-600/20 to-emerald-400/5 border-emerald-500/20", icon: "text-emerald-300" },
    violet:  { gradient: "from-violet-600/20 to-violet-400/5 border-violet-500/20",   icon: "text-violet-300" },
    amber:   { gradient: "from-amber-600/20 to-amber-400/5 border-amber-500/20",     icon: "text-amber-300" },
    rose:    { gradient: "from-rose-600/20 to-rose-400/5 border-rose-500/20",        icon: "text-rose-300" },
    cyan:    { gradient: "from-cyan-600/20 to-cyan-400/5 border-cyan-500/20",        icon: "text-cyan-300" },
  } as const;
  const a = accentMap[accent];
  return (
    <div
      className={cn(
        "relative rounded-2xl p-4 bg-gradient-to-br border overflow-hidden",
        a.gradient,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-medium text-white/60 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon className={cn("w-4 h-4", a.icon)} />
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-white">{value}</p>
        {delta !== undefined && <DeltaBadge delta={delta} invertColor={invertColor} />}
      </div>
      {sub && <p className="text-[11px] text-white/45 mt-1">{sub}</p>}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
      style={{ background: "#0a0d18", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <p className="text-white/60 mb-1.5 font-medium">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/60">{p.name}</span>
          </span>
          <span className="text-white font-semibold">
            {p.dataKey === "estCostUsd" ? formatUsd(p.value) : formatInt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminChatAnalyticsPage() {
  const initialPreset = presetRange(30);
  const [from, setFrom] = useState<string>(initialPreset.from);
  const [to, setTo] = useState<string>(initialPreset.to);
  const [activePreset, setActivePreset] = useState<string | null>("30");
  const [seriesMetric, setSeriesMetric] = useState<"sessions" | "conversions" | "estCostUsd">("sessions");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from, to });
      const res = await authFetch<AnalyticsResponse>(`/api/admin/chat-analytics?${params.toString()}`);
      setData(res);
    } catch (e) {
      setError((e as Error).message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPreset = (key: string, days: number | "today") => {
    const r = presetRange(days);
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(key);
  };

  const onDateChange = (which: "from" | "to", value: string) => {
    if (which === "from") setFrom(value);
    else setTo(value);
    setActivePreset(null); // any manual change drops the preset highlight
  };

  // Funnel rendering — each stage is shown with its width relative to the
  // top-of-funnel (chat_started). Drop-off vs the previous stage is
  // labeled inline so the eye lands on the leakiest step.
  const funnelMax = data?.funnel?.[0]?.count ?? 0;
  const funnelStages = useMemo(() => {
    if (!data) return [];
    return data.funnel.map((stage, i) => {
      const prev = i > 0 ? data.funnel[i - 1]!.count : stage.count;
      const dropoffAbs = Math.max(0, prev - stage.count);
      const dropoffPct = prev > 0 ? dropoffAbs / prev : 0;
      const widthPct = funnelMax > 0 ? Math.max(2, (stage.count / funnelMax) * 100) : 0;
      return { ...stage, dropoffAbs, dropoffPct, widthPct };
    });
  }, [data, funnelMax]);

  // Pre-format the time series x-axis labels client-side. Recharts will
  // render whatever string we hand it, and "Apr 12" is far less noisy
  // than "2026-04-12" on a tight axis.
  const seriesData = useMemo(() => {
    if (!data) return [];
    return data.timeseries.map((p) => {
      const d = new Date(`${p.date}T00:00:00Z`);
      return {
        ...p,
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      };
    });
  }, [data]);

  const seriesMetricMeta: Record<typeof seriesMetric, { label: string; color: string; gradId: string }> = {
    sessions:    { label: "Sessions",    color: "#60a5fa", gradId: "gradSessions" },
    conversions: { label: "Conversions", color: "#34d399", gradId: "gradConv" },
    estCostUsd:  { label: "AI cost",     color: "#fb7185", gradId: "gradCost" },
  };
  const sm = seriesMetricMeta[seriesMetric];

  return (
    <Layout>
      <div className="px-4 py-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Chat Analytics</h1>
              <p className="text-xs text-white/40">
                Conversion funnel & AI cost for the Qorix Assistant
              </p>
            </div>
          </div>

          {/* Date range controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              {PRESETS.map(({ key, label, days }) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key, days)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                    activePreset === key
                      ? "bg-blue-500/20 text-blue-200"
                      : "text-white/55 hover:text-white/85 hover:bg-white/[0.04]",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              <Calendar className="w-3.5 h-3.5 text-white/40" />
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => onDateChange("from", e.target.value)}
                className="bg-transparent text-xs text-white/80 focus:outline-none [color-scheme:dark]"
              />
              <span className="text-white/30 text-xs">→</span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(e) => onDateChange("to", e.target.value)}
                className="bg-transparent text-xs text-white/80 focus:outline-none [color-scheme:dark]"
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="w-9 h-9 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] flex items-center justify-center transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4 text-white/60", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : data ? (
          <>
            {/* Top stat cards with PoP deltas */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
              <StatCard
                label="Sessions"
                value={formatInt(data.totals.sessions)}
                sub={`${formatInt(data.totals.aiReplies)} AI replies`}
                icon={MessageCircle}
                accent="blue"
                delta={deltaPct(data.totals.sessions, data.previousTotals.sessions)}
              />
              <StatCard
                label="CTA shown"
                value={formatInt(data.totals.ctaShown)}
                sub={`${formatInt(data.totals.ctaClicked)} clicks · CTR ${formatPct(data.totals.ctaCtr)}`}
                icon={Sparkles}
                accent="violet"
                delta={deltaPct(data.totals.ctaShown, data.previousTotals.ctaShown)}
              />
              <StatCard
                label="Deposit visits"
                value={formatInt(data.totals.depositVisitSessions)}
                sub="Sessions reaching /deposit"
                icon={MousePointerClick}
                accent="amber"
                delta={deltaPct(data.totals.depositVisitSessions, data.previousTotals.depositVisitSessions)}
              />
              <StatCard
                label="Conversions"
                value={formatInt(data.totals.convertedSessions)}
                sub={`Conversion rate ${formatPct(data.totals.conversionRate)}`}
                icon={TrendingUp}
                accent="emerald"
                delta={deltaPct(data.totals.convertedSessions, data.previousTotals.convertedSessions)}
              />
              <StatCard
                label="AI cost (est.)"
                value={formatUsd(data.totals.estimatedCostUsd)}
                sub={`${formatInt(data.totals.tokensUsed)} tokens`}
                icon={Coins}
                accent="rose"
                delta={deltaPct(data.totals.estimatedCostUsd, data.previousTotals.estimatedCostUsd)}
                invertColor
              />
              <StatCard
                label="Cost / conversion"
                value={
                  data.totals.convertedSessions > 0
                    ? formatUsd(data.totals.costPerConvertedUsd)
                    : "—"
                }
                sub="LLM spend ÷ converted users"
                icon={DollarSign}
                accent="emerald"
                delta={
                  data.totals.convertedSessions > 0 && data.previousTotals.convertedSessions > 0
                    ? deltaPct(data.totals.costPerConvertedUsd, data.previousTotals.costPerConvertedUsd)
                    : null
                }
                invertColor
              />
            </div>

            {/* Secondary averages strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <SecondaryStat
                icon={Activity}
                label="Avg engagement"
                value={data.totals.avgEngagement.toFixed(1)}
                sub="per session"
              />
              <SecondaryStat
                icon={MessageCircle}
                label="Avg AI replies"
                value={data.totals.avgAiRepliesPerSession.toFixed(1)}
                sub="per session"
              />
              <SecondaryStat
                icon={Coins}
                label="Avg tokens"
                value={formatInt(Math.round(data.totals.avgTokensPerSession))}
                sub="per session"
              />
              <SecondaryStat
                icon={Clock}
                label="Time to convert"
                value={formatSeconds(data.totals.medianTimeToConvertSec)}
                sub="median"
              />
            </div>

            {/* Time series chart */}
            <div
              className="rounded-2xl p-4 mb-5"
              style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-white">Daily trend</h2>
                  <p className="text-[11px] text-white/40">
                    Per-day breakdown across the selected window
                  </p>
                </div>
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                  {(["sessions", "conversions", "estCostUsd"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSeriesMetric(m)}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                        seriesMetric === m
                          ? "bg-white/10 text-white"
                          : "text-white/55 hover:text-white/85",
                      )}
                    >
                      {seriesMetricMeta[m].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-56">
                {seriesData.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <p className="text-sm text-white/40">No data in this range.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={seriesData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={sm.gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={sm.color} stopOpacity={0.45} />
                          <stop offset="95%" stopColor={sm.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                      />
                      <YAxis
                        tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                        tickFormatter={(v) =>
                          seriesMetric === "estCostUsd"
                            ? formatUsd(v)
                            : formatInt(v)
                        }
                        width={60}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey={seriesMetric}
                        name={sm.label}
                        stroke={sm.color}
                        strokeWidth={2}
                        fill={`url(#${sm.gradId})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Funnel + Intent breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">
              {/* Funnel */}
              <div
                className="lg:col-span-3 rounded-2xl p-4"
                style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Conversion funnel</h2>
                    <p className="text-[11px] text-white/40">
                      Drop-off across the chat → deposit journey
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/30" />
                </div>
                <div className="space-y-3">
                  {funnelStages.length === 0 || funnelMax === 0 ? (
                    <p className="text-sm text-white/40 py-12 text-center">
                      No chat sessions in this date range yet.
                    </p>
                  ) : (
                    funnelStages.map((stage, i) => {
                      const conversionFromTop = funnelMax > 0 ? stage.count / funnelMax : 0;
                      return (
                        <motion.div
                          key={stage.stage}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-white/85">{stage.label}</span>
                              <span className="text-[10px] text-white/35">
                                {formatPct(conversionFromTop)} of top
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">
                                {formatInt(stage.count)}
                              </span>
                              {i > 0 && stage.dropoffAbs > 0 && (
                                <span className="text-[10px] text-rose-300/80">
                                  −{formatInt(stage.dropoffAbs)} ({formatPct(stage.dropoffPct)})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-7 rounded-md bg-white/[0.04] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${stage.widthPct}%` }}
                              transition={{ duration: 0.5, delay: i * 0.05 }}
                              className={cn(
                                "h-full rounded-md",
                                i === 0 && "bg-gradient-to-r from-blue-600/70 to-blue-500/40",
                                i === 1 && "bg-gradient-to-r from-cyan-600/70 to-cyan-500/40",
                                i === 2 && "bg-gradient-to-r from-violet-600/70 to-violet-500/40",
                                i === 3 && "bg-gradient-to-r from-fuchsia-600/70 to-fuchsia-500/40",
                                i === 4 && "bg-gradient-to-r from-amber-600/70 to-amber-500/40",
                                i === 5 && "bg-gradient-to-r from-emerald-600/70 to-emerald-500/40",
                              )}
                            />
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Intent breakdown */}
              <div
                className="lg:col-span-2 rounded-2xl p-4"
                style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-white">Conversion by intent</h2>
                  <p className="text-[11px] text-white/40">
                    Which detected intents convert best
                  </p>
                </div>
                {data.intents.length === 0 ? (
                  <p className="text-sm text-white/40 py-12 text-center">No data yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-[10px] text-white/40 uppercase tracking-wider border-b border-white/[0.06]">
                          <th className="text-left py-2 font-medium">Intent</th>
                          <th className="text-right py-2 font-medium">Sessions</th>
                          <th className="text-right py-2 font-medium">Conv.</th>
                          <th className="text-right py-2 font-medium">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.intents.map((row) => {
                          const label = INTENT_LABEL[row.intent] ?? row.intent;
                          const color = INTENT_COLOR[row.intent] ?? INTENT_COLOR.unknown;
                          return (
                            <tr key={row.intent} className="border-b border-white/[0.03]">
                              <td className="py-2.5">
                                <span className={cn("px-2 py-0.5 rounded border text-[10px] font-medium", color)}>
                                  {label}
                                </span>
                              </td>
                              <td className="py-2.5 text-right text-white/80">
                                {formatInt(row.sessions)}
                              </td>
                              <td className="py-2.5 text-right text-white/80">
                                {formatInt(row.conversions)}
                              </td>
                              <td
                                className={cn(
                                  "py-2.5 text-right font-semibold",
                                  row.conversionRate >= 0.1
                                    ? "text-emerald-300"
                                    : row.conversionRate > 0
                                      ? "text-amber-300"
                                      : "text-white/40",
                                )}
                              >
                                {formatPct(row.conversionRate)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* CTA Variants + Languages + Top Objections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* CTA Variants */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <h2 className="text-sm font-semibold text-white">CTA variants</h2>
                </div>
                {data.ctaVariants.length === 0 ? (
                  <p className="text-sm text-white/40 py-8 text-center">
                    No CTAs shown in this range.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.ctaVariants.map((v) => {
                      const label = VARIANT_LABEL[v.variant] ?? v.variant;
                      return (
                        <div key={v.variant}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-white/85 font-medium truncate">{label}</span>
                            <span className="text-[10px] text-white/50">
                              {formatInt(v.shown)} shown · {formatInt(v.clicked)} clicks
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, v.ctr * 100)}%` }}
                                transition={{ duration: 0.6 }}
                                className="h-full rounded-full bg-gradient-to-r from-violet-500/80 to-fuchsia-500/60"
                              />
                            </div>
                            <span className="text-[11px] text-white/70 font-semibold tabular-nums w-12 text-right">
                              {formatPct(v.ctr)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Languages */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Languages className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-white">By language</h2>
                </div>
                {data.languages.length === 0 ? (
                  <p className="text-sm text-white/40 py-8 text-center">No data yet.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-white/40 uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="text-left py-2 font-medium">Lang</th>
                        <th className="text-right py-2 font-medium">Sessions</th>
                        <th className="text-right py-2 font-medium">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.languages.map((row) => (
                        <tr key={row.language} className="border-b border-white/[0.03]">
                          <td className="py-2 text-white/85 font-medium uppercase">{row.language}</td>
                          <td className="py-2 text-right text-white/70">
                            {formatInt(row.sessions)}
                          </td>
                          <td
                            className={cn(
                              "py-2 text-right font-semibold",
                              row.conversionRate >= 0.1
                                ? "text-emerald-300"
                                : row.conversionRate > 0
                                  ? "text-amber-300"
                                  : "text-white/40",
                            )}
                          >
                            {formatPct(row.conversionRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top Objections */}
              <div
                className="rounded-2xl p-4"
                style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-white">Top objections</h2>
                </div>
                {data.topObjections.length === 0 ? (
                  <p className="text-sm text-white/40 py-8 text-center">
                    None mentioned in this range.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.topObjections.map((o) => (
                      <li
                        key={o.objection}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.02] border border-white/[0.04]"
                      >
                        <span className="text-xs text-white/80 truncate">{o.objection}</span>
                        <span className="text-[10px] text-white/50 font-semibold tabular-nums">
                          {formatInt(o.count)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <p className="text-[10px] text-white/30 leading-relaxed">
              Cost estimate uses ${data.totals.estOpenaiUsdPerToken.toFixed(7)}/token
              (gpt-5-mini blended). Final billing is shown in the OpenAI dashboard.
              Period-over-period deltas compare against {new Date(data.previousRange.from).toLocaleDateString()} – {new Date(data.previousRange.to).toLocaleDateString()}.
            </p>
          </>
        ) : null}
      </div>
    </Layout>
  );
}

function SecondaryStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: "#0f1422", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-white/55" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-white/40 font-medium">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold text-white">{value}</span>
          {sub && <span className="text-[10px] text-white/40">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
