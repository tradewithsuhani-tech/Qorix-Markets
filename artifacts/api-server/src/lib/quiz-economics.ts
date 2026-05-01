// Quiz revenue economics — single source of truth for the platform rake.
//
// Players & the public-facing UI see the *advertised* prize pool (e.g. "$100
// pot"). Behind the scenes the platform retains a fixed percentage as
// revenue and only the remaining slice is actually distributed to winners.
//
// Currently hard-coded at 20% rake / 80% payout. If we ever want to make
// this per-quiz configurable, change `quizzes.prize_pool_source` to also
// store a `rake_pct` column and read it here — every consumer routes
// through these helpers, so flipping to dynamic is a one-file change.
//
// Importantly: only ADMIN endpoints / dashboards expose the breakdown.
// Public quiz info, leaderboard, and "you won X" toasts always show the
// per-winner amount that's actually credited (already net of rake), so
// players never see a "$X advertised → $Y actual" delta.

export const PLATFORM_RAKE_PCT = 0.2;
export const PAYOUT_PCT = 1 - PLATFORM_RAKE_PCT;

/** Amount actually distributed to winners (sum of all prize_amount rows). */
export function computeDistributable(prizePool: number | string): number {
  const p = typeof prizePool === "number" ? prizePool : parseFloat(prizePool);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return +(p * PAYOUT_PCT).toFixed(2);
}

/** Platform revenue retained from the advertised pool. */
export function computeCompanyCut(prizePool: number | string): number {
  const p = typeof prizePool === "number" ? prizePool : parseFloat(prizePool);
  if (!Number.isFinite(p) || p <= 0) return 0;
  return +(p * PLATFORM_RAKE_PCT).toFixed(2);
}
