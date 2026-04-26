// Reusable Drawdown Chart card.
// Renders the same chart used on the Analytics page (Cumulative Return %
// area + Drawdown from Peak % line + optional Protection Limit dashed
// reference) so we can drop it into other surfaces (Demo Dashboard, etc.)
// and stay pixel-identical to the canonical implementation.
//
// Logic is intentionally a 1:1 port of the inline implementation in
// `src/pages/analytics.tsx` (around the "Drawdown Chart" section). If
// you tweak the math or visual treatment, mirror it there too — or
// better, swap the analytics inline version to use this component.

import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { BarChart2 } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const CHART_DEFAULTS = {
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(10,14,26,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      titleColor: "#94a3b8",
      bodyColor: "#f1f5f9",
      padding: 10,
      cornerRadius: 10,
    },
  },
  scales: {
    x: {
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
      ticks: { color: "#64748b", font: { size: 11 } },
      border: { display: false },
    },
    y: {
      grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
      ticks: { color: "#64748b", font: { size: 11 } },
      border: { display: false },
    },
  },
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index" as const, intersect: false },
  animation: { duration: 600, easing: "easeOutQuart" as const },
};

export interface DrawdownChartCardProps {
  equity: Array<{ date: string; equity: number }> | undefined | null;
  investment:
    | { amount?: number | string; drawdown?: number | string; drawdownLimit?: number | string }
    | undefined
    | null;
  days: number;
  loading: boolean;
  delay?: number;
}

export function DrawdownChartCard({
  equity,
  investment,
  days,
  loading,
  delay = 0,
}: DrawdownChartCardProps) {
  // Sort ascending by date so arr[0] = oldest, arr[length-1] = newest.
  const equityArr = Array.isArray(equity)
    ? [...equity].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      )
    : [];

  // Time-aware label formatter — matches analytics page exactly.
  const labelFmt =
    days <= 1
      ? "HH:mm"
      : days <= 2
        ? "EEE HH:mm"
        : days <= 7
          ? "EEE d"
          : days <= 90
            ? "MMM d"
            : "MMM yy";
  const labels = equityArr.map((e) => {
    try {
      return format(parseISO(e.date), labelFmt);
    } catch {
      return e.date;
    }
  });

  const equityValues = equityArr.map((e) => Number(e.equity));

  // Peak-to-trough drawdown for each point (≤ 0).
  const drawdownValues = (() => {
    let peak = 0;
    return equityValues.map((eq) => {
      if (eq > peak) peak = eq;
      return peak > 0 ? -((peak - eq) / peak) * 100 : 0;
    });
  })();

  // Cumulative return % from the start of the selected period.
  const gainPctValues = (() => {
    if (equityValues.length === 0) return [] as number[];
    const base = equityValues[0];
    return equityValues.map((eq) => (base > 0 ? ((eq - base) / base) * 100 : 0));
  })();

  // Headline stat — server-tracked live drawdown (mirrors Demo Dashboard's
  // "Current Drawdown" card exactly).
  const investAmount = Number(investment?.amount ?? 0);
  const investDrawdownDollars = Number(investment?.drawdown ?? 0);
  const drawdownPctCanonical =
    investAmount > 0 ? (investDrawdownDollars / investAmount) * 100 : 0;
  const drawdownStat = `${drawdownPctCanonical.toFixed(2)}% (-$${investDrawdownDollars.toFixed(2)}) now`;

  // Override the LATEST drawdown point with the live server figure so the
  // chart's grey line tail lands on the same number the headline pill shows.
  const drawdownDisplayValues =
    drawdownValues.length > 0
      ? [...drawdownValues.slice(0, -1), -drawdownPctCanonical]
      : drawdownValues;

  const peakDrawdownPct =
    drawdownDisplayValues.length > 0
      ? Math.min(...drawdownDisplayValues)
      : 0;
  const peakStat =
    equityValues.length > 0
      ? `Peak DD: ${peakDrawdownPct.toFixed(2)}%`
      : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card p-5 rounded-2xl flex flex-col"
    >
      {/* Header: on narrow viewports (iPhone) the headline pill
          ("0.17% (-$0.85) now") was crowding the title row and forcing
          "Drawdown Chart" / "Drawdown vs cumulative return — underwater
          view" to truncate to "Drawdown C…" / "Drawdown vs cu…". On
          screens < sm we stack the title row over the stat pills so the
          title gets the full width and the pills sit on their own row
          underneath, right-aligned. From sm upwards we keep the
          original side-by-side layout. */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#ef444418", border: "1px solid #ef444428" }}
          >
            <BarChart2 style={{ width: 14, height: 14, color: "#ef4444" }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">Drawdown Chart</div>
            <div className="text-[11px] text-muted-foreground truncate">
              Drawdown vs cumulative return — underwater view
            </div>
          </div>
        </div>
        {!loading && (drawdownStat || peakStat) && (
          <div className="flex flex-row sm:flex-col flex-wrap items-center sm:items-end gap-1.5 sm:gap-1 shrink-0 self-start sm:self-auto">
            <span
              className="text-xs font-bold tabular-nums px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: "#ef444418",
                color: "#ef4444",
                border: "1px solid #ef444428",
              }}
            >
              {drawdownStat}
            </span>
            {peakStat && (
              <span
                className="text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{
                  background: "#fb923c14",
                  color: "#fb923c",
                  border: "1px solid #fb923c22",
                }}
              >
                {peakStat}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" style={{ minHeight: 220 }}>
        {loading ? (
          <div className="flex items-end gap-1 h-full pb-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-white/5 rounded-t animate-pulse"
                style={{ height: `${25 + (i * 4 + 13) % 60}%` }}
              />
            ))}
          </div>
        ) : (
          <Line
            data={{
              labels,
              datasets: [
                {
                  label: "Cumulative Return %",
                  data: gainPctValues,
                  borderColor: "rgba(245,158,11,0.95)",
                  borderWidth: 2.25,
                  backgroundColor: (ctx: any) => {
                    const chart = ctx.chart;
                    const { ctx: c, chartArea } = chart;
                    if (!chartArea) return "transparent";
                    const grad = c.createLinearGradient(
                      0,
                      chartArea.top,
                      0,
                      chartArea.bottom,
                    );
                    grad.addColorStop(0, "rgba(245,158,11,0.28)");
                    grad.addColorStop(1, "rgba(245,158,11,0.02)");
                    return grad;
                  },
                  fill: true,
                  tension: 0.35,
                  pointRadius: days <= 7 ? 3 : 0,
                  pointHoverRadius: 5,
                  pointBackgroundColor: "rgba(245,158,11,1)",
                  pointBorderColor: "rgba(15,23,42,0.9)",
                  pointBorderWidth: 1,
                  order: 2,
                },
                {
                  label: "Drawdown from Peak %",
                  data: drawdownDisplayValues,
                  borderColor: "rgba(148,163,184,0.85)",
                  borderWidth: 1.75,
                  backgroundColor: "transparent",
                  fill: false,
                  tension: 0.3,
                  pointRadius: days <= 7 ? 2.5 : 0,
                  pointHoverRadius: 4,
                  pointBackgroundColor: "rgba(148,163,184,1)",
                  pointBorderColor: "rgba(15,23,42,0.9)",
                  pointBorderWidth: 1,
                  order: 1,
                },
                ...((() => {
                  const lim = Number(investment?.drawdownLimit ?? 0);
                  if (!lim) return [];
                  const series = [...gainPctValues, ...drawdownDisplayValues];
                  const dataMin = series.length ? Math.min(...series) : 0;
                  const showLimit = -lim >= dataMin - lim * 0.5;
                  if (!showLimit) return [];
                  return [
                    {
                      label: "Protection Limit",
                      data: labels.map(() => -lim),
                      borderColor: "rgba(239,68,68,0.65)",
                      borderWidth: 1.25,
                      borderDash: [6, 4],
                      pointRadius: 0,
                      pointHoverRadius: 0,
                      fill: false,
                      tension: 0,
                      order: 0,
                    },
                  ];
                })()),
              ],
            }}
            options={{
              ...CHART_DEFAULTS,
              plugins: {
                ...CHART_DEFAULTS.plugins,
                legend: {
                  display: true,
                  position: "bottom" as const,
                  labels: {
                    color: "#94a3b8",
                    boxWidth: 12,
                    boxHeight: 2,
                    padding: 12,
                    font: { size: 10, weight: 600 as const },
                    usePointStyle: true,
                  },
                },
                tooltip: {
                  ...CHART_DEFAULTS.plugins.tooltip,
                  callbacks: {
                    label: (ctx: any) => {
                      const v = Number(ctx.raw);
                      if (ctx.dataset.label === "Protection Limit")
                        return ` Limit: -${investment?.drawdownLimit}%`;
                      if (ctx.dataset.label === "Cumulative Return %")
                        return ` Return: ${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
                      return ` Drawdown: ${v.toFixed(2)}%`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  ...CHART_DEFAULTS.scales.x,
                  ticks: {
                    ...CHART_DEFAULTS.scales.x.ticks,
                    maxTicksLimit: 8,
                    maxRotation: 0,
                    autoSkip: true,
                  },
                },
                y: {
                  ...CHART_DEFAULTS.scales.y,
                  ...((() => {
                    const series = [...gainPctValues, ...drawdownDisplayValues];
                    if (!series.length) return {};
                    const rawMin = Math.min(...series, 0);
                    const rawMax = Math.max(...series, 0);
                    const span = Math.max(rawMax - rawMin, 0.5);
                    const pad = Math.max(span * 0.25, 0.25);
                    return {
                      suggestedMin: rawMin - pad,
                      suggestedMax: rawMax + pad,
                    };
                  })()),
                  ticks: {
                    ...CHART_DEFAULTS.scales.y.ticks,
                    maxTicksLimit: 6,
                    callback: (v: any) => `${Number(v).toFixed(2)}%`,
                  },
                },
              },
            }}
          />
        )}
      </div>
    </motion.div>
  );
}
