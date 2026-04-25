import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Disable etag overhead for API JSON; we don't rely on it and it costs CPU.
app.set("etag", false);

// gzip / deflate every response > 1KB. Cuts JSON payload size 60-80% on the
// wire — huge perceived speedup on slow mobile networks (3G/Edge in India).
// Brotli isn't built into the `compression` package; gzip is the safe default
// supported by every browser. We skip already-compressed media.
app.use(
  compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      const type = String(res.getHeader("Content-Type") || "");
      if (/^image\/(?!svg)|^video\/|^audio\/|application\/zip|application\/gzip/.test(type)) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ─────────────────────────────────────────────────────────────────────────────
// Static frontend serving (production).
//
// In prod we serve the qorix-markets SPA from this same Express server so that
// the `compression` middleware above can gzip JS/CSS bundles. Replit's built-in
// static handler does NOT compress static assets, which on the slow Indian
// mobile networks (3G/Edge) caused 30+ second blank-page loads (3 MB of raw JS).
// Serving via Express + gzip cuts that ~5x and adds proper cache headers on
// content-hashed assets so repeat visits are instant.
// In dev, dist/public doesn't exist — the block is skipped and Vite serves
// the frontend on its own port (no behavior change for dev).
// ─────────────────────────────────────────────────────────────────────────────
// Resolve project root from this bundle's location, NOT process.cwd() —
// cwd differs between dev (artifacts/api-server) and prod (project root).
// In both cases the bundled JS lives at artifacts/api-server/dist/<file>.mjs
// so going up 3 levels lands at the monorepo root reliably.
const __here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__here, "..", "..", "..");
const STATIC_DIR = path.join(PROJECT_ROOT, "artifacts", "qorix-markets", "dist", "public");
if (existsSync(STATIC_DIR)) {
  // Vite content-hashes everything in /assets — safe to cache 1 year + immutable.
  app.use(
    "/assets",
    express.static(path.join(STATIC_DIR, "assets"), {
      maxAge: "1y",
      immutable: true,
      index: false,
      etag: false,
      lastModified: false,
    }),
  );

  // Other public files (favicon, manifest, icons, og images, etc).
  // index.html / sw.js / manifest.json must NEVER be long-cached so users get
  // the latest deploy immediately.
  app.use(
    express.static(STATIC_DIR, {
      maxAge: "1h",
      index: false,
      etag: false,
      lastModified: true,
      setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        if (
          base === "index.html" ||
          base === "sw.js" ||
          base === "manifest.json" ||
          base === "version.json"
        ) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        }
      },
    }),
  );

  // SPA fallback — non-/api/* HTML navigation requests return index.html so
  // client-side routing (wouter) takes over. /api/* never falls through here
  // because express matches "/api" router above first. Express 5 dropped string
  // `*` wildcard, so use a generic middleware filtered to GET/HEAD.
  //
  // CRITICAL: do NOT serve index.html for missing static asset URLs — that
  // would 200-with-HTML for a missing /assets/foo.js and poison the service
  // worker / browser cache during deploy mismatches. Any request that looks
  // like an asset (extension, /assets/ path, or non-HTML Accept) gets a real
  // 404 by falling through to express's default handler.
  const ASSET_LIKE = /\.[a-zA-Z0-9]{1,8}$/; // .js, .css, .png, .json, .map, .woff2, etc.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/")) return next();
    if (req.path.startsWith("/assets/")) return next(); // missing hashed asset → 404
    if (ASSET_LIKE.test(req.path)) return next(); // sw.js, favicon.ico, manifest.json, etc.
    const accept = String(req.headers.accept || "");
    if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
      return next(); // XHR/fetch with explicit non-HTML Accept → 404
    }
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });

  logger.info({ staticDir: STATIC_DIR }, "Static frontend serving enabled (gzip + immutable assets)");
} else {
  logger.info({ staticDir: STATIC_DIR }, "Static frontend dir not found — running API-only (dev mode)");
}

export default app;
