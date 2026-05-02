import { logger } from "./logger";
import { verifyTurnstileToken, isTurnstileEnabled } from "./turnstile-service";

const RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";

type CaptchaProvider = "recaptcha" | "turnstile" | "none";

/**
 * Resolve which captcha provider is active. Driven by the `CAPTCHA_PROVIDER`
 * env var added in B9.6 — defaults to `recaptcha` so a deploy that forgets
 * to set the var keeps the existing reCAPTCHA behavior. The frontend has a
 * matching build-time switch (`VITE_CAPTCHA_PROVIDER`); both halves of the
 * deploy must agree on the same value or the issued widget tokens won't
 * round-trip through the verifier.
 *
 * `none` fully disables verification — used in local/dev where the captcha
 * vendor's domain allowlist (e.g. Turnstile site-key bound to qorixmarkets.com)
 * blocks the widget on Replit `.replit.dev` previews. The frontend mirrors
 * this with `VITE_CAPTCHA_PROVIDER=none`. NEVER set on prod.
 *
 * Centralised in this helper so any future code that needs to know the
 * active provider (e.g. the B9.3 risk-based escalator deciding when to
 * fall back to the slider) reads a single source of truth.
 */
export function getCaptchaProvider(): CaptchaProvider {
  if (process.env.CAPTCHA_PROVIDER === "none") return "none";
  return process.env.CAPTCHA_PROVIDER === "turnstile" ? "turnstile" : "recaptcha";
}

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
async function verifyRecaptchaToken(
  token: string | undefined | null,
  ip: string | undefined,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  // Re-enabled in Batch 6 (2026-04-30) after qorixmarkets.com +
  // www.qorixmarkets.com were added to the reCAPTCHA admin-console
  // domain allowlist. The auto-skip below (no `RECAPTCHA_SECRET_KEY`
  // configured) is the only remaining bypass and is the intended
  // local/dev escape hatch — production has the secret set as a
  // Fly app secret so this branch is not taken in prod.
  const secret = process.env.RECAPTCHA_SECRET_KEY;
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
    if (typeof data.score === "number" && (data.score as number) < 0.5) {
      logger.warn({ score: data.score }, "[captcha-service] reCAPTCHA score below threshold");
      return { ok: false, error: "Captcha verification failed" };
    }

    return { ok: true };
  } catch (err) {
    logger.error({ err }, "[captcha-service] verification error");
    return { ok: false, error: "Captcha verification error" };
  }
}

function isRecaptchaEnabled(): boolean {
  return !!process.env.RECAPTCHA_SECRET_KEY;
}

/**
 * Provider-agnostic captcha verification. Routes to the active provider
 * based on `CAPTCHA_PROVIDER` (defaults to `recaptcha`). All callers in
 * `routes/auth.ts` (and any future risk-aware path) use this single entry
 * point — the dispatcher hides whether the token came from Google reCAPTCHA
 * or Cloudflare Turnstile.
 *
 * The legacy local/dev bypass (skip when the active provider's secret is
 * not configured) is preserved per-provider so contributors can still run
 * the api-server locally without setting up either captcha vendor.
 */
export async function verifyCaptcha(
  token: string | undefined | null,
  ip: string | undefined,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const provider = getCaptchaProvider();
  // `none` is the explicit dev/local opt-out — no token check, no upstream
  // round-trip, just pass through. Mirrors the `skipped: true` shape every
  // caller already handles for the "secret not configured" auto-skip path.
  if (provider === "none") {
    return { ok: true, skipped: true };
  }
  if (provider === "turnstile") {
    return verifyTurnstileToken(token, ip);
  }
  return verifyRecaptchaToken(token, ip);
}

/**
 * `true` iff the active provider has its server-side secret configured.
 * Used by the startup warning in `index.ts` to log a clear message when
 * the active provider is mis-configured for production. The `none`
 * provider is intentionally treated as "disabled" here so the startup
 * banner can warn loudly if it ever leaks into a NODE_ENV=production
 * deploy.
 */
export function isCaptchaEnabled(): boolean {
  const provider = getCaptchaProvider();
  if (provider === "none") return false;
  return provider === "turnstile" ? isTurnstileEnabled() : isRecaptchaEnabled();
}
