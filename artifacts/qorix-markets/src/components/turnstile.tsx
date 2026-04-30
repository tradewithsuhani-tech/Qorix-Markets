import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: Record<string, unknown>,
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
    __turnstileScriptLoading?: Promise<void>;
  }
}

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

async function waitForTurnstile(timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.turnstile?.render) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Turnstile did not become ready");
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile?.render) return Promise.resolve();
  if (window.__turnstileScriptLoading) return window.__turnstileScriptLoading;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(
      `script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]`,
    );
    if (existing) {
      // Script tag is already in DOM. It may have already fired `load` before
      // we attached listeners — fall back to polling for `window.turnstile`.
      waitForTurnstile().then(resolve).catch(reject);
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => waitForTurnstile().then(resolve).catch(reject);
    s.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(s);
  });

  // On rejection, clear the cached promise so callers can retry on next mount.
  promise.catch(() => {
    window.__turnstileScriptLoading = undefined;
  });

  window.__turnstileScriptLoading = promise;
  return promise;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

/**
 * Imperative handle exposed via `forwardRef` so a parent form can
 * programmatically reset the widget after a failed submit. Same shape as
 * `RecaptchaHandle` so the wrapper component (`captcha-widget.tsx`) can
 * forward the same handle type regardless of which provider is active.
 */
export interface TurnstileHandle {
  reset: () => void;
}

/**
 * Cloudflare Turnstile widget. Renders nothing if `VITE_TURNSTILE_SITE_KEY`
 * is not configured, so the app still works locally before captcha setup.
 * Parents can hold a ref of type `TurnstileHandle` and call `.reset()` to
 * clear the widget after a failed submit.
 *
 * Mirrors the public surface of `<Recaptcha>` in `recaptcha.tsx` so the two
 * widgets are interchangeable from the form's perspective.
 */
export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(
  function Turnstile({ onVerify, onExpire }, ref) {
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (widgetIdRef.current && window.turnstile) {
            try {
              window.turnstile.reset(widgetIdRef.current);
            } catch {
              /* widget already destroyed or out-of-sync — no-op */
            }
          }
          // Tell the parent the token is gone too, so any local copy of
          // the consumed token gets cleared in the same tick.
          onExpire?.();
        },
      }),
      [onExpire],
    );

    useEffect(() => {
      if (!siteKey || !containerRef.current) return;
      let cancelled = false;

      loadTurnstileScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return;
          try {
            widgetIdRef.current = window.turnstile.render(containerRef.current, {
              sitekey: siteKey,
              callback: (token: string) => onVerify(token),
              "expired-callback": () => onExpire?.(),
              "error-callback": () => setError("Captcha failed to load"),
              theme: "dark",
              // Cloudflare-supported responsive size (≥300px container).
              // Lets the widget fill the form column instead of looking like
              // a fixed 300×65 island bolted onto the dark theme.
              size: "flexible",
            });
          } catch {
            // Already rendered (StrictMode double-mount) — ignore.
          }
        })
        .catch(() => setError("Captcha failed to load"));

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            /* no-op */
          }
        }
        widgetIdRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteKey]);

    if (!siteKey) return null;

    return (
      <div className="w-full">
        {/*
         * Glassy themed wrapper. The Cloudflare-rendered iframe inside is
         * cross-origin so we can't restyle its interior — but we can frame
         * it with the same blue/indigo accent the login + admin-login forms
         * use, so the widget reads as a deliberate part of the form rather
         * than a default Cloudflare island bolted on. The inner container
         * uses `min-h` to absorb the small layout shift between the
         * "loading" placeholder size and the rendered widget size, and the
         * iframe gets rounded corners + a soft inner ring via descendant
         * selectors so it visually merges with the wrapper.
         */}
        <div
          className={[
            "relative rounded-xl p-2",
            "border border-blue-500/25",
            "bg-gradient-to-br from-blue-500/[0.06] via-indigo-500/[0.05] to-purple-500/[0.06]",
            "shadow-[0_0_28px_-10px_rgba(59,130,246,0.45)]",
            "transition-all",
            "[&_iframe]:rounded-lg [&_iframe]:!w-full [&_iframe]:block",
          ].join(" ")}
        >
          <div ref={containerRef} className="min-h-[65px] flex items-center justify-center" />
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
        )}
      </div>
    );
  },
);

// Captcha is enforced server-side on BOTH /auth/login AND /auth/signup.
// Driven by VITE_TURNSTILE_SITE_KEY at build time so local/dev builds without
// the env var continue to render the form without the widget.
export const TURNSTILE_ENABLED = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;
