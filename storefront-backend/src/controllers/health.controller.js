const { dbState, dbIdentity } = require('../config/db');
const { env } = require('../config/env');

function payload() {
  const database = dbState();
  return { status: 'ok', service: 'storefront-backend', env: env.nodeEnv, time: new Date().toISOString(), database, databaseIdentity: dbIdentity() };
}
function getHealth(req, res) { res.status(200).json(payload()); }
function getReadiness(req, res) {
  const body = payload();
  if (body.database !== 'connected') return res.status(503).json({ ...body, status: 'not_ready' });
  return res.status(200).json(body);
}
module.exports = { getHealth, getReadiness };
