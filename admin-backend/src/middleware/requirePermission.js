const ApiError = require("../utils/ApiError");
const { hasPermission } = require("../config/permissions");

function requirePermission(permission) {
  return function checkPermission(req, res, next) {
    if (!req.admin || !hasPermission(req.admin.role, permission)) {
      return next(ApiError.forbidden("You don't have permission to perform this action."));
    }
    next();
  };
}

module.exports = requirePermission;
