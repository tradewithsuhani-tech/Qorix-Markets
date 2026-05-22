import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { writeFileSync, mkdirSync } from "fs";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// ─── Build version stamp for cache-busting ──────────────────────────────────
// Each build gets a unique timestamp so the client-side update checker can
// detect when a new deployment has gone live and prompt the user to refresh.
const BUILD_VERSION = String(Date.now());

/**
 * Writes /version.json into the build output (and into public/ during dev so
 * the runtime checker has something to fetch). Keeps the asset tiny — the
 * client only needs the version string to compare against the baked-in one.
 */
function buildVersionPlugin(): PluginOption {
  return {
    name: "qorix-build-version",
    apply: () => true,
    buildStart() {
      const publicDir = path.resolve(import.meta.dirname, "public");
      try {
        mkdirSync(publicDir, { recursive: true });
        writeFileSync(
          path.resolve(publicDir, "version.json"),
          JSON.stringify({ version: BUILD_VERSION, builtAt: new Date().toISOString(), captchaProvider: process.env.VITE_CAPTCHA_PROVIDER ?? "recaptcha" }),
        );
      } catch {
        // Non-fatal: dev server still works, version check just degrades gracefully.
      }
    },
  };
}

// PORT and BASE_PATH are only required for the dev/preview server.
// During `vite build` (CI / Fly.io deploy) they are not needed, so we
// fall back to safe defaults instead of throwing.
const rawPort = process.env.PORT ?? "5000";
const port = Number(rawPort);
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  define: {
    // Baked-in build version that the runtime version checker compares
    // against /version.json on the server. Stable across HMR (set once at
    // config load) so detection only fires after a true rebuild + redeploy.
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    buildVersionPlugin(),
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            if (id.includes("/pages/admin")) return "chunk-admin";
            if (id.includes("/pages/p2p")) return "chunk-p2p";
            if (id.includes("/pages/marketing")) return "chunk-marketing";
            if (id.includes("/pages/legal")) return "chunk-legal";
            if (id.includes("/pages/merchant")) return "chunk-merchant";
            if (id.includes("/pages/deposit")) return "chunk-deposit";
            if (id.includes("/pages/withdraw")) return "chunk-withdraw";
            return;
          }
          if (id.includes("recharts") || id.includes("d3-") || id.includes("victory")) return "vendor-charts";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("@tanstack/react-query") || id.includes("react-query")) return "vendor-query";
          if (id.includes("react-dom")) return "vendor-react-dom";
          if (id.includes("html2canvas")) return "vendor-html2canvas";
          return "vendor";
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      // All backend traffic (auth, OTP, forgot-password, deposits, admin, etc.)
      // API_PROXY_TARGET lets you point at the live fly.io API server instead
      // of the local dev server. Set to https://qorix-api.fly.dev to use prod.
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
        secure: true,
        // When proxying to fly.io, rewrite Origin/Referer so the server's
        // origin-guard accepts the request (dev-only; the proxy owns the
        // connection to the API, the browser never talks to fly directly).
        ...(process.env.API_PROXY_TARGET
          ? {
              headers: {
                Origin: "https://qorixmarkets.com",
                Referer: "https://qorixmarkets.com/",
              },
            }
          : {}),
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
