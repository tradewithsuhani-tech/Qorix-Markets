import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// ─── API base URL wiring ────────────────────────────────────────────────────
// In Replit dev, the Vite dev server proxies /api → localhost:8080, so
// VITE_API_URL stays unset and every fetch is same-origin.
//
// On Fly prod the web app (qorixmarkets.com) and the api (api.qorixmarkets.com)
// live on different origins. VITE_API_URL is baked into the bundle at Docker
// build time and we apply it in two places:
//   1. setBaseUrl() — handles every orval-generated request that uses
//      `customFetch` from @workspace/api-client-react.
//   2. window.fetch shim — handles legacy raw `fetch("/api/...")` calls in
//      pages/components that haven't been migrated to the codegen client.
//      We also flip `credentials` to "include" so the auth cookie is sent
//      cross-origin (matched on the api by `cors({ credentials: true })`).
const VITE_API_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
if (VITE_API_URL) {
  setBaseUrl(VITE_API_URL);

  const sameOrigin = window.location.origin;
  const originalFetch = window.fetch.bind(window);

  const rewriteIfApiPath = (rawUrl: string): string | null => {
    // Absolute URL same-origin: rewrite if pathname starts with /api/
    if (/^https?:\/\//i.test(rawUrl)) {
      try {
        const u = new URL(rawUrl);
        if (u.origin === sameOrigin && u.pathname.startsWith("/api/")) {
          return `${VITE_API_URL}${u.pathname}${u.search}`;
        }
      } catch {
        return null;
      }
      return null;
    }
    // Relative path starting with /api/
    if (rawUrl.startsWith("/api/")) {
      return `${VITE_API_URL}${rawUrl}`;
    }
    return null;
  };

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let target: RequestInfo | URL = input;
    let nextInit: RequestInit | undefined = init;

    if (typeof input === "string") {
      const rewritten = rewriteIfApiPath(input);
      if (rewritten) {
        target = rewritten;
        nextInit = { credentials: "include", ...(init ?? {}) };
      }
    } else if (input instanceof URL) {
      const rewritten = rewriteIfApiPath(input.toString());
      if (rewritten) {
        target = rewritten;
        nextInit = { credentials: "include", ...(init ?? {}) };
      }
    } else if (typeof Request !== "undefined" && input instanceof Request) {
      const rewritten = rewriteIfApiPath(input.url);
      if (rewritten) {
        target = new Request(rewritten, input);
        nextInit = { credentials: "include", ...(init ?? {}) };
      }
    }

    return originalFetch(target, nextInit);
  };
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  }).catch(() => {});
  if ("caches" in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
}

createRoot(document.getElementById("root")!).render(<App />);
