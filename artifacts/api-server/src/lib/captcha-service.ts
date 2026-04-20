import { logger } from "./logger";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

/**
 * Verify a Google reCAPTCHA token (v2 checkbox or v3 invisible).
 *
 * Behavior:
 *  - If `RECAPTCHA_SECRET_KEY` is not set, captcha is treated as disabled and
 *    verification is skipped (returns `{ ok: true, skipped: true }`). This lets
 *    local/dev environments work without captcha configuration.
 *  - If the secret is set and the token is missing/invalid, returns `{ ok: false }`.
 *
 * See: https://developers.google.com/recaptcha/docs/verify
 */
export async function verifyCaptcha(
  token: string | undefined | null,
  ip: string | undefined,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  // TEMPORARILY DISABLED — captcha verification bypassed until reCAPTCHA admin
  // console has the production + dev domains whitelisted. Remove this early
  // return to re-enable captcha verification.
  return { ok: true, skipped: true };

  // eslint-disable-next-line no-unreachable
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return { ok: true, skipped: true };
  }

  if (!token || typeof token !== "string") {
    return { ok: false, error: "Captcha required" };
  }

  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);

    const res = await fetch(RECAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = (await res.json()) as {
      success: boolean;
      score?: number;
      "error-codes"?: string[];
    };

    if (!data.success) {
      logger.warn({ errors: data["error-codes"] }, "[captcha-service] reCAPTCHA verification failed");
      return { ok: false, error: "Captcha verification failed" };
    }

    // Optional v3 score threshold (0.0 = bot, 1.0 = human). Skip if absent (v2 checkbox).
    if (typeof data.score === "number" && data.score < 0.5) {
      logger.warn({ score: data.score }, "[captcha-service] reCAPTCHA score below threshold");
      return { ok: false, error: "Captcha verification failed" };
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err }, "[captcha-service] verification error");
    return { ok: false, error: "Captcha verification error" };
  }
}

export function isCaptchaEnabled(): boolean {
  return !!process.env.RECAPTCHA_SECRET_KEY;
}
