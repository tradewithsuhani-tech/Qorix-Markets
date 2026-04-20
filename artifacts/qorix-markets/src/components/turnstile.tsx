import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    __turnstileScriptLoading?: Promise<void>;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__turnstileScriptLoading) return window.__turnstileScriptLoading;

  window.__turnstileScriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Turnstile")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(s);
  });
  return window.__turnstileScriptLoading;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  action?: string;
}

/**
 * Cloudflare Turnstile widget. Renders nothing if `VITE_TURNSTILE_SITE_KEY`
 * is not configured, so the app still works locally before captcha setup.
 */
export function Turnstile({ onVerify, onExpire, action }: TurnstileProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token: string) => onVerify(token),
          "expired-callback": () => {
            onExpire?.();
          },
          "error-callback": () => setError("Captcha failed to load"),
          theme: "dark",
          size: "flexible",
        });
      })
      .catch(() => setError("Captcha failed to load"));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch { /* no-op */ }
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, action]);

  if (!siteKey) return null;

  return (
    <div className="w-full">
      <div ref={containerRef} />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

export const CAPTCHA_ENABLED = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;
