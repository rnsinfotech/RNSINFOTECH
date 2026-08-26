const { loadEnvironment } = require("./loadEnv");
const appEnv = loadEnvironment();

const required = [
  "MONGO_URI","CORS_ORIGIN","JWT_ADMIN_SECRET","JWT_ADMIN_TTL","JWT_ADMIN_REFRESH_TTL","PORT",
  "ADMIN_REFRESH_COOKIE_NAME","ADMIN_REFRESH_COOKIE_SAME_SITE","ADMIN_REFRESH_COOKIE_SECURE",
  "ADMIN_LOGIN_MAX_ATTEMPTS","ADMIN_LOGIN_WINDOW_MINUTES","ADMIN_LOGIN_LOCKOUT_MINUTES",
  "ADMIN_PASSWORD_RESET_TTL_MINUTES","ADMIN_PASSWORD_RESET_URL","EMAIL_FROM",
];
const requiredInProduction = ["MONGO_URI","JWT_ADMIN_SECRET","CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET","RESEND_API_KEY","EMAIL_FROM","CASHFREE_APP_ID","CASHFREE_SECRET_KEY","CASHFREE_ENVIRONMENT"];

const corsOrigin = (process.env.CORS_ORIGIN || "").split(",").map((x) => x.trim()).filter(Boolean);
const bool = (v) => String(v).toLowerCase() === "true";
const env = {
  appEnv,
  nodeEnv: process.env.NODE_ENV || (appEnv === "production" || appEnv === "staging" ? "production" : appEnv),
  port: Number(process.env.PORT),
  mongoUri: process.env.MONGO_URI,
  corsOrigin,
  jwtAdminSecret: process.env.JWT_ADMIN_SECRET,
  jwtAdminTtl: process.env.JWT_ADMIN_TTL,
  jwtAdminRefreshTtl: process.env.JWT_ADMIN_REFRESH_TTL,
  adminRefreshCookieName: process.env.ADMIN_REFRESH_COOKIE_NAME,
  adminRefreshCookieSameSite: String(process.env.ADMIN_REFRESH_COOKIE_SAME_SITE || "lax").toLowerCase(),
  adminRefreshCookieSecure: bool(process.env.ADMIN_REFRESH_COOKIE_SECURE),
  adminRefreshCookieDomain: process.env.ADMIN_REFRESH_COOKIE_DOMAIN || undefined,
  adminLoginMaxAttempts: Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS),
  adminLoginWindowMs: Number(process.env.ADMIN_LOGIN_WINDOW_MINUTES) * 60 * 1000,
  adminLoginLockoutMs: Number(process.env.ADMIN_LOGIN_LOCKOUT_MINUTES) * 60 * 1000,
  adminPasswordResetTtlMinutes: Number(process.env.ADMIN_PASSWORD_RESET_TTL_MINUTES),
  adminPasswordResetUrl: process.env.ADMIN_PASSWORD_RESET_URL,
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "",
  adminInvitationUrl: process.env.ADMIN_INVITATION_URL || "",
  adminInvitationTtlMinutes: Math.max(15, Number(process.env.ADMIN_INVITATION_TTL_MINUTES || 1440)),
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  // Single source of truth for the payment gateway, mirroring
  // storefront-backend/src/config/env.js. Nothing outside this object may
  // read a CASHFREE_* variable directly, so sandbox vs production is decided
  // in exactly one place per service.
  cashfree: {
    appId: process.env.CASHFREE_APP_ID || "",
    secretKey: process.env.CASHFREE_SECRET_KEY || "",
    environment: (process.env.CASHFREE_ENVIRONMENT || "sandbox").toLowerCase(),
    apiVersion: process.env.CASHFREE_API_VERSION || "2025-01-01",
  },
  rateLimitInTests: process.env.RATE_LIMIT_IN_TESTS === "true",
  generalRateLimit: Math.max(30, Number(process.env.GENERAL_RATE_LIMIT || 300)),
  generalRateWindowMs: Math.max(10_000, Number(process.env.GENERAL_RATE_LIMIT_WINDOW_SECONDS || 60) * 1000),
  authRateLimit: Math.max(3, Number(process.env.AUTH_RATE_LIMIT || 20)),
  authRateWindowMs: Math.max(10_000, Number(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000),
  sensitiveRateLimit: Math.max(5, Number(process.env.SENSITIVE_RATE_LIMIT || 60)),
  sensitiveRateWindowMs: Math.max(10_000, Number(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MINUTES || 1) * 60 * 1000),
  emailMaxAttempts: Math.max(1, Number(process.env.EMAIL_MAX_ATTEMPTS || 5)),
  emailRetryIntervalSeconds: Math.max(10, Number(process.env.EMAIL_RETRY_INTERVAL_SECONDS || 30)),
};
function assertEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  if (!env.port || env.port < 1 || env.port > 65535) throw new Error("PORT must be a valid TCP port.");
  if (!env.corsOrigin.length) throw new Error("CORS_ORIGIN must contain at least one allowed origin.");
  if (!["lax","strict","none"].includes(env.adminRefreshCookieSameSite)) throw new Error("ADMIN_REFRESH_COOKIE_SAME_SITE must be lax, strict, or none.");
  if (env.adminRefreshCookieSameSite === "none" && !env.adminRefreshCookieSecure) throw new Error("SameSite=None refresh cookies require Secure.");
  if (!env.adminLoginMaxAttempts || env.adminLoginMaxAttempts < 3) throw new Error("ADMIN_LOGIN_MAX_ATTEMPTS must be at least 3.");
  if (!env.adminLoginWindowMs || env.adminLoginWindowMs <= 0 || !env.adminLoginLockoutMs || env.adminLoginLockoutMs <= 0) throw new Error("Admin login rate-limit durations must be positive.");
  if (!env.adminPasswordResetTtlMinutes || env.adminPasswordResetTtlMinutes < 5) throw new Error("ADMIN_PASSWORD_RESET_TTL_MINUTES must be at least 5.");
  if (!["sandbox", "production"].includes(env.cashfree.environment)) {
    throw new Error('CASHFREE_ENVIRONMENT must be either "sandbox" or "production".');
  }
  if (env.nodeEnv === "production") {
    const missingProd = requiredInProduction.filter((k) => !process.env[k]);
    if (missingProd.length) throw new Error(`Missing required production environment variables: ${missingProd.join(", ")}`);
    if (!env.adminRefreshCookieSecure) throw new Error("ADMIN_REFRESH_COOKIE_SECURE must be true in production.");
    // An admin console holding sandbox keys would issue refunds that never
    // move real money while reporting success, so this is a hard boot
    // failure rather than a warning.
    if (env.cashfree.environment !== "production") {
      throw new Error('CASHFREE_ENVIRONMENT must be "production" when NODE_ENV is production.');
    }
  }
}
module.exports = { env, assertEnv };