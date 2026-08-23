const configured = import.meta.env.VITE_ERROR_REPORT_URL || '';
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const endpoint = configured.startsWith('http')
  ? configured
  : apiBaseUrl && configured
    ? `${apiBaseUrl}${configured.startsWith('/') ? configured : `/${configured}`}`
    : '';
function sanitize(value) {
  if (!value) return value;
  return String(value).replace(/(authorization|cookie|token|password|otp|secret)=?[^\s&]*/gi, '$1=[REDACTED]').slice(0, 4000);
}
export function reportClientError(error, context = {}) {
  if (!endpoint) return;
  const payload = { message: sanitize(error?.message || error), stack: sanitize(error?.stack), context: sanitize(JSON.stringify(context)), path: window.location.pathname, userAgent: navigator.userAgent, timestamp: new Date().toISOString() };
  fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
}
