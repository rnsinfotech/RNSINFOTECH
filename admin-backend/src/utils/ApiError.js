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
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
  static conflict(message, opts) {
    return new ApiError(409, message, opts);
  }
  // Upstream (payment gateway) failures. This existed on the storefront's
  // ApiError but not here, while admin-backend's refund service already
  // called it — so the refund failure path threw a TypeError and surfaced as
  // an opaque 500 instead of a 502 with a usable message. Added rather than
  // worked around, since a refund that fails is precisely when an operator
  // needs to know what actually happened.
  static badGateway(message = "Upstream service error") {
    return new ApiError(502, message);
  }
}

module.exports = ApiError;
