import express, { type Express } from "express";
import cors from "cors";
import compression from "compression";
import pinoHttp from "pino-http";
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

export default app;
