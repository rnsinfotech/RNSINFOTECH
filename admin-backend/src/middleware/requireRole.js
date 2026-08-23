const ApiError = require("../utils/ApiError");

// Mount AFTER requireAdmin on any route that's further restricted beyond
// "any logged-in staff member" — e.g. `requireAdmin, requireRole("Owner",
// "Manager")` for refunds or staff management. Assumes req.admin is
// already set.
function requireRole(...allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.admin || !allowedRoles.includes(req.admin.role)) {
      return next(ApiError.forbidden("You don't have permission to perform this action."));
    }
    next();
  };
}

module.exports = requireRole;
