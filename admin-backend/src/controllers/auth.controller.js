const bcrypt = require("bcryptjs");
const AdminUser = require("../models/AdminUser");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { env } = require("../config/env");
const { issueTokenPair, verifyRefreshToken } = require("../services/token.service");
const security = require("../services/authSecurity.service");
const { sendAdminPasswordResetEmail } = require("../services/email.service");

const REFRESH_HASH_ROUNDS = 10;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.adminRefreshCookieSecure,
    sameSite: env.adminRefreshCookieSameSite,
    ...(env.adminRefreshCookieDomain ? { domain: env.adminRefreshCookieDomain } : {}),
    path: "/api/auth",
  };
}
function serializeRefreshCookie(token, maxAge) {
  const parts = [
    `${env.adminRefreshCookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/api/auth",
    `Max-Age=${Math.floor(maxAge / 1000)}`,
    `SameSite=${env.adminRefreshCookieSameSite.charAt(0).toUpperCase()}${env.adminRefreshCookieSameSite.slice(1)}`,
  ];
  if (env.adminRefreshCookieSecure) parts.push("Secure");
  if (env.adminRefreshCookieDomain) parts.push(`Domain=${env.adminRefreshCookieDomain}`);
  return parts.join("; ");
}
function setRefreshCookie(res, token) {
  res.setHeader("Set-Cookie", serializeRefreshCookie(token, 30 * 24 * 60 * 60 * 1000));
}
function clearRefreshCookie(res) {
  res.setHeader("Set-Cookie", serializeRefreshCookie("", 0));
}
function getRefreshToken(req) {
  const header = req.headers.cookie || "";
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${env.adminRefreshCookieName}=`));
  return match ? decodeURIComponent(match.slice(env.adminRefreshCookieName.length + 1)) : "";
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const blockedSeconds = await security.isBlocked(email, req);
  if (blockedSeconds) {
    await security.logSecurityEvent("login_blocked", req, { email, metadata: { retryAfterSeconds: blockedSeconds } });
    throw new ApiError(429, "Too many login attempts. Please try again later.", { code: "LOGIN_RATE_LIMITED", details: { retryAfterSeconds: blockedSeconds } });
  }

  const admin = await AdminUser.findOne({ email }).select("+passwordHash");
  const valid = admin && admin.isActive && admin.passwordHash && await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    await security.recordFailure(email, req);
    await security.logSecurityEvent("login_failed", req, { email, adminId: admin?._id });
    throw ApiError.unauthorized("Invalid email or password.");
  }

  await security.clearFailures(email, req);
  const tokens = issueTokenPair(admin._id, admin.role, admin.sessionVersion);
  admin.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, REFRESH_HASH_ROUNDS);
  admin.lastLoginAt = new Date();
  await admin.save();
  setRefreshCookie(res, tokens.refreshToken);
  await security.logSecurityEvent("login_success", req, { email, adminId: admin._id });
  res.json({ accessToken: tokens.accessToken, admin });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) throw ApiError.unauthorized("Refresh session not found. Please sign in again.");

  let payload;
  try { payload = verifyRefreshToken(refreshToken); }
  catch (err) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized(err.name === "TokenExpiredError" ? "Refresh session expired. Please sign in again." : "Invalid refresh session.");
  }

  const admin = await AdminUser.findById(payload.sub).select("+refreshTokenHash");
  if (!admin || !admin.isActive || !admin.refreshTokenHash || Number(payload.sessionVersion ?? 0) !== Number(admin.sessionVersion ?? 0)) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized("Invalid refresh session.");
  }
  if (!(await bcrypt.compare(refreshToken, admin.refreshTokenHash))) {
    admin.refreshTokenHash = null;
    admin.sessionVersion += 1;
    await admin.save();
    clearRefreshCookie(res);
    await security.logSecurityEvent("refresh_reuse_rejected", req, { adminId: admin._id, email: admin.email });
    throw ApiError.unauthorized("Invalid refresh session.");
  }

  const tokens = issueTokenPair(admin._id, admin.role, admin.sessionVersion);
  admin.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, REFRESH_HASH_ROUNDS);
  await admin.save();
  setRefreshCookie(res, tokens.refreshToken);
  res.json({ accessToken: tokens.accessToken, admin });
});

const logout = asyncHandler(async (req, res) => {
  await AdminUser.findByIdAndUpdate(req.admin._id, { $unset: { refreshTokenHash: 1 }, $inc: { sessionVersion: 1 } });
  clearRefreshCookie(res);
  await security.logSecurityEvent("logout", req, { adminId: req.admin._id, email: req.admin.email });
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => res.json({ admin: req.admin }));

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await AdminUser.findById(req.admin._id).select("+passwordHash");
  if (!admin || !(await bcrypt.compare(currentPassword, admin.passwordHash))) {
    await security.logSecurityEvent("password_change_failed", req, { adminId: req.admin._id, email: req.admin.email });
    throw ApiError.unauthorized("Current password is incorrect.");
  }
  if (await bcrypt.compare(newPassword, admin.passwordHash)) throw ApiError.badRequest("New password must be different from the current password.");

  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  admin.passwordChangedAt = new Date();
  admin.refreshTokenHash = null;
  admin.sessionVersion += 1;
  admin.passwordResetTokenHash = null;
  admin.passwordResetExpiresAt = null;
  await admin.save();
  clearRefreshCookie(res);
  await security.logSecurityEvent("password_changed", req, { adminId: admin._id, email: admin.email });
  res.status(204).send();
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const generic = "If an active admin account exists for that email, a password reset link has been sent.";
  const admin = await AdminUser.findOne({ email });
  if (!admin || !admin.isActive) {
    await security.logSecurityEvent("password_reset_requested_unknown", req, { email });
    return res.json({ message: generic });
  }

  const token = security.randomToken();
  admin.passwordResetTokenHash = security.hashToken(token);
  admin.passwordResetExpiresAt = new Date(Date.now() + env.adminPasswordResetTtlMinutes * 60 * 1000);
  await admin.save();

  const resetUrl = `${env.adminPasswordResetUrl.replace(/\/$/, "")}?token=${encodeURIComponent(token)}`;
  try {
    await sendAdminPasswordResetEmail(admin.email, resetUrl);
    await security.logSecurityEvent("password_reset_requested", req, { email: admin.email, adminId: admin._id });
  } catch (err) {
    admin.passwordResetTokenHash = null;
    admin.passwordResetExpiresAt = null;
    await admin.save();
    await security.logSecurityEvent("password_reset_email_failed", req, { email: admin.email, adminId: admin._id });
    throw new ApiError(503, "Password reset email could not be sent. Please contact an administrator.");
  }
  res.json({ message: generic });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const hash = security.hashToken(token);
  const admin = await AdminUser.findOne({ passwordResetTokenHash: hash, passwordResetExpiresAt: { $gt: new Date() }, isActive: true }).select("+passwordHash");
  if (!admin) throw ApiError.badRequest("This reset link is invalid or has expired.", { code: "RESET_TOKEN_INVALID" });

  admin.passwordHash = await bcrypt.hash(newPassword, 12);
  admin.passwordChangedAt = new Date();
  admin.passwordResetTokenHash = null;
  admin.passwordResetExpiresAt = null;
  admin.refreshTokenHash = null;
  admin.sessionVersion += 1;
  await admin.save();
  await security.clearFailures(admin.email, req);
  await security.logSecurityEvent("password_reset_completed", req, { adminId: admin._id, email: admin.email });
  clearRefreshCookie(res);
  res.json({ message: "Password reset successfully. Please sign in again." });
});

module.exports = { login, refresh, logout, me, changePassword, forgotPassword, resetPassword };
