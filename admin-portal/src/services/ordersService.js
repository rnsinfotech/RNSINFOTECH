import { adminApiRequest } from "../lib/adminApi";

// Simplified 4-state order lifecycle — see PROGRESS_ORDER_SIMPLIFICATION.md.
// Normalizes admin-backend's real Order document (not a mock shape) into
// what the admin-portal order pages render.
function normalizeOrder(order = {}) {
  const shipping = order.shippingAddress || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsTotal = Number(order.itemsTotal || 0);

  return {
    id: order._id || order.id,
    date: order.createdAt || order.date || new Date().toISOString(),
    status: order.status || "pending",
    items: items.map((item) => ({
      id: item.product || item.id || "",
      name: item.name || "",
      image: item.image || "",
      sku: item.sku || "",
      qty: Number(item.quantity || item.qty || 1),
      price: Number(item.price || 0),
    })),
    subtotal: Number(order.subtotal || itemsTotal || 0),
    shippingFee: Number(order.shippingFee || order.deliveryFee || 0),
    tax: Number(order.tax || 0),
    discount: Number(order.discount || 0),
    couponCode: order.couponCode || null,
    total: itemsTotal,
    shippingAddress: {
      name: shipping.fullName || shipping.name || "",
      phone: shipping.phone || "",
      line1: shipping.line1 || "",
      line2: shipping.line2 || "",
      city: shipping.city || "",
      state: shipping.state || "",
      pincode: shipping.pincode || "",
      country: shipping.country || "India",
    },
    // Every order visible here is, by definition, payment-verified — see
    // storefront-backend's paymentVerifiedAt gate — but admin-backend still
    // surfaces the live Payment.status alongside it (this is about
    // refund/failed states on an otherwise-real order, not unpaid drafts —
    // those never reach this collection view in the first place).
    paymentStatus: order.paymentStatus || "paid",
    paymentVerifiedAt: order.paymentVerifiedAt || null,
    deliveryEstimate: order.deliveryEstimate || "3-4 days",
    customerName: order.user?.name || shipping.fullName || shipping.name || "",
    customerEmail: order.user?.email || order.customerEmail || "",
    courierName: order.courierName || null,
    trackingId: order.trackingId || null,
    confirmedAt: order.confirmedAt || null,
    shippedAt: order.shippedAt || null,
    cancelledAt: order.cancelledAt || null,
    cancelReason: order.cancelReason || null,
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
  };
}

export async function getOrders(filters = {}) {
  const { q = "", status = "" } = filters;
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (q) params.set("search", q);
  if (status) params.set("status", status);

  const payload = await adminApiRequest(`/orders?${params.toString()}`);
  return (payload?.items || []).map(normalizeOrder).sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function getOrder(id) {
  const payload = await adminApiRequest(`/orders/${id}`);
  return payload?.order ? normalizeOrder(payload.order) : null;
}

// Stat tiles only — a dedicated backend endpoint isn't worth it for four
// counts over an already-fetched list, and the Orders page is capped at
// 100 orders per fetch already, same as before.
export async function getOrderStats() {
  const items = await getOrders({});
  return {
    total: items.length,
    pending: items.filter((o) => o.status === "pending").length,
    confirmed: items.filter((o) => o.status === "confirmed").length,
    shipped: items.filter((o) => o.status === "shipped").length,
    cancelled: items.filter((o) => o.status === "cancelled").length,
  };
}

// Exactly three admin actions on an order — confirm, ship, cancel — mirrors
// admin-backend/src/controllers/order.controller.js exactly. Nothing else
// exists: no pack / out-for-delivery / deliver / return endpoints anymore.
export async function confirmOrder(id) {
  const payload = await adminApiRequest(`/orders/${id}/confirm`, { method: "POST", body: {} });
  return payload?.order ? normalizeOrder(payload.order) : null;
}

export async function shipOrder(id, { courierName, trackingId }) {
  const payload = await adminApiRequest(`/orders/${id}/ship`, {
    method: "POST",
    body: { courierName, trackingId },
  });
  return payload?.order ? normalizeOrder(payload.order) : null;
}

export async function cancelOrder(id, reason) {
  const payload = await adminApiRequest(`/orders/${id}/cancel`, {
    method: "POST",
    body: reason ? { reason } : {},
  });
  return payload?.order ? normalizeOrder(payload.order) : null;
}
