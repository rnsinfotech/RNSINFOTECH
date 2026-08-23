// Wrap every async controller in this so a rejected promise reaches
// Express's error handler instead of becoming an unhandled rejection.
// (Every phase from B1 onward writes async controllers — this exists
// from B0 so that habit is established from the very first route.)
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
