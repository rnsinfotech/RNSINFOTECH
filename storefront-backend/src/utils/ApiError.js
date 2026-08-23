// ApiError — every route/service throws this (or lets asyncHandler catch
// a plain Error, which the error handler treats as a 500) instead of
// calling res.status().json() inline, so every error response has the
// exact same shape: { error: { message, code?, details? } }.
class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, opts) {
    return new ApiError(400, message, opts);
  }
  static unauthorized(message = "Unauthorized", opts) {
    return new ApiError(401, message, opts);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found", opts) {
    return new ApiError(404, message, opts);
  }
  static conflict(message, opts) {
    return new ApiError(409, message, opts);
  }
}

module.exports = ApiError;
