import { logger } from "./logger";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Cloudflare Turnstile captcha token.
 *
 * Behavior:
 *  - If `TURNSTILE_SECRET_KEY` is not set, captcha is treated as disabled and
 *    verification is skipped (returns `{ ok: true, skipped: true }`). This lets
 *    local/dev environments work without captcha configuration.
 *  - If the secret is set and the token is missing/invalid, returns `{ ok: false }`.
 *
 * See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyCaptcha(
  token: string | undefined | null,
  ip: string | undefined,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
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

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    if (!data.success) {
      logger.warn({ errors: data["error-codes"] }, "[captcha-service] verification failed");
      return { ok: false, error: "Captcha verification failed" };
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err }, "[captcha-service] verification error");
    return { ok: false, error: "Captcha verification error" };
  }
}

export function isCaptchaEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}
