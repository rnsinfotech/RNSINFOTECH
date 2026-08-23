const ApiError = require("../utils/ApiError");

// Wrap any Zod schema into request-validating middleware. On success,
// req[source] is replaced with the *parsed* data. On failure, raises a
// single ApiError.badRequest with per-field messages, matching the same
// { error: { message, details } } shape errorHandler already produces for
// Mongoose validation errors.
function validate(schema, source = "body") {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors;
      return next(ApiError.badRequest("Validation failed.", { details }));
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
