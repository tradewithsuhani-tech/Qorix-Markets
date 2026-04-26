import express, { type Express } from "express";
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

export default app;
