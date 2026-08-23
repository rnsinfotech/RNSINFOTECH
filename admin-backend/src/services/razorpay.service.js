const crypto = require("crypto");
const { env } = require("../config/env");

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function authHeader() {
  const token = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  return `Basic ${token}`;
}
function assertConfigured() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    const err = new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    err.statusCode = 500;
    throw err;
  }
}
async function razorpayRequest(path, options = {}) {
  assertConfigured();
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.description || `Razorpay API request failed (${response.status}).`;
    const err = new Error(message);
    err.statusCode = 502;
    err.razorpay = data;
    throw err;
  }
  return data;
}
async function createRazorpayOrder({ amountInRupees, receipt, notes }) {
  return razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt,
      notes,
    }),
  });
}
async function createRazorpayRefund({ razorpayPaymentId, amountInRupees, notes }) {
  return razorpayRequest(`/payments/${encodeURIComponent(razorpayPaymentId)}/refund`, {
    method: "POST",
    body: JSON.stringify({
      amount: Math.round(amountInRupees * 100),
      notes: notes || undefined,
    }),
  });
}
async function getRazorpayOrder(razorpayOrderId) {
  return razorpayRequest(`/orders/${encodeURIComponent(razorpayOrderId)}`, { method: "GET" });
}
async function listRazorpayOrdersByReceipt(receipt) {
  return razorpayRequest(`/orders?receipt=${encodeURIComponent(receipt)}`, { method: "GET" });
}
async function listRazorpayOrderPayments(razorpayOrderId) {
  return razorpayRequest(`/orders/${encodeURIComponent(razorpayOrderId)}/payments`, { method: "GET" });
}
async function listRazorpayPaymentRefunds(razorpayPaymentId) {
  return razorpayRequest(`/payments/${encodeURIComponent(razorpayPaymentId)}/refunds`, { method: "GET" });
}
function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const expected = crypto.createHmac("sha256", env.razorpayKeySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  return timingSafeEqualHex(expected, razorpaySignature);
}
function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) return false;
  const expected = crypto.createHmac("sha256", env.razorpayWebhookSecret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}
function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex")); } catch { return false; }
}
module.exports = {
  createRazorpayOrder,
  createRazorpayRefund,
  getRazorpayOrder,
  listRazorpayOrderPayments,
  listRazorpayPaymentRefunds,
  listRazorpayOrdersByReceipt,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
