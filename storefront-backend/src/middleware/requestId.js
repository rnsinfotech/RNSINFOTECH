const crypto = require('crypto');

function requestId(req, res, next) {
  const supplied = String(req.get('x-request-id') || '').trim();
  const id = /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

module.exports = requestId;
