import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { maintenanceMiddleware } from "./middlewares/maintenance";

const app: Express = express();

// Trust the first proxy hop. Replit (deploys & dev preview) terminates TLS at
// the edge proxy and forwards X-Forwarded-For/Proto/Host headers. Without this,
// express-rate-limit and req.ip read the proxy address instead of the client,
// and rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. Setting `1` is
// safe here because we only ever sit behind exactly one Replit proxy hop.
app.set("trust proxy", 1);

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
// CORS — when the web app and api are served on different origins (Fly prod:
// qorixmarkets.com → api.qorixmarkets.com) the browser needs an explicit
// allow-list and `credentials: true` for cookie-based auth to work. In
// Replit dev the Vite proxy keeps everything same-origin so unsetting
// CORS_ORIGIN keeps the permissive default.
const corsOriginEnv = process.env["CORS_ORIGIN"]?.trim();
if (corsOriginEnv) {
  const allowedOrigins = corsOriginEnv
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        // Allow same-origin / curl / health probes (no Origin header).
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`Origin ${origin} not allowed by CORS_ORIGIN`));
      },
      credentials: true,
    }),
  );
} else {
  app.use(cors());
}
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

// Maintenance gate sits in front of every /api route. When MAINTENANCE_MODE=true
// (set as a Fly secret during the cutover window) it lets reads through with a
// header marker and rejects writes with a structured 503 — replacing the blunt
// "scale to zero machines → raw 503 on every request" approach in
// MUMBAI_DB_CUTOVER_RUNBOOK.md step 2.
app.use("/api", maintenanceMiddleware, router);

// ─── Centralised error logger ─────────────────────────────────────────────
// Express's built-in 500 handler swallows the underlying exception (sends a
// generic "Internal Server Error" HTML page and only writes to stderr in
// dev). When something inside an async route rejects we want the FULL stack
// trace surfaced through pino so it shows up in `fly logs` — without that,
// a route handler that throws appears in logs only as pino-http's outer
// "request errored, statusCode: 500" entry, which is useless for debugging.
//
// Mounted AFTER the routes so it only catches errors that propagated up
// from a handler. Must take 4 args for Express to recognise it as an error
// middleware. `_next` is unused but the signature is required.
app.use(
  (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    // Walk the .cause chain so wrapper errors (e.g. Drizzle's
    // "Failed query: ..." which puts the underlying postgres error in
    // err.cause) actually reveal the root reason in fly logs.
    const chain: Array<{ type: string; message: string; stack?: string; code?: string; detail?: string }> = [];
    let cur: unknown = err;
    let depth = 0;
    while (cur && depth < 5) {
      const c = cur instanceof Error ? cur : new Error(String(cur));
      const anyC = c as Error & { code?: unknown; detail?: unknown; cause?: unknown };
      chain.push({
        type: c.constructor.name,
        message: c.message,
        stack: c.stack,
        code: typeof anyC.code === "string" || typeof anyC.code === "number" ? String(anyC.code) : undefined,
        detail: typeof anyC.detail === "string" ? anyC.detail : undefined,
      });
      cur = anyC.cause;
      depth++;
    }
    logger.error(
      {
        err: chain[0],
        causeChain: chain.slice(1),
        route: `${req.method} ${req.path}`,
      },
      "unhandled route error",
    );
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal Server Error" });
  },
);

export default app;
