const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

// Two different audiences for access vs. refresh tokens (on top of two
// different secrets) so a leaked/expired access token can never be replayed
// against /auth/refresh, and a refresh token can never be used directly as
// an access token against a protected route.
const ACCESS_AUDIENCE = "storefront";
const REFRESH_AUDIENCE = "storefront-refresh";

function signAccessToken(userId) {
  return jwt.sign({}, env.jwtAccessSecret, {
    subject: String(userId),
    audience: ACCESS_AUDIENCE,
    expiresIn: env.jwtAccessTtl,
  });
}

function signRefreshToken(userId) {
  return jwt.sign({}, env.jwtRefreshSecret, {
    subject: String(userId),
    audience: REFRESH_AUDIENCE,
    expiresIn: env.jwtRefreshTtl,
  });
}

// Both verify* helpers let jwt.verify's own errors (TokenExpiredError,
// JsonWebTokenError) propagate — callers decide how to translate those into
// ApiError, since "expired" vs "malformed" sometimes warrants a different
// message.
function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret, { audience: ACCESS_AUDIENCE });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret, { audience: REFRESH_AUDIENCE });
}

function issueTokenPair(userId) {
  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId),
  };
}

module.exports = {
  ACCESS_AUDIENCE,
  REFRESH_AUDIENCE,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokenPair,
};
