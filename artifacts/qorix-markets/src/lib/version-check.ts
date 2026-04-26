import { useEffect, useState } from "react";

declare const __APP_VERSION__: string;

/**
 * Build version baked in at compile time. The runtime version checker fetches
 * /version.json and compares it against this value; a mismatch means the user
 * is viewing a stale, browser-cached bundle.
 */
export const APP_VERSION: string =
  typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";

const POLL_INTERVAL_MS = 60_000;

interface ServerVersion {
  version?: string;
  builtAt?: string;
}

/**
 * Polls /version.json (no-store) and returns true once the server reports a
 * version different from the bundle the user is currently running. Skips the
 * check entirely in dev (where __APP_VERSION__ is rebuilt on every HMR pass).
 */
export function useVersionCheck(): { updateAvailable: boolean; reload: () => void } {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (APP_VERSION === "dev") return;

    let cancelled = false;
    let warnedMalformed = false;

    const warnOnce = (reason: string, detail?: unknown) => {
      if (warnedMalformed) return;
      warnedMalformed = true;
      // Reachable but unparseable response — surface once so it shows up in
      // browser logs / error reporting without spamming every poll.
      console.warn(`[version-check] /version.json ${reason}`, detail);
    };

    const check = async () => {
      let res: Response;
      try {
        const url = `/version.json?_=${Date.now()}`;
        res = await fetch(url, {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
      } catch {
        // Network blip — silently retry on next interval.
        return;
      }

      if (!res.ok) {
        warnOnce(`returned HTTP ${res.status}`);
        return;
      }

      let data: ServerVersion;
      try {
        data = (await res.json()) as ServerVersion;
      } catch (err) {
        warnOnce("response was not valid JSON", err);
        return;
      }

      if (!data || typeof data.version !== "string" || !data.version) {
        warnOnce("response is missing a string `version` field", data);
        return;
      }

      if (!cancelled && data.version !== APP_VERSION) {
        setUpdateAvailable(true);
      }
    };

    check();
    const t = setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { updateAvailable, reload: forceReload };
}

/**
 * Hard-resets the client: clears Cache Storage, unregisters service workers,
 * then reloads the page so the freshly-deployed bundle is fetched from the
 * network. Safe to call on user gesture (banner tap) or automatically.
 */
export async function forceReload(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  // Cache-busting query param forces the browser to bypass disk cache for
  // index.html on platforms that ignore Cache-Control headers (e.g. some CDNs).
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now()));
  window.location.replace(url.toString());
}
