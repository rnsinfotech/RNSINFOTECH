import { adminApiRequest } from "../lib/adminApi";

function normalizePayment(payment = {}) {
  return {
    id: payment._id || payment.id,
    orderId: payment.order?._id || payment.order || payment.orderId || "",
    orderStatus: payment.order?.status || payment.orderStatus || null,
    customerName: payment.user?.name || payment.customerName || "",
    customerEmail: payment.user?.email || payment.customerEmail || "",
    amount: Number(payment.amount || 0),
    // Don't default a missing method to "upi" — that was masking payments
    // whose real method (card/netbanking/etc.) hadn't been captured yet
    // and made every one of them display as UPI regardless of what was
    // actually used. Leave it null and let the UI show "Unknown".
    method: payment.method || null,
    status: payment.status || "pending",
    refundStatus: payment.refundStatus || "none",
    refundId: payment.razorpayRefundId || null,
    refundedAmount: Number(payment.refundedAmount || 0),
    refundInitiatedAt: payment.refundInitiatedAt || null,
    refundedAt: payment.refundedAt || null,
    failureReason: payment.failureReason || null,
    at: payment.createdAt || payment.at || new Date().toISOString(),
  };
}

export async function getPayments(filters = {}) {
  const { q = "", status = "" } = filters;
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (q) params.set("search", q);
  if (status) params.set("status", status);

  const payload = await adminApiRequest(`/payments?${params.toString()}`);
  return (payload?.items || []).map(normalizePayment);
}

export async function getPayment(id) {
  const payload = await adminApiRequest(`/payments/${id}`);
  return payload?.payment ? normalizePayment(payload.payment) : null;
}

export async function getPaymentStats() {
  const items = await getPayments({});
  return {
    total: items.length,
    successful: items.filter((p) => p.status === "paid").length,
    pending: items.filter((p) => p.status === "created" || p.status === "pending").length,
    failed: items.filter((p) => p.status === "failed").length,
    refunded: items.filter((p) => p.status === "refunded").length,
  };
}

export async function refundPayment(id) {
  const payload = await adminApiRequest(`/payments/${id}/refund`, {
    method: "POST",
    body: { amount: undefined },
  });
  return payload?.payment ? normalizePayment(payload.payment) : null;
}

export async function reconcilePayment(id) {
  const payload = await adminApiRequest(`/payments/${id}/reconcile`, { method: "POST" });
  return payload?.payment ? normalizePayment(payload.payment) : null;
}
