const ApiError = require("../utils/ApiError");
function validateParamPattern(name, pattern, message = `Invalid ${name}.`) {
  const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
  return (req, res, next) => {
    const value = String(req.params?.[name] || "");
    if (!regex.test(value)) return next(ApiError.badRequest(message, { code: "INVALID_ROUTE_PARAM" }));
    req.params[name] = value;
    next();
  };
}
module.exports = validateParamPattern;
