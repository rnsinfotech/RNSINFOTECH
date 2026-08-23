const configured = import.meta.env.VITE_ERROR_REPORT_URL || '';
const apiBaseUrl = String(import.meta.env.VITE_ADMIN_API_BASE_URL || '').replace(/\/$/, '');
const endpoint = configured.startsWith('http')
  ? configured
  : apiBaseUrl && configured
    ? `${apiBaseUrl}${configured.startsWith('/') ? configured : `/${configured}`}`
    : '';
export function reportClientError(error, context = {}) {
  if (!endpoint) return;
  const redact = (v) => String(v || '').replace(/(authorization|cookie|token|password|otp|secret)=?[^\s&]*/gi, '$1=[REDACTED]').slice(0, 4000);
  fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: redact(error?.message || error), stack: redact(error?.stack), context: redact(JSON.stringify(context)), path: window.location.pathname, timestamp: new Date().toISOString() }), keepalive: true }).catch(() => {});
}
