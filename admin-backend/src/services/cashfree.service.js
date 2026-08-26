const crypto = require("crypto");
const { env } = require("../config/env");

// ---------------------------------------------------------------------------
// CASHFREE WIRE FORMAT — VERIFY AGAINST OFFICIAL DOCS BEFORE PRODUCTION
// ---------------------------------------------------------------------------
// Deliberate mirror of storefront-backend/src/services/cashfree.service.js,
// following the same hand-sync convention this build already uses for the
// shared-collection models. Keep the two in step.
//
// This service is intentionally SMALLER than the storefront one: admin-backend
// never creates a payment and never receives a webhook, so it carries no order
// creation and no signature verification. It only reads authoritative state
// and issues refunds.
//
// Confirm against https://docs.cashfree.com/reference :
//   1. API base URLs for sandbox vs production
//   2. x-api-version value (must match the storefront service)
//   3. Order / payment / refund status vocabularies below
// ---------------------------------------------------------------------------
const API_BASE = {
  sandbox: "https://sandbox.cashfree.com/pg",
  production: "https://api.cashfree.com/pg",
};

const ORDER_STATUS = { ACTIVE: "ACTIVE", PAID: "PAID", EXPIRED: "EXPIRED", TERMINATED: "TERMINATED" };
const PAYMENT_STATUS = {
  SUCCESS: "SUCCESS", FAILED: "FAILED", PENDING: "PENDING", FLAGGED: "FLAGGED", CANCELLED: "CANCELLED",
  USER_DROPPED: "USER_DROPPED", NOT_ATTEMPTED: "NOT_ATTEMPTED", VOID: "VOID",
};
const REFUND_STATUS = {
  SUCCESS: "SUCCESS", PENDING: "PENDING", ONHOLD: "ONHOLD",
  CANCELLED: "CANCELLED", FAILED: "FAILED",
};

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

// Credentials travel in headers and must never reach a log line, an error
// message or an API response — see safeError below.
function authHeaders() {
  return {
    "x-client-id": env.cashfree.appId,
    "x-client-secret": env.cashfree.secretKey,
    "x-api-version": env.cashfree.apiVersion,
    "x-request-id": crypto.randomUUID(),
    "Content-Type": "application/json",
  };
}

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
      headers: { ...authHeaders(), ...(options.headers || {}), ...(options.idempotencyKey ? { "x-idempotency-key": options.idempotencyKey } : {}) },
    });
  } catch (_) {
    // Network failure is NOT evidence the operation failed — the request may
    // have reached Cashfree. Callers must re-read state rather than assume.
    const err = new Error("Could not reach Cashfree.");
    err.statusCode = 502;
    err.retryable = true;
    throw err;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const err = new Error(data?.message || `Cashfree API request failed (${response.status}).`);
    err.statusCode = response.status === 404 ? 404 : 502;
    err.retryable = response.status >= 500 || response.status === 429;
    err.cashfree = safeError(data, response.status);
    throw err;
  }
  return data;
}

/** Get Order — GET /orders/{order_id}. */
async function getCashfreeOrder(orderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

/** Get Payments for Order — GET /orders/{order_id}/payments. */
async function listCashfreeOrderPayments(orderId) {
  const data = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/payments`, { method: "GET" });
  return Array.isArray(data) ? data : [];
}

function deterministicUuid(input) {
  const hash = crypto.createHash("sha256").update(String(input), "utf8").digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Create Refund — POST /orders/{order_id}/refunds
 *
 * refund_id is the gateway's idempotency key, so callers pass a value derived
 * from local state rather than a random one: replaying the same id returns
 * the existing refund instead of issuing a second one.
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
    idempotencyKey: deterministicUuid(`cashfree-refund:${orderId}:${refundId}`),
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

function findSuccessfulPayment(payments) {
  return (payments || []).find((p) => p?.payment_status === PAYMENT_STATUS.SUCCESS) || null;
}

// Collapse payment_group / payment_method into the short string the admin
// portal's method column already renders ("upi", "card", ...).
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
  getCashfreeOrder,
  listCashfreeOrderPayments,
  createCashfreeRefund,
  getCashfreeRefund,
  listCashfreeOrderRefunds,
  findSuccessfulPayment,
  normalizePaymentMethod,
  deterministicUuid,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
};
