import { Router } from "express";
import { logger } from "../lib/logger";
import { makeRedisLimiter } from "../middlewares/rate-limit";
import {
  issueSliderChallenge,
  verifySliderSolution,
} from "../lib/slider-captcha-service";

/**
 * Batch 9.1 — Public slider-captcha endpoints.
 *
 * Both routes are intentionally unauthenticated: signup / login
 * (and other pre-auth flows) need to be able to fetch and solve a
 * captcha BEFORE the user has a token. The challenge envelope is
 * HMAC-signed by the slider-captcha-service so a malicious caller
 * cannot fabricate a `targetX` that the verify endpoint will accept.
 *
 * Verification failures return HTTP 200 with `{ ok: false, error }`
 * (instead of 4xx) so the client treats them as "wrong answer, try
 * again" rather than network/server errors. This matches the
 * behaviour of the major captcha vendors and lets us keep one error
 * surface in the React component.
 */

// B9.4 — Per-IP rate limit on both captcha endpoints. 60/min/IP is
// generous enough that a real user retrying the puzzle several times
// (or refreshing a signup form) will never see a 429, while bounding
// brute-force trajectory mining at 1 attempt/sec/IP. Same Redis-backed
// store used by /auth/login etc., so the cap survives across all Fly
// instances (BOM 2x + SIN 1x). One shared bucket for both endpoints
// because the issue→verify pair is always called together by the
// React component — splitting them would let an attacker double their
// effective verify budget by burning the challenge bucket separately.
const sliderCaptchaLimiter = makeRedisLimiter({
  name: "slider-captcha",
  windowMs: 60_000,
  limit: 60,
  message: {
    error: "Too many captcha requests, slow down.",
    code: "rate_limited",
  },
});

const router = Router();

router.post("/captcha/slider/challenge", sliderCaptchaLimiter, (_req, res) => {
  try {
    const challenge = issueSliderChallenge();
    res.json(challenge);
  } catch (err) {
    logger.error({ err }, "[captcha/slider/challenge] failed to issue");
    res.status(500).json({ error: "Failed to issue challenge" });
  }
});

router.post("/captcha/slider/verify", sliderCaptchaLimiter, (req, res) => {
  const body = (req.body ?? {}) as {
    challengeId?: unknown;
    finalX?: unknown;
    trajectory?: unknown;
  };

  if (typeof body.challengeId !== "string") {
    res.status(400).json({ ok: false, error: "challengeId required" });
    return;
  }

  const result = verifySliderSolution(
    body.challengeId,
    body.finalX,
    body.trajectory,
  );
  if (!result.ok) {
    res.json({ ok: false, error: result.error ?? "Verification failed" });
    return;
  }
  res.json({ ok: true, token: result.token });
});

export default router;
