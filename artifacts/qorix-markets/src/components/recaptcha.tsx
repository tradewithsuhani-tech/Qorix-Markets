import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (container: HTMLElement | string, options: Record<string, unknown>) => number;
      reset: (widgetId?: number) => void;
    };
    __recaptchaScriptLoading?: Promise<void>;
  }
}

const SCRIPT_SRC = "https://www.google.com/recaptcha/api.js?render=explicit";

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.grecaptcha?.render) return Promise.resolve();
  if (window.__recaptchaScriptLoading) return window.__recaptchaScriptLoading;

  window.__recaptchaScriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src^="https://www.google.com/recaptcha/api.js"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load reCAPTCHA")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load reCAPTCHA"));
    document.head.appendChild(s);
  });
  return window.__recaptchaScriptLoading;
}

interface RecaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

/**
 * Google reCAPTCHA v2 ("I'm not a robot") widget. Renders nothing if
 * `VITE_RECAPTCHA_SITE_KEY` is not configured, so the app still works locally
 * before captcha setup.
 */
export function Recaptcha({ onVerify, onExpire }: RecaptchaProps) {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadRecaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.grecaptcha) return;
        window.grecaptcha.ready(() => {
          if (cancelled || !containerRef.current || !window.grecaptcha) return;
          try {
            widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
              sitekey: siteKey,
              callback: (token: string) => onVerify(token),
              "expired-callback": () => onExpire?.(),
              "error-callback": () => setError("Captcha failed to load"),
              theme: "dark",
            });
          } catch (e) {
            // Already rendered (StrictMode double-mount) — ignore.
          }
        });
      })
      .catch(() => setError("Captcha failed to load"));

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try { window.grecaptcha.reset(widgetIdRef.current); } catch { /* no-op */ }
      }
      widgetIdRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;

  return (
    <div className="w-full flex justify-center">
      <div ref={containerRef} />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export const CAPTCHA_ENABLED = !!import.meta.env.VITE_RECAPTCHA_SITE_KEY;
