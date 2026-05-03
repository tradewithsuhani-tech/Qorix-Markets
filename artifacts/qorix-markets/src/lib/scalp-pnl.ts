/**
 * Global scalp-bot P&L derivation.
 *
 * Every browser computes the SAME pnl + daily target from:
 *   - Today's UTC date (so all timezones align on the same "trading day")
 *   - Total AUM (a global value from /api/dashboard/fund-stats)
 *   - Current UTC time (for the smooth intra-day ramp)
 *
 * That way the Bot Terminal pill, Live P/L footer, and dashboard
 * card deltas show identical numbers across desktop, mobile, and
 * every user — there is no per-browser localStorage drift.
 */

const SECS_PER_DAY = 24 * 3600;
const RAMP_SECS = 6 * 3600; // bot reaches its daily target after ~6h of UTC time

function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function todayUtcKey(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function utcSecondsSinceMidnight(now: number): number {
  const d = new Date(now);
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

export interface ScalpState {
  pnl: number;
  target: number;
  targetHit: boolean;
  dayKey: string;
}

/**
 * Pure, deterministic. Same inputs → same output on every device.
 */
export function computeGlobalScalpState(aum: number, now: number = Date.now()): ScalpState {
  const dayKey = todayUtcKey(now);
  const seed = hash32(dayKey);
  const rng = mulberry32(seed);
  // Target: 0.40%–0.50% of AUM, deterministic per day.
  const targetPct = 0.004 + rng() * 0.001;
  const target = +(Math.max(0, aum) * targetPct).toFixed(2);
  if (target <= 0) {
    return { pnl: 0, target: 0, targetHit: false, dayKey };
  }
  // Smooth ramp: pnl climbs from 0 → target over RAMP_SECS, then plateaus.
  const secs = utcSecondsSinceMidnight(now);
  const progress = Math.min(1, secs / RAMP_SECS);
  // 15-second jitter buckets so the pill ticks naturally without
  // breaking determinism (every browser hits the same bucket together).
  const bucket = Math.floor(secs / 15);
  const jitterRng = mulberry32(hash32(dayKey + ":" + bucket));
  const jitter = (jitterRng() - 0.45) * 0.015; // mostly positive nudge
  const raw = target * (progress + jitter);
  const pnl = +Math.max(0, Math.min(target, raw)).toFixed(2);
  return { pnl, target, targetHit: pnl >= target, dayKey };
}
