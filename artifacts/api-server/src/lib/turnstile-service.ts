import { logger } from "./logger";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Cloudflare Turnstile token.
 *
 * Behavior:
 *  - If `TURNSTILE_SECRET_KEY` is not set, captcha is treated as disabled and
 *    verification is skipped (returns `{ ok: true, skipped: true }`). This
 *    matches the existing `verifyRecaptcha` behavior so local/dev environments
 *    work without captcha configuration.
 *  - If the secret is set and the token is missing/invalid, returns
 *    `{ ok: false }`.
 *
 * Cloudflare's `siteverify` response shape:
 *   {
 *     success: boolean,
 *     "error-codes": string[],
 *     challenge_ts: string,
 *     hostname: string,
 *     action?: string,
 *     cdata?: string,
 *   }
 *
 * See: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function verifyTurnstileToken(
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
    form.set("secret", secret as string);
    form.set("response", token as string);
    if (ip) form.set("remoteip", ip as string);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
      challenge_ts?: string;
      hostname?: string;
      action?: string;
      cdata?: string;
    };

    if (!data.success) {
      logger.warn(
        { errors: data["error-codes"] },
        "[turnstile-service] verification failed",
      );
      return { ok: false, error: "Captcha verification failed" };
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err }, "[turnstile-service] verification error");
    return { ok: false, error: "Captcha verification error" };
  }
}

export function isTurnstileEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY;
}
