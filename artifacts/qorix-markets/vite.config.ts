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
          JSON.stringify({ version: BUILD_VERSION, builtAt: new Date().toISOString() }),
        );
      } catch {
        // Non-fatal: dev server still works, version check just degrades gracefully.
      }
    },
  };
}

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

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
    // Aggressive minification + tree-shaking for prod. Modern target keeps
    // bundle small (no IE/old-Safari polyfills) and lets terser drop dead code.
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split heavy vendor libs into their own chunks so the browser can
        // download them in parallel and cache them across deploys (the
        // hashed filename only changes when that vendor's code changes).
        // First paint stays fast — only the page-specific chunk + small
        // shared runtime is required to render.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-dom")) return "vendor-react";
          if (id.includes("/react/") || id.includes("scheduler")) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("date-fns") || id.includes("dayjs")) return "vendor-date";
          if (id.includes("zod") || id.includes("react-hook-form")) return "vendor-forms";
          if (id.includes("wouter")) return "vendor-router";
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
      // is consolidated into the api-server on PORT 8080.
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        secure: false,
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
