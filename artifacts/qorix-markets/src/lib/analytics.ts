/**
 * Lightweight Google Analytics 4 wrapper. The measurement ID is read from
 * the build-time env var VITE_GA_MEASUREMENT_ID. If unset, every helper
 * is a no-op so dev / preview builds never ping GA.
 *
 * Init pattern:
 *   - initAnalytics() injects the gtag.js loader once on app boot.
 *   - trackPageView(path) is fired on every wouter location change.
 *   - trackEvent(name, params) is fired by CTA buttons, form submits, etc.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
let initialised = false;

export function isAnalyticsEnabled() {
  return !!GA_ID && typeof window !== "undefined";
}

export function initAnalytics() {
  if (initialised || !isAnalyticsEnabled()) return;
  initialised = true;
  try {
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { send_page_view: false });
  } catch {
    /* If injection fails for any reason, swallow — analytics is non-critical. */
  }
}

export function trackPageView(path: string, title?: string) {
  if (!isAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title ?? document.title,
    page_location: window.location.href,
  });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!isAnalyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("event", name, params ?? {});
}

/** Convenience helper for CTA clicks across the marketing site. */
export function trackCta(label: string, location?: string) {
  trackEvent("cta_click", { cta_label: label, cta_location: location });
}
