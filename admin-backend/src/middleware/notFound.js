const ApiError = require("../utils/ApiError");

// Mounted after every route — anything that falls through is a genuine
// 404, not a bug, so this converts it into the same ApiError shape every
// other error in the app produces.
function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = notFound;
