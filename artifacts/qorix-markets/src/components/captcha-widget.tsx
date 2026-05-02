import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  Recaptcha,
  CAPTCHA_ENABLED as RECAPTCHA_ENABLED,
  type RecaptchaHandle,
} from "./recaptcha";
import {
  Turnstile,
  TURNSTILE_ENABLED,
  type TurnstileHandle,
} from "./turnstile";

/**
 * Build-time captcha provider switch. Defaults to `recaptcha` so a deploy
 * that forgets to set this env var keeps the existing reCAPTCHA behavior —
 * the safe default during the B9.6 rollout window.
 *
 * Set `VITE_CAPTCHA_PROVIDER=turnstile` at build time to swap to Cloudflare
 * Turnstile. The chosen provider must also have its corresponding site key
 * (`VITE_RECAPTCHA_SITE_KEY` or `VITE_TURNSTILE_SITE_KEY`) baked into the
 * bundle.
 *
 * Set `VITE_CAPTCHA_PROVIDER=none` to fully disable the captcha widget —
 * intended for local/dev environments where the captcha vendor's domain
 * allowlist (e.g. Turnstile site key bound to qorixmarkets.com) blocks the
 * widget from rendering on Replit `.replit.dev` previews. The server has a
 * matching `CAPTCHA_PROVIDER=none` that skips verification, so login/signup
 * works end-to-end without any captcha round-trip. NEVER set this in prod.
 *
 * The server has the matching switch (`CAPTCHA_PROVIDER`) and verifies
 * tokens against the same provider — so as long as both halves of the
 * deploy use the same value, the widget shipped to the browser and the
 * verifier on the API server agree.
 */
const RAW_PROVIDER = import.meta.env.VITE_CAPTCHA_PROVIDER as string | undefined;
const PROVIDER: "recaptcha" | "turnstile" | "none" =
  RAW_PROVIDER === "turnstile"
    ? "turnstile"
    : RAW_PROVIDER === "none"
      ? "none"
      : "recaptcha";

export type CaptchaProvider = "recaptcha" | "turnstile" | "none";

export const CAPTCHA_PROVIDER: CaptchaProvider = PROVIDER;

/**
 * `true` iff the active provider has its site key configured. Mirrors the
 * pre-existing `CAPTCHA_ENABLED` so the form's existing render gate still
 * works without per-provider awareness. When PROVIDER==="none" this is
 * forced false so every `CAPTCHA_ENABLED && ...` gate in callers (login
 * button enable, render of widget, server token requirement) becomes a
 * no-op.
 */
export const CAPTCHA_ENABLED =
  PROVIDER === "none"
    ? false
    : PROVIDER === "turnstile"
      ? TURNSTILE_ENABLED
      : RECAPTCHA_ENABLED;

interface CaptchaWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export interface CaptchaWidgetHandle {
  reset: () => void;
}

/**
 * Provider-agnostic captcha widget. Picks Turnstile or reCAPTCHA at build
 * time based on `VITE_CAPTCHA_PROVIDER`. Same `forwardRef` interface as the
 * underlying widgets, so the parent form can hold a single ref of type
 * `CaptchaWidgetHandle` and call `.reset()` on a failed submit regardless
 * of which provider is active.
 *
 * Tokens emitted by either provider are sent to the API server as
 * `captchaToken` in the request body — the server-side dispatcher
 * (`verifyCaptcha` in `lib/captcha-service.ts`) decides how to verify them
 * based on its own `CAPTCHA_PROVIDER` env var.
 */
export const CaptchaWidget = forwardRef<CaptchaWidgetHandle, CaptchaWidgetProps>(
  function CaptchaWidget({ onVerify, onExpire }, ref) {
    const recaptchaRef = useRef<RecaptchaHandle | null>(null);
    const turnstileRef = useRef<TurnstileHandle | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (PROVIDER === "none") {
            return;
          }
          if (PROVIDER === "turnstile") {
            turnstileRef.current?.reset();
          } else {
            recaptchaRef.current?.reset();
          }
        },
      }),
      [],
    );

    if (PROVIDER === "none") {
      return null;
    }
    if (PROVIDER === "turnstile") {
      return (
        <Turnstile ref={turnstileRef} onVerify={onVerify} onExpire={onExpire} />
      );
    }
    return (
      <Recaptcha ref={recaptchaRef} onVerify={onVerify} onExpire={onExpire} />
    );
  },
);
