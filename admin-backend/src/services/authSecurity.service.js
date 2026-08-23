const crypto = require("crypto");
const AuthRateLimit = require("../models/AuthRateLimit");
const AuthSecurityEvent = require("../models/AuthSecurityEvent");
const { env } = require("../config/env");
const logger = require("../utils/logger");
const testLimits = new Map();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || "").slice(0, 128);
}

async function logSecurityEvent(event, req, { email, adminId, metadata } = {}) {
  if (env.nodeEnv === "test") return;
  try {
    await AuthSecurityEvent.create({
      event,
      email: normalizeEmail(email) || undefined,
      adminId: adminId || null,
      ip: clientIp(req),
      userAgent: String(req.get("user-agent") || "").slice(0, 1000),
      metadata,
    });
  } catch (err) {
    logger.error(`[auth-security] failed to persist ${event}: ${err.message}`);
  }
}

function keys(email, req) {
  const normalized = normalizeEmail(email);
  const ip = clientIp(req);
  return {
    email: `admin-login:email:${crypto.createHash("sha256").update(normalized).digest("hex")}`,
    ip: `admin-login:ip:${crypto.createHash("sha256").update(ip).digest("hex")}`,
  };
}

async function isBlocked(email, req) {
  const now = new Date();
  if (env.nodeEnv === "test") {
    const { email: emailKey, ip: ipKey } = keys(email, req);
    return Math.max(testLimits.get(emailKey)?.blockedUntil || 0, testLimits.get(ipKey)?.blockedUntil || 0) > now.getTime()
      ? Math.ceil((Math.max(testLimits.get(emailKey)?.blockedUntil || 0, testLimits.get(ipKey)?.blockedUntil || 0) - now.getTime()) / 1000)
      : 0;
  }
  const { email: emailKey, ip: ipKey } = keys(email, req);
  const limits = await AuthRateLimit.find({ key: { $in: [emailKey, ipKey] } }).lean();
  const blocked = limits.find((x) => x.blockedUntil && x.blockedUntil > now);
  return blocked ? Math.ceil((blocked.blockedUntil.getTime() - now.getTime()) / 1000) : 0;
}

async function recordFailure(email, req) {
  const now = new Date();
  if (env.nodeEnv === "test") {
    const { email: emailKey, ip: ipKey } = keys(email, req);
    for (const key of [emailKey, ipKey]) {
      const current = testLimits.get(key) || { attempts: 0, windowStartedAt: now.getTime(), blockedUntil: 0 };
      if (now.getTime() - current.windowStartedAt >= env.adminLoginWindowMs) current.attempts = 0;
      current.attempts += 1;
      if (current.attempts >= env.adminLoginMaxAttempts) current.blockedUntil = now.getTime() + env.adminLoginLockoutMs;
      testLimits.set(key, current);
    }
    return;
  }
  const { email: emailKey, ip: ipKey } = keys(email, req);
  for (const key of [emailKey, ipKey]) {
    const existing = await AuthRateLimit.findOne({ key });
    if (!existing || now.getTime() - existing.windowStartedAt.getTime() >= env.adminLoginWindowMs) {
      await AuthRateLimit.findOneAndUpdate(
        { key },
        { $set: { attempts: 1, windowStartedAt: now, blockedUntil: null } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      continue;
    }
    const attempts = existing.attempts + 1;
    const blockedUntil = attempts >= env.adminLoginMaxAttempts
      ? new Date(now.getTime() + env.adminLoginLockoutMs)
      : null;
    await AuthRateLimit.updateOne({ key }, { $set: { attempts, blockedUntil } });
  }
}

async function clearFailures(email, req) {
  const { email: emailKey, ip: ipKey } = keys(email, req);
  if (env.nodeEnv === "test") {
    testLimits.delete(emailKey); testLimits.delete(ipKey); return;
  }
  await AuthRateLimit.deleteMany({ key: { $in: [emailKey, ipKey] } });
}

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  normalizeEmail,
  logSecurityEvent,
  isBlocked,
  recordFailure,
  clearFailures,
  randomToken,
  hashToken,
};
