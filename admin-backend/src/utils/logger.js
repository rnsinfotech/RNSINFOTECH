const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const configured = process.env.LOG_LEVEL || 'info';
const level = LEVELS[configured] ?? LEVELS.info;

function sanitize(value) {
  if (value === undefined) return value;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitize);
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (/password|secret|token|authorization|cookie|otp|card|cvv|api[-_]?key/i.test(key)) out[key] = '[REDACTED]';
    else out[key] = sanitize(val);
  }
  return out;
}

function log(levelName, message, context = {}) {
  if (LEVELS[levelName] > level) return;
  const entry = { timestamp: new Date().toISOString(), level: levelName, service: process.env.SERVICE_NAME || 'admin-backend', message: String(message), ...sanitize(context) };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

module.exports = {
  error: (message, context) => log('error', message, context),
  warn: (message, context) => log('warn', message, context),
  info: (message, context) => log('info', message, context),
  debug: (message, context) => log('debug', message, context),
};
