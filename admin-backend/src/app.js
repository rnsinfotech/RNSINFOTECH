const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const { env } = require("./config/env");
const routes = require("./routes");
const telemetryRoutes = require("./routes/telemetry.routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { generalRateLimit } = require("./middleware/rateLimit");
const requestId = require("./middleware/requestId");
const ApiError = require("./utils/ApiError");

function createApp() {
  const app = express();
  app.use(requestId);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: env.nodeEnv === "production" ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  }));
  app.use(compression());
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = env.corsOrigin || [];
        if (!origin || allowed.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new ApiError(403, "CORS origin not allowed.", { code: "CORS_ORIGIN_DENIED" }));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(generalRateLimit);
  app.use(express.json({ limit: "1mb", strict: true, parameterLimit: 100 }));
  app.use(express.urlencoded({ extended: true, limit: "256kb", parameterLimit: 100, depth: 5 }));

  if (env.nodeEnv !== "test") {
    const logger = require("./utils/logger");
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => logger.info("http_request", { requestId: req.id, method: req.method, path: req.originalUrl, status: res.statusCode, durationMs: Date.now() - started, ip: req.ip }));
      next();
    });
  }

  // Every real route lives under /api — keeps room for a future
  // /api/v2 without renaming anything, and keeps "/" free for a plain
  // landing response.
  app.get("/", (req, res) => {
    res.json({ service: "admin-backend", status: "running" });
  });
  app.use("/api", routes);
  app.use("/api/telemetry", telemetryRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
