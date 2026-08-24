const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Otp = require("../models/Otp");
const { env } = require("../config/env");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const otpService = require("../services/otp.service");
const { sendOtpEmail } = require("../services/email.service");
const { issueTokenPair, verifyRefreshToken } = require("../services/token.service");
const logger = require("../utils/logger");

const REFRESH_HASH_ROUNDS = 10;

// POST /api/auth/request-otp
const requestOtp = asyncHandler(async (req, res) => {
  const { email, intent } = req.body;

  // Same guard as verify-otp: a login attempt against an email with no
  // account shouldn't even get an OTP sent — that just spams an inbox
  // and confuses the person, since verify-otp would reject them anyway.
  // Only check for "login"; a missing/unspecified intent still gets the
  // OTP (kept permissive for the /verify-email resend button, which may
  // not always know the original intent yet).
  if (intent === "login") {
    const existing = await User.findOne({ email });
    if (!existing) {
      throw ApiError.notFound("No account found for this email. Please sign up first.", { code: "ACCOUNT_NOT_FOUND" });
    }
  }

  // Anti-spam: if there's still a live, unconsumed code for this email,
  // don't let another one be requested until the cooldown passes — the
  // frontend's "resend" button hitting this repeatedly shouldn't flood the
  // provider or let someone brute-force cheaper by resetting attempts.
  const cooldownStart = new Date(Date.now() - env.otpResendCooldownSeconds * 1000);
  const active = await Otp.findOne({ email, consumedAt: null }).sort({ createdAt: -1 });
  if (active?.expiresAt && active.expiresAt.getTime() <= Date.now()) await Otp.deleteOne({ _id: active._id, consumedAt: null });
  const recent = active && active.createdAt && active.createdAt.getTime() > cooldownStart.getTime() && (!active.expiresAt || active.expiresAt.getTime() > Date.now()) ? active : null;
  if (recent) {
    const retryInSeconds = Math.ceil((recent.createdAt.getTime() + env.otpResendCooldownSeconds * 1000 - Date.now()) / 1000);
    throw ApiError.conflict(`Please wait ${Math.max(retryInSeconds, 1)}s before requesting another code.`, { code: "OTP_COOLDOWN" });
  }

  const code = otpService.generateCode();
  const codeHash = await otpService.hashCode(code);
  const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);
  try {
    await Otp.create({ email, codeHash, expiresAt });
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict("Please wait before requesting another code.", { code: "OTP_COOLDOWN" });
    throw err;
  }
  // Don't block the HTTP response on the SMTP round trip — Gmail (or any
  // provider) can take anywhere from a few hundred ms to its full
  // connection-timeout ceiling to accept/reject a message, which is far
  // longer than a sane request timeout on the frontend. queueEmail() already
  // persists an EmailLog row and the background queue worker retries on
  // failure, so it's safe to let this run after we've responded.
  sendOtpEmail(email, code).catch((err) => {
    logger.error(`[auth] failed to queue OTP email for ${email}: ${err.message}`);
  });

  res.json({
    message: "Verification code sent.",
    expiresInSeconds: env.otpTtlMinutes * 60,
    // Dev convenience only — never present in production, regardless of the
    // OTP_DEBUG_ECHO flag, so a misconfigured prod env can't leak codes.
    ...(env.nodeEnv !== "production" && env.otpDebugEcho ? { devCode: code } : {}),
  });
});

// POST /api/auth/verify-otp
const verifyOtp = asyncHandler(async (req, res) => {
  const { email, code, name, intent } = req.body;

  const otp = await Otp.findOne({ email, consumedAt: null }).sort({ createdAt: -1 });

  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest("That code has expired or wasn't found. Request a new one.", {
      code: "OTP_NOT_FOUND",
    });
  }

  if (otp.attempts >= env.otpMaxAttempts) {
    throw ApiError.conflict("Too many incorrect attempts. Request a new code.", {
      code: "OTP_LOCKED",
    });
  }

  const matches = await otpService.compareCode(code, otp.codeHash);
  if (!matches) {
    const failed = await Otp.findOneAndUpdate(
      { _id: otp._id, consumedAt: null, attempts: { $lt: env.otpMaxAttempts } },
      { $inc: { attempts: 1 } },
      { new: true }
    );
    if (failed === undefined) {
      otp.attempts += 1;
      await otp.save();
      if (otp.attempts >= env.otpMaxAttempts) throw ApiError.conflict("Too many incorrect attempts. Request a new code.", { code: "OTP_LOCKED" });
      throw ApiError.unauthorized("Incorrect code. Please try again.", { code: "OTP_INVALID" });
    }
    if (!failed || failed.attempts >= env.otpMaxAttempts) throw ApiError.conflict("Too many incorrect attempts. Request a new code.", { code: "OTP_LOCKED" });
    throw ApiError.unauthorized("Incorrect code. Please try again.", { code: "OTP_INVALID" });
  }

  const consumed = await Otp.findOneAndUpdate(
    { _id: otp._id, consumedAt: null, attempts: { $lt: env.otpMaxAttempts }, expiresAt: { $gt: new Date() } },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );
  if (consumed === undefined) {
    otp.consumedAt = new Date();
    await otp.save();
  } else if (!consumed) {
    throw ApiError.conflict("This verification code has already been used or expired.", { code: "OTP_CONSUMED" });
  }

  let user = await User.findOne({ email });
  if (!user) {
    // Login and Signup share this same endpoint (both just verify an
    // OTP), so without this check, typing any email on the LOGIN page —
    // even one that never signed up — silently created an account and
    // logged them in. Only the Signup flow is allowed to create a new
    // account; a login attempt against an unknown email is rejected
    // instead, telling the person to sign up first.
    if (intent === "login") {
      throw ApiError.notFound("No account found for this email. Please sign up first.", { code: "ACCOUNT_NOT_FOUND" });
    }
    user = await User.create({ email, name: name || "", isVerified: true });
  } else if (!user.isVerified || (name && !user.name)) {
    user.isVerified = true;
    if (name && !user.name) user.name = name;
  }

  const { accessToken, refreshToken } = issueTokenPair(user._id);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, REFRESH_HASH_ROUNDS);
  user.lastLoginAt = new Date();
  await user.save();

  res.json({ accessToken, refreshToken, user });
});

// POST /api/auth/refresh
const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err) {
    throw ApiError.unauthorized(
      err.name === "TokenExpiredError" ? "Refresh token expired. Please log in again." : "Invalid refresh token."
    );
  }

  const user = await User.findById(payload.sub).select("+refreshTokenHash");
  if (!user || !user.refreshTokenHash) {
    throw ApiError.unauthorized("Invalid refresh token.");
  }

  const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!matches) {
    throw ApiError.unauthorized("Invalid refresh token.");
  }

  // Rotate on every use: issue a fresh pair and overwrite the stored hash,
  // so a stolen-and-reused old refresh token stops working the moment the
  // legitimate client refreshes again.
  const tokens = issueTokenPair(user._id);
  user.refreshTokenHash = await bcrypt.hash(tokens.refreshToken, REFRESH_HASH_ROUNDS);
  await user.save();

  res.json(tokens);
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.auth.userId, { refreshTokenHash: null });
  res.status(204).send();
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.auth.userId);
  if (!user) throw ApiError.notFound("User not found.");
  res.json({ user });
});

// PATCH /api/auth/me
const updateMe = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = await User.findById(req.auth.userId);
  if (!user) throw ApiError.notFound("User not found.");

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  await user.save();

  res.json({ user });
});

module.exports = { requestOtp, verifyOtp, refresh, logout, me, updateMe };