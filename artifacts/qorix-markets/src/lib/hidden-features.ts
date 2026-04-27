/**
 * Hidden-Features Registry
 *
 * Single source of truth for any product feature that has been
 * intentionally hidden from end users while we redesign / rebuild it.
 * The goal is so that nothing gets "lost" — when we want to bring a
 * feature back later, we open the admin → Hidden Features page and
 * see exactly what's hidden, where it lives in the codebase, why it
 * was hidden, and what's needed to restore it.
 *
 * Workflow:
 *   1. To hide a feature, add an entry here and wrap the feature's
 *      render with `!isFeatureHidden('<id>')`.
 *   2. To restore a feature, delete its entry here. Code stays in
 *      place — the registry is the gate.
 */

export type HiddenFeature = {
  /** Stable id used in code: `area:short-name`. */
  id: string;
  /** Human-readable name shown in the admin list. */
  title: string;
  /** Where in the app this feature was visible. */
  location: string;
  /** Source file(s) — for the developer who restores it later. */
  filePath: string;
  /** ISO date (YYYY-MM-DD) when it was hidden. */
  hiddenAt: string;
  /** Why we hid it. */
  reason: string;
  /** Notes on what's needed before showing it again. */
  restoreNotes: string;
};

export const HIDDEN_FEATURES: HiddenFeature[] = [
  {
    id: "portfolio:performance-insights",
    title: "Portfolio → Performance Insights section",
    location:
      "Portfolio page, bottom block (lock-mask card + blurred Equity Curve / Daily P&L / Rolling Returns / Performance Metrics + Recent Trade Attribution).",
    filePath: "artifacts/qorix-markets/src/pages/portfolio.tsx",
    hiddenAt: "2026-04-27",
    reason:
      "Section still needs significant work — copy, layout and the underlying DemoDashboardBody embed all need a redesign before investors see it. The current 'Performance Insights Locked' blur-mask was firing even after users had invested, which was confusing. Hiding the entire block (mask + content) so no one sees a half-finished view; we'll bring it back when ready.",
    restoreNotes:
      "Remove this entry from HIDDEN_FEATURES. The block is wrapped in a single `{!isFeatureHidden('portfolio:performance-insights') && (...)}` gate around the `<div className=\"relative\">...</div>` that contains the Performance Insights lock overlay and the embedded DemoDashboardBody + RecentTradeAttribution — un-hiding restores the previous behavior verbatim (lock mask shown for users with no active investment, blurred section underneath).",
  },
  {
    id: "trading-desk:page",
    title: "Institutional Trading Desk page (entire route)",
    location: "Sidebar → Trading Desk  ·  Route: /trading-desk",
    filePath: "artifacts/qorix-markets/src/pages/trading-desk.tsx",
    hiddenAt: "2026-04-27",
    reason:
      "Page is being polished — trader profiles, strategy allocation breakdown and live desk metrics still need a redesign. Locked for everyone (including investors above the $10K threshold) until the redesign ships, so no one sees a half-finished view.",
    restoreNotes:
      "Remove this entry from HIDDEN_FEATURES. The page-level fund gate ($10K via TRADING_DESK_MIN_FUND in trading-desk.tsx) will then take over again — same Crown/Lock 'Premium Tier' card that was already in place. Sidebar nav entry stays as-is; no layout changes were made.",
  },
  {
    id: "analytics:page",
    title: "Advanced Analytics page (entire route)",
    location: "Sidebar → Analytics  ·  Route: /analytics",
    filePath: "artifacts/qorix-markets/src/pages/analytics.tsx",
    hiddenAt: "2026-04-27",
    reason:
      "Page is being polished — investor-facing copy, fund-scaling parity with the dashboard headline, and a couple of charts still need a redesign. Locked for everyone (including investors above the $10K threshold) until the redesign ships, so no one sees a half-finished view.",
    restoreNotes:
      "Remove this entry from HIDDEN_FEATURES. The page-level fund gate ($10K via ANALYTICS_MIN_FUND in analytics.tsx) will then take over again — the same Crown/Lock 'Premium Tier' card the trading desk uses. Sidebar nav entry stays as-is; no layout changes were made.",
  },
  {
    id: "analytics:risk-vs-return",
    title: "Per-Trade Risk vs Monthly Return chart",
    location: "Analytics page → Advanced Analytics section (4th chart card, after Drawdown)",
    filePath: "artifacts/qorix-markets/src/pages/analytics.tsx",
    hiddenAt: "2026-04-26",
    reason:
      "Visual polish still in flux — bubble overlap and the right framing of the loss cap need a redesign before the chart goes back to investors.",
    restoreNotes:
      "Remove this entry from HIDDEN_FEATURES (or change isFeatureHidden gate). The chart's full implementation is preserved in analytics.tsx around the {/* 4. Per-Trade Risk vs Monthly Return */} block, including the rrSafeZone background plugin, riskProfiles tier model and collision-aware label plugin. Most recent decisions: per-trade loss cap shown at x = 1 %, no upside cap on return, Conservative/Balanced/Aggressive tiers on a 10:1 reward-to-risk diagonal.",
  },
];

/** Returns true when the given feature id is currently hidden. */
export function isFeatureHidden(id: string): boolean {
  return HIDDEN_FEATURES.some((f) => f.id === id);
}
