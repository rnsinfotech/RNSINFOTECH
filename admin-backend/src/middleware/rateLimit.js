const crypto = require("crypto");
const RateLimit = require("../models/RateLimit");
const ApiError = require("../utils/ApiError");
const { env } = require("../config/env");

function hash(value) { return crypto.createHash("sha256").update(String(value || "")).digest("hex"); }
function clientIp(req) { return String(req.ip || req.socket?.remoteAddress || "unknown").slice(0, 128); }

function createRateLimiter({ name, limit, windowMs, key = (req) => clientIp(req), message = "Too many requests. Please try again later.", failClosed = false }) {
  return async function rateLimit(req, res, next) {
    if (env.nodeEnv === "test" && !env.rateLimitInTests) return next();
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const rawKey = `${name}:${windowStart}:${key(req)}`;
    const dbKey = hash(rawKey);
    const expiresAt = new Date(windowStart + windowMs + 60_000);
    try {
      let doc;
      try {
        doc = await RateLimit.findOneAndUpdate(
          { key: dbKey },
          { $setOnInsert: { key: dbKey, windowStart: new Date(windowStart), expiresAt }, $inc: { count: 1 } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
      } catch (err) {
        if (err.code !== 11000) throw err;
        doc = await RateLimit.findOneAndUpdate({ key: dbKey }, { $inc: { count: 1 } }, { new: true }).lean();
      }
      const remaining = Math.max(0, limit - Number(doc?.count || 0));
      res.setHeader("X-RateLimit-Limit", String(limit));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((windowStart + windowMs) / 1000)));
      if (Number(doc?.count || 0) > limit) {
        const retryAfter = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
        res.setHeader("Retry-After", String(retryAfter));
        return next(new ApiError(429, message, { code: "RATE_LIMITED", details: { retryAfterSeconds: retryAfter } }));
      }
      return next();
    } catch (err) {
      if (failClosed) return next(new ApiError(503, "Security controls are temporarily unavailable. Please try again shortly.", { code: "RATE_LIMIT_STORE_UNAVAILABLE" }));
      return next();
    }
  };
}

const generalRateLimit = createRateLimiter({ name: "general", limit: env.generalRateLimit, windowMs: env.generalRateWindowMs });
const authRateLimit = createRateLimiter({ failClosed: true, name: "auth", limit: env.authRateLimit, windowMs: env.authRateWindowMs, key: (req) => `${clientIp(req)}:${String(req.body?.email || "").trim().toLowerCase()}` });
const otpRateLimit = createRateLimiter({ failClosed: true, name: "otp", limit: env.otpRateLimit, windowMs: env.otpRateWindowMs, key: (req) => `${clientIp(req)}:${String(req.body?.email || "").trim().toLowerCase()}` });
const paymentRateLimit = createRateLimiter({ failClosed: true, name: "payment", limit: env.paymentRateLimit, windowMs: env.paymentRateWindowMs, key: (req) => `${clientIp(req)}:${req.auth?.userId || "anonymous"}` });
const sensitiveRateLimit = createRateLimiter({ failClosed: true, name: "sensitive", limit: env.sensitiveRateLimit, windowMs: env.sensitiveRateWindowMs, key: (req) => `${clientIp(req)}:${req.auth?.userId || req.admin?._id || "anonymous"}` });

module.exports = { createRateLimiter, generalRateLimit, authRateLimit, otpRateLimit, paymentRateLimit, sensitiveRateLimit };
