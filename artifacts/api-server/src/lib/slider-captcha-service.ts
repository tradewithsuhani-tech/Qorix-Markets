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
 * Bot signals enforced server-side (B9.1 floor; B9.4 will harden):
 *   - finalX must be within ±5 px of targetX.
 *   - Trajectory must have at least 5 samples.
 *   - Drag duration must be 200 ms ≤ d ≤ 15 000 ms.
 *   - Vertical (y) variance must exceed a small floor — perfectly
 *     horizontal y = constant strongly indicates a bot.
 *   - Trajectory timestamps must be monotonic non-decreasing.
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
    if (i === 0) firstT = s.t;
    lastT = s.t;
    ySum += s.y;
    ySumSq += s.y * s.y;
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
