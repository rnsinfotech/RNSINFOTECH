const logger = require('../utils/logger');
const ApiError = require('../utils/ApiError');

function clientError(req, res) {
  const body = req.body || {};
  if (!body.message || typeof body.message !== 'string') throw new ApiError(400, 'Invalid client error payload.', { code: 'INVALID_TELEMETRY' });
  logger.error('client_error', { requestId: req.id, message: body.message.slice(0, 1000), stack: typeof body.stack === 'string' ? body.stack.slice(0, 4000) : undefined, path: typeof body.path === 'string' ? body.path.slice(0, 500) : undefined });
  res.status(202).json({ accepted: true, requestId: req.id });
}
module.exports = { clientError };
