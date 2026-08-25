import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, normalizeOrder } from "../lib/api";
import { useAuth } from "./AuthContext";

const OrdersContext = createContext(null);

// Only three stages have a place in the visual timeline now — "cancelled"
// is a terminal state handled separately by isCancelled below, matching
// admin-backend's ORDER_STATUSES enum exactly (pending/confirmed/shipped/
// cancelled — see PROGRESS_ORDER_SIMPLIFICATION.md).
export const TRACKING_STAGES = [
  { key: "pending", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
];

// getTrackingInfo/getOrderStatus/canDownloadInvoice used to simulate a
// timeline client-side from the order's placed-at timestamp. Now that
// storefront-backend's GET /orders returns the real status/courierName/
// trackingId/confirmedAt/shippedAt fields admin-backend sets (see
// lib/api.js's normalizeOrder), these read that instead — an order only
// shows "Shipped" once someone in the admin portal has actually marked
// it shipped, not on a fixed timer.
export function getTrackingInfo(order) {
  if (order.status !== "shipped") return null;
  if (!order.courierName && !order.trackingId) return null;
  return { courierName: order.courierName, trackingId: order.trackingId };
}

// A "Download bill" link only makes sense once the admin has actually
// uploaded one (see admin-portal's OrderShipModal/OrderDetailPage) — an
// order being shipped doesn't guarantee a bill exists yet.
export function canDownloadInvoice(order) {
  return order.status === "shipped" && Boolean(order.billUrl);
}

export function getOrderStatus(order) {
  const status = order.status || "pending";
  if (status === "cancelled") {
    // A cancelled order whose payment was actually captured and then
    // reversed (e.g. the item went out of stock after payment) is a
    // different situation for the customer than a plain cancellation —
    // their money moved and came back. Surface that distinctly using
    // paymentStatus, which order.controller.js's attachPaymentStatus
    // always computes from the linked Payment record.
    const isRefunded = order.paymentStatus === "refunded";
    return {
      currentIndex: -1,
      currentStage: { key: status, label: isRefunded ? "Refunded" : "Cancelled" },
      isShipped: false,
      isCancelled: true,
      isRefunded,
      isTerminal: true,
      cancelReason: order.cancelReason || null,
      cancelledAt: order.cancelledAt || null,
      stages: TRACKING_STAGES.map((stage) => ({ ...stage, date: null, complete: false })),
    };
  }
  const currentIndex = Math.max(0, TRACKING_STAGES.findIndex((s) => s.key === status));
  const fieldMap = { pending: "date", confirmed: "confirmedAt", shipped: "shippedAt" };
  return {
    currentIndex,
    currentStage: TRACKING_STAGES[currentIndex],
    isShipped: status === "shipped",
    isCancelled: false,
    isTerminal: false,
    stages: TRACKING_STAGES.map((stage, i) => ({
      ...stage,
      date: order[fieldMap[stage.key]] || null,
      complete: i <= currentIndex,
    })),
  };
}
export function OrdersProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState(null);
  // Holds the single reservation order created by placeOrder() below,
  // between "order created" and "payment verified". Deliberately kept
  // OUT of `orders` — see placeOrder()'s comment for why.
  const [pendingOrder, setPendingOrder] = useState(null);

  const fetchOrders = async () => {
    if (!isAuthenticated) {
      setOrders([]);
      setPendingOrder(null);
      return;
    }

    try {
      setOrdersError(null);
      const response = await apiRequest("/orders?page=1&limit=50", { authRequired: true });
      const items = (response.items || []).map((order) => normalizeOrder(order));
      setOrders(items);
      // Once the reservation order shows up in the real, payment-verified
      // list, it's no longer "pending" from the client's perspective —
      // drop the fallback so getOrder() reads the authoritative record.
      setPendingOrder((prev) => (prev && items.some((o) => o.id === prev.id) ? null : prev));
    } catch (error) {
      setOrdersError(error);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAuthenticated]);

  const api = useMemo(() => ({
    orders,
    ordersError,
    getOrder: (id) => orders.find((order) => order.id === id) || (pendingOrder?.id === id ? pendingOrder : null),
    refreshOrders: fetchOrders,
    placeOrder: async ({ items, shippingAddress, paymentMethod, total, couponCode }) => {
      const payload = {
        items: items.map((item) => ({
          product: item.product || item.id,
          quantity: Number(item.qty || item.quantity || 1),
        })),
        shippingAddress: {
          fullName: shippingAddress?.name || shippingAddress?.fullName || "",
          phone: shippingAddress?.phone || "",
          line1: shippingAddress?.line1 || "",
          line2: shippingAddress?.line2 || "",
          city: shippingAddress?.city || "",
          state: shippingAddress?.state || "",
          pincode: shippingAddress?.pincode || "",
          country: shippingAddress?.country || "India",
        },
      };
      // Sent as-is; order.controller.js re-validates it server-side and
      // is the only thing that decides the real discount (see
      // lib/coupons.js). Omitted entirely rather than sent empty so an
      // untouched coupon field never trips the backend's non-empty check.
      if (couponCode) payload.couponCode = couponCode;

      const response = await apiRequest("/orders", {
        method: "POST",
        body: payload,
        authRequired: true,
      });

      // This order isn't payment-verified yet, so the real GET /orders
      // deliberately won't return it (see storefront-backend's
      // listMyOrders — an unpaid order must never be shown as placed).
      // It used to be added straight into `orders` here, which meant the
      // "Your orders" page immediately showed it labeled "Order placed"
      // before any payment happened — e.g. if the customer hit the
      // browser Back button from the payment screen instead of paying,
      // they'd land back on a page where the unpaid order already looked
      // placed. Track it separately instead: PaymentPage can still find
      // it by id via getOrder(), but it stays invisible to "Your orders"
      // until fetchOrders() confirms the backend actually has it (i.e.
      // payment was verified).
      const order = normalizeOrder(response.order);
      setPendingOrder(order);
      return order;
    },
    getOrderById: async (id) => {
      const response = await apiRequest(`/orders/${id}`, { authRequired: true });
      return normalizeOrder(response.order);
    },
    cancelOrder: async (id, reason = "") => {
      const response = await apiRequest(`/orders/${id}/cancel`, { method: "POST", body: { reason }, authRequired: true });
      const order = normalizeOrder(response.order);
      setOrders((prev) => prev.map((item) => item.id === order.id ? order : item));
      return order;
    },
    // requestReturn intentionally removed — storefront-backend deleted
    // POST /orders/:id/return along with the "delivered"/"returned"
    // states it depended on (see PROGRESS_ORDER_SIMPLIFICATION.md).
    // Admin's job ends at "shipped"; there's no post-shipment state to
    // request a return from anymore.
  }), [orders, pendingOrder, currentUser, isAuthenticated]);

  return <OrdersContext.Provider value={api}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error("useOrders must be used within an OrdersProvider");
  return ctx;
}
