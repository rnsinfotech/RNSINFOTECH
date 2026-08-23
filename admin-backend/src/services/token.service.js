const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

const ACCESS_AUDIENCE = "admin";
const REFRESH_AUDIENCE = "admin-refresh";

function signAccessToken(adminId, role, sessionVersion = 0) {
  return jwt.sign({ role, sessionVersion }, env.jwtAdminSecret, {
    subject: String(adminId), audience: ACCESS_AUDIENCE, expiresIn: env.jwtAdminTtl,
  });
}
function signRefreshToken(adminId, sessionVersion = 0) {
  return jwt.sign({ sessionVersion }, env.jwtAdminSecret, {
    subject: String(adminId), audience: REFRESH_AUDIENCE, expiresIn: env.jwtAdminRefreshTtl,
  });
}
function verifyAccessToken(token) { return jwt.verify(token, env.jwtAdminSecret, { audience: ACCESS_AUDIENCE }); }
function verifyRefreshToken(token) { return jwt.verify(token, env.jwtAdminSecret, { audience: REFRESH_AUDIENCE }); }
function issueTokenPair(adminId, role, sessionVersion = 0) {
  return { accessToken: signAccessToken(adminId, role, sessionVersion), refreshToken: signRefreshToken(adminId, sessionVersion) };
}
module.exports = { ACCESS_AUDIENCE, REFRESH_AUDIENCE, signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, issueTokenPair };
