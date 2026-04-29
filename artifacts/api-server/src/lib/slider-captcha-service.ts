import crypto from "node:crypto";
import { logger } from "./logger";

/**
 * Batch 9.1 — Slider puzzle captcha (lightweight, behavior-aware).
 *
 * Issues a stateless HMAC-signed challenge and verifies the user's drag
 * solution. On success returns a one-time `slider.v1.*` token that
 * `verifyCaptcha()` will accept (wired in B9.3).
 *
 * Stateless by design (multi-instance Fly setup: BOM 2x + SIN 1x):
 *   - The challenge envelope encodes `{ rand, targetX, issuedAt }` and
 *     is HMAC-signed, so the verify endpoint can reach a different
 *     instance than the challenge endpoint without losing context.
 *   - Verified tokens are also HMAC-signed and time-bounded (90s TTL).
 *   - Anti-replay: per-instance in-memory `consumedTokens` set with
 *     10-minute TTL. A single token replayed across instances could
 *     pass twice in the same 10-minute window — acceptable for a
 *     defense-in-depth captcha. B9.4 may tighten this with Redis if
 *     attack volume warrants it.
 *
 * Bot signals enforced server-side:
 *   - finalX must be within ±5 px of targetX.
 *   - Trajectory must have at least 5 samples.
 *   - Drag duration must be 200 ms ≤ d ≤ 15 000 ms.
 *   - Vertical (y) variance must exceed a small floor — perfectly
 *     horizontal y = constant strongly indicates a bot.
 *   - Trajectory timestamps must be monotonic non-decreasing.
 *   - [B9.4] First sample x must start near the left edge (the piece
 *     visually starts there); raises the bar above "send a single
 *     final-position sample".
 *   - [B9.4] All sample x values must lie within the slider track
 *     bounds (with small slop) — out-of-bounds samples indicate the
 *     trajectory was synthesised, not produced by the live widget.
 *   - [B9.4] Linear regression of x against t must NOT fit perfectly
 *     (R² < 0.998). A perfect line indicates a constant-velocity
 *     bot rather than a human acceleration / deceleration curve.
 *   - [B9.4] Velocity must not be uniform — the coefficient of
 *     variation of inter-sample velocities must exceed a small
 *     floor. Catches bots that interpolate evenly between start and
 *     target (constant Δx per Δt).
 */

// HMAC key derived from JWT_SECRET (which is required in prod for auth).
// We derive a sub-key with a fixed label so slider tokens cannot collide
// with auth JWTs even hypothetically.
const HMAC_KEY: Buffer = (() => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 0) {
    return crypto
      .createHmac("sha256", secret)
      .update("slider-captcha-v1")
      .digest();
  }
  // Dev fallback — server still boots, captcha still works locally,
  // but the warning makes prod misconfiguration loud.
  logger.warn(
    "[slider-captcha] JWT_SECRET not set — using dev-only HMAC key. NOT SAFE FOR PROD.",
  );
  return Buffer.from("dev-only-slider-captcha-key-do-not-use-in-prod");
})();

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TTL_MS = 90 * 1000;
const TOKEN_REPLAY_WINDOW_MS = 10 * 60 * 1000;

// Geometry — must match the React component default size. Both
// numbers are exposed to the client in the challenge response so
// the UI can render at the same scale the server expects.
const SLIDER_WIDTH = 320;
const PIECE_WIDTH = 40;
const TARGET_MIN = 60;
const TARGET_MAX = SLIDER_WIDTH - PIECE_WIDTH - 20; // 260

const TOLERANCE_PX = 5;
const MIN_TRAJECTORY_SAMPLES = 5;
const MAX_TRAJECTORY_SAMPLES = 5000;
const MIN_DURATION_MS = 200;
const MAX_DURATION_MS = 15000;
const MIN_Y_VARIANCE = 0.5;

// B9.4 — Behavior signal hardening.
//
// Bounds: piece visually starts at x = 0; the slider track itself runs
// from 0 to (SLIDER_WIDTH - PIECE_WIDTH). We allow a small slop on
// both sides because pointer events captured during fast drags can
// briefly overshoot the track by a few pixels before being clamped on
// the next frame.
const FIRST_X_MAX_PX = 30;
const X_LOWER_BOUND = -10;
const X_UPPER_BOUND = SLIDER_WIDTH - PIECE_WIDTH + 10;
// Linearity: empirically, a cubic ease-in/out trajectory yields R²
// around 0.92–0.97. A perfect linear interpolation (constant
// velocity) yields R² = 1.0. Anything > 0.998 is essentially a
// straight line and indicates a synthesised trajectory.
const MAX_R_SQUARED = 0.998;
// Velocity uniformity: coefficient of variation (stddev / |mean|) of
// inter-sample velocity. A real human with any acceleration /
// deceleration easily clears 0.30; a constant-velocity bot is ~0.
// 0.10 is a deliberately wide margin to leave headroom for slow,
// careful drags on touch devices.
const MIN_VELOCITY_COV = 0.10;

// Per-instance consumed-token store. GC'd lazily on every consume call.
const consumedTokens = new Map<string, number>();

function gcConsumed(now: number): void {
  // Keep this O(n) sweep cheap by only running it occasionally; verify
  // calls are not high-volume so a per-call sweep is fine.
  for (const [tok, expiresAt] of consumedTokens) {
    if (expiresAt < now) consumedTokens.delete(tok);
  }
}

function hmacSign(payload: string): string {
  return crypto
    .createHmac("sha256", HMAC_KEY)
    .update(payload)
    .digest("base64url")
    .slice(0, 32);
}

function constantTimeEqualString(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export interface SliderChallenge {
  challengeId: string;
  targetX: number;
  sliderWidth: number;
  pieceWidth: number;
  expiresAt: number;
}

export interface TrajectorySample {
  x: number;
  y: number;
  t: number;
}

export function issueSliderChallenge(): SliderChallenge {
  const targetX = Math.floor(
    TARGET_MIN + Math.random() * (TARGET_MAX - TARGET_MIN),
  );
  const issuedAt = Date.now();
  const expiresAt = issuedAt + CHALLENGE_TTL_MS;
  const rand = crypto.randomBytes(9).toString("base64url");
  const payload = `${rand}.${targetX}.${issuedAt}`;
  const sig = hmacSign(payload);
  return {
    challengeId: `${payload}.${sig}`,
    targetX,
    sliderWidth: SLIDER_WIDTH,
    pieceWidth: PIECE_WIDTH,
    expiresAt,
  };
}

interface ParsedChallenge {
  ok: boolean;
  targetX?: number;
  issuedAt?: number;
  error?: string;
}

function parseChallenge(challengeId: string): ParsedChallenge {
  if (typeof challengeId !== "string" || challengeId.length > 200) {
    return { ok: false, error: "Invalid challenge format" };
  }
  const parts = challengeId.split(".");
  if (parts.length !== 4) return { ok: false, error: "Invalid challenge format" };
  const [rand, targetXStr, issuedAtStr, sig] = parts;
  const targetX = Number.parseInt(targetXStr, 10);
  const issuedAt = Number.parseInt(issuedAtStr, 10);
  if (!Number.isFinite(targetX) || !Number.isFinite(issuedAt)) {
    return { ok: false, error: "Invalid challenge format" };
  }
  const expectedSig = hmacSign(`${rand}.${targetXStr}.${issuedAtStr}`);
  if (!constantTimeEqualString(sig, expectedSig)) {
    return { ok: false, error: "Invalid challenge signature" };
  }
  if (Date.now() > issuedAt + CHALLENGE_TTL_MS) {
    return { ok: false, error: "Challenge expired" };
  }
  return { ok: true, targetX, issuedAt };
}

export interface VerifyResult {
  ok: boolean;
  token?: string;
  error?: string;
}

export function verifySliderSolution(
  challengeId: string,
  finalX: unknown,
  trajectory: unknown,
): VerifyResult {
  const parsed = parseChallenge(challengeId);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  if (typeof finalX !== "number" || !Number.isFinite(finalX)) {
    return { ok: false, error: "Invalid finalX" };
  }
  if (Math.abs(finalX - parsed.targetX!) > TOLERANCE_PX) {
    return { ok: false, error: "Off target" };
  }

  if (!Array.isArray(trajectory)) {
    return { ok: false, error: "Trajectory required" };
  }
  if (trajectory.length < MIN_TRAJECTORY_SAMPLES) {
    return { ok: false, error: "Trajectory too short" };
  }
  if (trajectory.length > MAX_TRAJECTORY_SAMPLES) {
    return { ok: false, error: "Trajectory too long" };
  }

  let prevT = -Infinity;
  let firstT = 0;
  let lastT = 0;
  let ySum = 0;
  let ySumSq = 0;
  // B9.4 — running sums for linearity (R²) of x vs t and for the
  // velocity coefficient-of-variation. Computed in the same pass we
  // already use for y-variance to keep verify O(n) and cheap on
  // small trajectories.
  let xSum = 0;
  let tSum = 0;
  let xtSum = 0;
  let ttSum = 0;
  let xxSum = 0;
  for (let i = 0; i < trajectory.length; i++) {
    const s = trajectory[i] as { x?: unknown; y?: unknown; t?: unknown } | null;
    if (!s || typeof s !== "object") {
      return { ok: false, error: "Invalid trajectory sample" };
    }
    if (
      typeof s.x !== "number" ||
      typeof s.y !== "number" ||
      typeof s.t !== "number" ||
      !Number.isFinite(s.x) ||
      !Number.isFinite(s.y) ||
      !Number.isFinite(s.t)
    ) {
      return { ok: false, error: "Invalid trajectory sample" };
    }
    if (s.t < prevT) return { ok: false, error: "Non-monotonic timestamps" };
    prevT = s.t;
    if (i === 0) {
      firstT = s.t;
      // B9.4 — first sample must start near the left edge (where the
      // piece is visually drawn). Catches "fabricate one final-frame"
      // bots that just send `[{x:targetX,y:0,t:0}, ...]`.
      if (s.x > FIRST_X_MAX_PX) {
        return { ok: false, error: "Trajectory does not start at handle" };
      }
    }
    // B9.4 — every x must lie within the slider track (with slop).
    if (s.x < X_LOWER_BOUND || s.x > X_UPPER_BOUND) {
      return { ok: false, error: "Trajectory out of bounds" };
    }
    lastT = s.t;
    ySum += s.y;
    ySumSq += s.y * s.y;
    xSum += s.x;
    tSum += s.t;
    xtSum += s.x * s.t;
    ttSum += s.t * s.t;
    xxSum += s.x * s.x;
  }

  const duration = lastT - firstT;
  if (duration < MIN_DURATION_MS) return { ok: false, error: "Too fast" };
  if (duration > MAX_DURATION_MS) return { ok: false, error: "Too slow" };

  const n = trajectory.length;
  const yMean = ySum / n;
  const yVar = ySumSq / n - yMean * yMean;
  if (yVar < MIN_Y_VARIANCE) {
    return { ok: false, error: "Trajectory too rigid" };
  }

  // B9.4 — Linear regression x = slope·t + intercept. R² close to 1
  // means the trajectory fits a straight line, which is the signature
  // of a constant-velocity bot. Real human drags have a nonlinear
  // velocity profile (acceleration + deceleration) that yields a
  // visibly worse linear fit (R² ≈ 0.92–0.97 for a cubic ease).
  //
  // Edge cases:
  //   - tDenom == 0 means all samples share the same timestamp (caught
  //     by duration check above, but defended here too) → reject.
  //   - xVar == 0 means the piece never moved → reject (no real solve
  //     could put finalX within ±5 px of targetX without motion unless
  //     targetX < TOLERANCE_PX, which we guard against in
  //     issueSliderChallenge by using TARGET_MIN = 60).
  const xMean = xSum / n;
  const tMean = tSum / n;
  const tDenom = ttSum - n * tMean * tMean;
  const xVar = xxSum / n - xMean * xMean;
  if (tDenom <= 0 || xVar <= 0) {
    return { ok: false, error: "Trajectory degenerate" };
  }
  const slope = (xtSum - n * xMean * tMean) / tDenom;
  const intercept = xMean - slope * tMean;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const s = trajectory[i] as TrajectorySample;
    const xPred = slope * s.t + intercept;
    const r = s.x - xPred;
    ssRes += r * r;
  }
  const ssTot = xVar * n;
  const r2 = 1 - ssRes / ssTot;
  if (r2 > MAX_R_SQUARED) {
    return { ok: false, error: "Trajectory too linear" };
  }

  // B9.4 — Velocity coefficient of variation. Compute Δx/Δt between
  // each pair of consecutive samples; require their stddev/|mean| to
  // exceed a small floor. A constant-velocity bot has stddev ≈ 0; a
  // human's natural acceleration / deceleration easily produces CoV
  // well above the threshold.
  //
  // We skip pairs with Δt == 0 (two events coalesced into the same
  // millisecond) instead of failing — high-frequency pointermove can
  // legitimately produce these and they carry no velocity info.
  let vCount = 0;
  let vSum = 0;
  let vSumSq = 0;
  for (let i = 1; i < n; i++) {
    const sa = trajectory[i - 1] as TrajectorySample;
    const sb = trajectory[i] as TrajectorySample;
    const dt = sb.t - sa.t;
    if (dt <= 0) continue;
    const v = (sb.x - sa.x) / dt;
    vCount += 1;
    vSum += v;
    vSumSq += v * v;
  }
  if (vCount < 2) {
    return { ok: false, error: "Trajectory degenerate" };
  }
  const vMean = vSum / vCount;
  const vVar = vSumSq / vCount - vMean * vMean;
  const vStdDev = Math.sqrt(Math.max(0, vVar));
  // Coefficient of variation is undefined when |mean| is ~0; guard
  // with an absolute-stddev floor in that pathological case so a bot
  // can't game the check by sending a zero-mean (no-net-motion)
  // trajectory. Note: a zero-mean trajectory would also have failed
  // the finalX-near-targetX check above, so this is belt-and-braces.
  const vCoV =
    Math.abs(vMean) > 1e-6 ? vStdDev / Math.abs(vMean) : vStdDev;
  if (vCoV < MIN_VELOCITY_COV) {
    return { ok: false, error: "Trajectory too uniform" };
  }

  // All checks pass — issue token.
  const verifiedAt = Date.now();
  const tokenRand = crypto.randomBytes(12).toString("base64url");
  const tokenPayload = `${tokenRand}.${verifiedAt}`;
  const tokenSig = hmacSign(`slider-token.${tokenPayload}`);
  return { ok: true, token: `slider.v1.${tokenPayload}.${tokenSig}` };
}

export interface ConsumeResult {
  ok: boolean;
  error?: string;
}

/**
 * One-time consume of a slider token. Wired into `verifyCaptcha()` in
 * B9.3 so the existing /auth/signup and /auth/login routes can accept
 * either a reCAPTCHA token or a slider token.
 */
export function consumeSliderToken(token: string): ConsumeResult {
  if (typeof token !== "string" || !token.startsWith("slider.v1.")) {
    return { ok: false, error: "Not a slider token" };
  }
  const body = token.slice("slider.v1.".length);
  const parts = body.split(".");
  if (parts.length !== 3) {
    return { ok: false, error: "Invalid slider token format" };
  }
  const [rand, verifiedAtStr, sig] = parts;
  const verifiedAt = Number.parseInt(verifiedAtStr, 10);
  if (!Number.isFinite(verifiedAt)) {
    return { ok: false, error: "Invalid slider token" };
  }
  const expectedSig = hmacSign(`slider-token.${rand}.${verifiedAtStr}`);
  if (!constantTimeEqualString(sig, expectedSig)) {
    return { ok: false, error: "Invalid slider token signature" };
  }
  const now = Date.now();
  if (now > verifiedAt + TOKEN_TTL_MS) {
    return { ok: false, error: "Slider token expired" };
  }
  gcConsumed(now);
  if (consumedTokens.has(token)) {
    return { ok: false, error: "Slider token already used" };
  }
  consumedTokens.set(token, now + TOKEN_REPLAY_WINDOW_MS);
  return { ok: true };
}

export function isSliderToken(token: unknown): boolean {
  return typeof token === "string" && token.startsWith("slider.v1.");
}
