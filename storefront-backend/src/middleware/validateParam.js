const ApiError = require("../utils/ApiError");
function validateParam(name) {
  return (req, res, next) => {
    const value = String(req.params?.[name] || "");
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(value)) return next(ApiError.badRequest(`Invalid ${name}.`, { code: "INVALID_ROUTE_PARAM" }));
    req.params[name] = value;
    next();
  };
}
module.exports = validateParam;
