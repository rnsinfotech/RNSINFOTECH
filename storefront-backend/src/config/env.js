const { loadEnvironment } = require("./loadEnv");
const appEnv = loadEnvironment();
const required = ["MONGO_URI","CORS_ORIGIN","JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","JWT_ACCESS_TTL","JWT_REFRESH_TTL","OTP_TTL_MINUTES","OTP_RESEND_COOLDOWN_SECONDS","OTP_MAX_ATTEMPTS","OTP_DEBUG_ECHO","PORT","EMAIL_FROM"];
const requiredInProduction = ["MONGO_URI","JWT_ACCESS_SECRET","JWT_REFRESH_SECRET","CASHFREE_APP_ID","CASHFREE_SECRET_KEY","CASHFREE_ENVIRONMENT","RESEND_API_KEY","EMAIL_FROM"];
const corsOrigin = (process.env.CORS_ORIGIN || "").split(",").map((x) => x.trim()).filter(Boolean);
const env = {
  appEnv, exposeErrorStacks: process.env.EXPOSE_ERROR_STACKS === "true", nodeEnv: process.env.NODE_ENV || (appEnv === "production" || appEnv === "staging" ? "production" : appEnv),
  port: Number(process.env.PORT), mongoUri: process.env.MONGO_URI, corsOrigin,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET, jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtAccessTtl: process.env.JWT_ACCESS_TTL, jwtRefreshTtl: process.env.JWT_REFRESH_TTL,
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES),
  // Floor of 60s regardless of what's configured — "resend" can never be
  // faster than once a minute, even if OTP_RESEND_COOLDOWN_SECONDS is
  // misconfigured lower in some environment.
  otpResendCooldownSeconds: Math.max(60, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 0),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS), otpDebugEcho: process.env.OTP_DEBUG_ECHO === "true",
  // Per-email cap on how many OTPs can be *sent* in a rolling day, on top of
  // the per-request cooldown above — stops someone from grinding out a new
  // code every 60s all day long. Enforced by otpDailyRateLimit in
  // rateLimit.js, keyed on email only (not IP), since this is an account-
  // level quota rather than an anti-burst-from-one-client control.
  otpDailyLimit: Math.max(1, Number(process.env.OTP_DAILY_LIMIT || 5)),
  // Single source of truth for the payment gateway. Nothing outside this
  // object may read a CASHFREE_* variable directly, so that sandbox vs
  // production is decided in exactly one place (see assertEnv below, which
  // refuses to boot a production process pointed at sandbox credentials).
  cashfree: {
    appId: process.env.CASHFREE_APP_ID || "",
    secretKey: process.env.CASHFREE_SECRET_KEY || "",
    environment: (process.env.CASHFREE_ENVIRONMENT || "sandbox").toLowerCase(),
    apiVersion: process.env.CASHFREE_API_VERSION || "2023-08-01",
    // Where Cashfree sends the customer back after hosted checkout, and
    // where it POSTs webhooks. Both are our own URLs.
    returnUrl: process.env.CASHFREE_RETURN_URL || "",
    notifyUrl: process.env.CASHFREE_NOTIFY_URL || "",
  },
  emailMaxAttempts: Math.max(1, Number(process.env.EMAIL_MAX_ATTEMPTS || 5)),
  emailRetryIntervalSeconds: Math.max(10, Number(process.env.EMAIL_RETRY_INTERVAL_SECONDS || 30)),
  resendApiKey: process.env.RESEND_API_KEY || "", emailFrom: process.env.EMAIL_FROM,
  // Where newsletter/demo/contact/quote form notifications go (see
  // lead.controller.js) - optional, falls back to EMAIL_FROM if unset so
  // this never needs a new required env var to work.
  leadNotifyEmail: process.env.LEAD_NOTIFY_EMAIL || "",
  returnWindowDays: Math.max(1, Number(process.env.RETURN_WINDOW_DAYS || 7)),
  paymentReconcileSeconds: Math.max(30, Number(process.env.PAYMENT_RECONCILE_SECONDS || 120)),
  rateLimitInTests: process.env.RATE_LIMIT_IN_TESTS === "true",
  generalRateLimit: Math.max(30, Number(process.env.GENERAL_RATE_LIMIT || 180)),
  generalRateWindowMs: Math.max(10_000, Number(process.env.GENERAL_RATE_LIMIT_WINDOW_SECONDS || 60) * 1000),
  authRateLimit: Math.max(3, Number(process.env.AUTH_RATE_LIMIT || 20)),
  authRateWindowMs: Math.max(10_000, Number(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000),
  otpRateLimit: Math.max(1, Number(process.env.OTP_RATE_LIMIT || 5)),
  otpRateWindowMs: Math.max(10_000, Number(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000),
  paymentRateLimit: Math.max(5, Number(process.env.PAYMENT_RATE_LIMIT || 30)),
  paymentRateWindowMs: Math.max(10_000, Number(process.env.PAYMENT_RATE_LIMIT_WINDOW_MINUTES || 1) * 60 * 1000),
  sensitiveRateLimit: Math.max(5, Number(process.env.SENSITIVE_RATE_LIMIT || 30)),
  sensitiveRateWindowMs: Math.max(10_000, Number(process.env.SENSITIVE_RATE_LIMIT_WINDOW_MINUTES || 1) * 60 * 1000),
  paymentTimeoutMinutes: Math.max(1, Number(process.env.PAYMENT_TIMEOUT_MINUTES || 15)),
  emailMaxAttempts: Math.max(1, Number(process.env.EMAIL_MAX_ATTEMPTS || 5)),
  emailRetryIntervalSeconds: Math.max(10, Number(process.env.EMAIL_RETRY_INTERVAL_SECONDS || 30)),
};
function assertEnv() {
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  if (!env.port || env.port < 1 || env.port > 65535) throw new Error("PORT must be a valid TCP port.");
  if (!env.corsOrigin.length) throw new Error("CORS_ORIGIN must contain at least one allowed origin.");
  if (!Number.isFinite(env.otpTtlMinutes) || env.otpTtlMinutes <= 0) throw new Error("OTP_TTL_MINUTES must be greater than 0.");
  if (!Number.isFinite(env.otpResendCooldownSeconds) || env.otpResendCooldownSeconds < 60) throw new Error("OTP_RESEND_COOLDOWN_SECONDS must be at least 60 (1 minute).");
  if (!Number.isFinite(env.otpMaxAttempts) || env.otpMaxAttempts < 1) throw new Error("OTP_MAX_ATTEMPTS must be at least 1.");
  if (!Number.isFinite(env.otpDailyLimit) || env.otpDailyLimit < 1) throw new Error("OTP_DAILY_LIMIT must be at least 1.");
  if (!["sandbox", "production"].includes(env.cashfree.environment)) {
    throw new Error('CASHFREE_ENVIRONMENT must be either "sandbox" or "production".');
  }
  if (env.nodeEnv === "production") {
    const missingProd = requiredInProduction.filter((k) => !process.env[k]);
    if (missingProd.length) throw new Error(`Missing required production environment variables: ${missingProd.join(", ")}`);
    if (env.otpDebugEcho) throw new Error("OTP_DEBUG_ECHO must be false in production.");
    // A production deployment holding sandbox keys silently takes real
    // orders that never collect real money, so this is a hard boot failure
    // rather than a warning.
    if (env.cashfree.environment !== "production") {
      throw new Error('CASHFREE_ENVIRONMENT must be "production" when NODE_ENV is production.');
    }
    if (!env.cashfree.notifyUrl) throw new Error("CASHFREE_NOTIFY_URL must be set in production so payment webhooks can be delivered.");
  }
}
module.exports = { env, assertEnv };