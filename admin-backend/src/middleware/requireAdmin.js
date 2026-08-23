const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const AdminUser = require("../models/AdminUser");
const { verifyAccessToken } = require("../services/token.service");
const auditAdminMutation = require("./auditAdminMutation");

const requireAdmin = asyncHandler(async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw ApiError.unauthorized("Missing or malformed Authorization header.");

  let payload;
  try { payload = verifyAccessToken(token); }
  catch (err) {
    throw ApiError.unauthorized(err.name === "TokenExpiredError" ? "Access token expired." : "Invalid access token.");
  }

  const admin = await AdminUser.findById(payload.sub);
  if (!admin || !admin.isActive || Number(payload.sessionVersion ?? 0) !== Number(admin.sessionVersion ?? 0)) {
    throw ApiError.unauthorized("Admin session is no longer valid. Please sign in again.");
  }
  req.admin = admin;
  auditAdminMutation(req, res, next);
});
module.exports = requireAdmin;
