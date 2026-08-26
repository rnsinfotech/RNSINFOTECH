const crypto = require("crypto");
const { env } = require("../config/env");

// ---------------------------------------------------------------------------
// CASHFREE WIRE FORMAT — VERIFY AGAINST OFFICIAL DOCS BEFORE PRODUCTION
// ---------------------------------------------------------------------------
// Everything in this block is protocol detail owned by Cashfree, not by us.
// It is deliberately collected here (rather than scattered through the
// controllers) so that a reviewer can check the whole integration surface
// against https://docs.cashfree.com/reference in one sitting.
//
// Confirm specifically:
//   1. API base URLs for sandbox vs production
//   2. x-api-version value — pin the version this project is certified on;
//      Cashfree treats the version header as a contract, so bumping it can
//      change response shapes (see CASHFREE_API_VERSION in .env)
//   3. Order / payment / refund status vocabularies below
//   4. Webhook signature construction: base64(HMAC-SHA256(timestamp + rawBody))
//      keyed on the CLIENT SECRET (Cashfree PG signs with the client secret
//      rather than issuing a separate dedicated webhook secret)
//   5. Web Checkout SDK URL + `mode` values (used by the React app)
// ---------------------------------------------------------------------------
const API_BASE = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

// Order-level status returned by Create Order / Get Order.
const ORDER_STATUS = { ACTIVE: "ACTIVE", PAID: "PAID", EXPIRED: "EXPIRED", TERMINATED: "TERMINATED" };
// Payment-level status returned by Get Payments for Order.
const PAYMENT_STATUS = {
  SUCCESS: "SUCCESS", FAILED: "FAILED", PENDING: "PENDING",
  USER_DROPPED: "USER_DROPPED", NOT_ATTEMPTED: "NOT_ATTEMPTED", VOID: "VOID",
};
// Refund-level status returned by Create Refund / Get Refund.
const REFUND_STATUS = {
  SUCCESS: "SUCCESS", PENDING: "PENDING", ONHOLD: "ONHOLD",
  CANCELLED: "CANCELLED", FAILED: "FAILED",
};
// Webhook `type` values this integration understands. Anything else is
// acknowledged (so Cashfree stops retrying) but never acted on.
const WEBHOOK_TYPES = {
  PAYMENT_SUCCESS: "PAYMENT_SUCCESS_WEBHOOK",
  PAYMENT_FAILED: "PAYMENT_FAILED_WEBHOOK",
  PAYMENT_USER_DROPPED: "PAYMENT_USER_DROPPED_WEBHOOK",
  REFUND_STATUS: "REFUND_STATUS_WEBHOOK",
};

// How much clock skew we tolerate on the webhook timestamp before treating a
// delivery as a replay. Cashfree signs `timestamp + body`, so without this
// check a captured-and-replayed request stays valid forever.
const WEBHOOK_MAX_AGE_SECONDS = 300;

function apiBase() {
  return API_BASE[env.cashfree.environment] || API_BASE.sandbox;
}

function assertConfigured() {
  if (!env.cashfree.appId || !env.cashfree.secretKey) {
    const err = new Error("Cashfree is not configured — set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.");
    err.statusCode = 500;
    throw err;
  }
}

// Cashfree authenticates with the app id + secret in headers. These must
// never appear in a log line, an error message, or an API response — see the
// `safeError` helper below, which is the only thing allowed to travel with a
// thrown error.
function authHeaders() {
  return {
    "x-client-id": env.cashfree.appId,
    "x-client-secret": env.cashfree.secretKey,
    "x-api-version": env.cashfree.apiVersion,
    "Content-Type": "application/json",
  };
}

// Cashfree error bodies look like { message, code, type }. We deliberately
// keep only those three fields: the raw body can echo request context back to
// us, and anything we attach to an Error tends to end up in a log sink.
function safeError(data, status) {
  return {
    message: typeof data?.message === "string" ? data.message : undefined,
    code: data?.code,
    type: data?.type,
    httpStatus: status,
  };
}

async function cashfreeRequest(path, options = {}) {
  assertConfigured();
  let response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) },
    });
  } catch (cause) {
    // Network-level failure. This is explicitly NOT "the payment failed" —
    // the request may well have reached Cashfree. Callers must treat this as
    // "unknown, re-verify later", never as a terminal failure.
    const err = new Error("Could not reach Cashfree.");
    err.statusCode = 502;
    err.retryable = true;
    throw err;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(data?.message || `Cashfree API request failed (${response.status}).`);
    err.statusCode = response.status === 404 ? 404 : 502;
    // 5xx and 429 are transient; 4xx (bad request, already-refunded, etc.)
    // are not, and retrying them just burns quota.
    err.retryable = response.status >= 500 || response.status === 429;
    err.cashfree = safeError(data, response.status);
    throw err;
  }
  return data;
}

/**
 * Create Order — POST /orders
 *
 * `orderId` is OUR server-generated identifier (never client-supplied), which
 * is what lets us look the order back up during verification and
 * reconciliation without needing a receipt search. Amounts are sent in
 * RUPEES as a decimal. Cashfree does not use the minor unit, so no
 * paise conversion happens anywhere in this integration.
 */
async function createCashfreeOrder({ orderId, amountInRupees, currency = "INR", customer, returnUrl, notifyUrl, expiresAt, note }) {
  const body = {
    order_id: orderId,
    order_amount: Number(Number(amountInRupees).toFixed(2)),
    order_currency: currency,
    customer_details: {
      customer_id: String(customer.id),
      customer_phone: String(customer.phone || ""),
      ...(customer.email ? { customer_email: String(customer.email) } : {}),
      ...(customer.name ? { customer_name: String(customer.name) } : {}),
    },
    order_meta: {
      ...(returnUrl ? { return_url: returnUrl } : {}),
      ...(notifyUrl ? { notify_url: notifyUrl } : {}),
    },
    ...(note ? { order_note: String(note).slice(0, 200) } : {}),
    ...(expiresAt ? { order_expiry_time: new Date(expiresAt).toISOString() } : {}),
  };
  return cashfreeRequest("/orders", { method: "POST", body: JSON.stringify(body) });
}

/** Get Order — GET /orders/{order_id}. Authoritative order-level state. */
async function getCashfreeOrder(orderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

/** Get Payments for Order — GET /orders/{order_id}/payments. Returns an array. */
async function listCashfreeOrderPayments(orderId) {
  const data = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/payments`, { method: "GET" });
  return Array.isArray(data) ? data : [];
}

/**
 * Create Refund — POST /orders/{order_id}/refunds
 *
 * `refundId` is caller-supplied and must be unique per refund. We derive it
 * deterministically from the local payment id, which is what makes a retried
 * refund idempotent at the gateway rather than issuing a second one: replaying
 * the same refund_id returns the existing refund instead of creating another.
 */
async function createCashfreeRefund({ orderId, refundId, amountInRupees, note }) {
  const body = {
    refund_id: refundId,
    refund_amount: Number(Number(amountInRupees).toFixed(2)),
    ...(note ? { refund_note: String(note).slice(0, 200) } : {}),
  };
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/refunds`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Get Refund — GET /orders/{order_id}/refunds/{refund_id}. */
async function getCashfreeRefund(orderId, refundId) {
  return cashfreeRequest(
    `/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`,
    { method: "GET" }
  );
}

/** Get all refunds for an order — GET /orders/{order_id}/refunds. */
async function listCashfreeOrderRefunds(orderId) {
  const data = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/refunds`, { method: "GET" });
  return Array.isArray(data) ? data : [];
}

/**
 * Verify a Cashfree webhook.
 *
 * Cashfree signs `timestamp + rawBody` with the CLIENT SECRET and sends the
 * result base64-encoded in `x-webhook-signature`, alongside the timestamp in
 * `x-webhook-timestamp`. Two consequences that shaped the code around this:
 *
 *   - the HMAC is over the exact bytes Cashfree sent, so this must be handed
 *     the raw Buffer, never a re-serialised JSON.parse() of it (app.js mounts
 *     the webhook route with express.raw() for exactly this reason);
 *   - because the timestamp is inside the signed payload, checking its age
 *     is what makes a replayed delivery detectable at all.
 */
function verifyWebhookSignature({ rawBody, signature, timestamp, maxAgeSeconds = WEBHOOK_MAX_AGE_SECONDS }) {
  if (!env.cashfree.secretKey) return false;
  if (typeof signature !== "string" || !signature) return false;
  if (typeof timestamp !== "string" || !timestamp) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > maxAgeSeconds) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  const signedPayload = Buffer.concat([Buffer.from(String(timestamp), "utf8"), body]);
  const expected = crypto.createHmac("sha256", env.cashfree.secretKey).update(signedPayload).digest("base64");
  return timingSafeEqualBase64(expected, signature);
}

function timingSafeEqualBase64(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "base64"), Buffer.from(b, "base64"));
  } catch {
    return false;
  }
}

/**
 * Stable identity for a webhook delivery, used as the unique key on the
 * WebhookEvent collection. Cashfree does not send an event id header, so this
 * is derived from the content: a genuine retry of the same event produces the
 * same key (and is skipped), while a later, different event on the same
 * payment produces a different one (and is processed).
 */
function webhookEventKey(event) {
  const type = event?.type || "UNKNOWN";
  const refund = event?.data?.refund;
  if (refund) return `${type}:refund:${refund.refund_id || refund.cf_refund_id}:${refund.refund_status || ""}`;
  const payment = event?.data?.payment;
  const order = event?.data?.order;
  if (payment) return `${type}:payment:${payment.cf_payment_id}:${payment.payment_status || ""}`;
  return `${type}:order:${order?.order_id || "unknown"}`;
}

/**
 * Pick the payment entity that actually settled an order. Cashfree returns
 * every attempt against an order (a dropped UPI try, then a successful card
 * try), so "the first one" is not good enough — we want the successful one.
 */
function findSuccessfulPayment(payments) {
  return (payments || []).find((p) => p?.payment_status === PAYMENT_STATUS.SUCCESS) || null;
}

/**
 * Collapse Cashfree's `payment_group` / `payment_method` into the short
 * method string the existing UI and Payment.method field already expect
 * ("upi", "card", "netbanking", ...). Keeping the shape means the admin
 * portal's method column keeps working untouched.
 */
function normalizePaymentMethod(paymentEntity) {
  if (!paymentEntity) return null;
  const group = paymentEntity.payment_group;
  if (typeof group === "string" && group) return group;
  const method = paymentEntity.payment_method;
  if (method && typeof method === "object") {
    const key = Object.keys(method)[0];
    if (key) return key;
  }
  return null;
}

module.exports = {
  createCashfreeOrder,
  getCashfreeOrder,
  listCashfreeOrderPayments,
  createCashfreeRefund,
  getCashfreeRefund,
  listCashfreeOrderRefunds,
  verifyWebhookSignature,
  webhookEventKey,
  findSuccessfulPayment,
  normalizePaymentMethod,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  WEBHOOK_TYPES,
  WEBHOOK_MAX_AGE_SECONDS,
};
