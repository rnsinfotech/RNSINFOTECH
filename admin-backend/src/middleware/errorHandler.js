const { env } = require("../config/env");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

// Every route error — thrown ApiError, a Mongoose validation error, or
// any unexpected exception — ends up here and comes out the same shape:
// { error: { message, code?, details? } }. Kept as the very last
// middleware registered in server.js.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err instanceof ApiError ? err.statusCode : 500;
  let message = err.message || "Something went wrong.";
  let details = err instanceof ApiError ? err.details : undefined;
  let code = err instanceof ApiError ? err.code : undefined;

  // Mongoose validation/cast errors get translated into 400s with the
  // per-field messages Mongoose already produced, instead of leaking a
  // raw 500 + stack-shaped message to the client.
  if (err.name === "ValidationError" && err.errors) {
    statusCode = 400;
    message = "Validation failed.";
    details = Object.fromEntries(Object.entries(err.errors).map(([field, e]) => [field, e.message]));
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for "${err.path}".`;
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "A record with that value already exists.";
    details = undefined;
  } else if (err.type === "entity.too.large" || err.status === 413) {
    statusCode = 413;
    message = "Request payload is too large.";
    details = undefined;
  } else if (err instanceof SyntaxError && "body" in err) {
    statusCode = 400;
    message = "Malformed JSON request.";
    details = undefined;
  } else if (err.code === "LIMIT_FILE_SIZE" || err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large." : "Invalid file upload.";
    details = undefined;
  }

  if (statusCode >= 500) {
    logger.error(err.stack || err.message);
  }

  res.status(statusCode).json({
    requestId: req.id,
    error: {
      message,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
      ...(env.nodeEnv !== "production" && env.exposeErrorStacks && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
}

module.exports = errorHandler;
