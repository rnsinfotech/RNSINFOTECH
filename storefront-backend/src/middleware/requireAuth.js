const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../services/token.service");

// Every protected storefront route (GET /me from B1 onward, then cart/
// orders/addresses/reviews in later phases) wraps its router in this.
// On success, attaches req.auth = { userId }. Deliberately does NOT hit the
// DB to load the full user here — controllers that need the full doc fetch
// it themselves, so this middleware stays cheap for routes that only need
// the id (e.g. "does this order belong to this user").
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header."));
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(ApiError.unauthorized("Access token expired."));
    }
    return next(ApiError.unauthorized("Invalid access token."));
  }
}

module.exports = requireAuth;
