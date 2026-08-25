const Payment = require("../models/Payment");
const Order = require("../models/Order");
const { getRazorpayOrder, listRazorpayOrderPayments, listRazorpayPaymentRefunds, listRazorpayOrdersByReceipt, createRazorpayRefund } = require("./razorpay.service");
const { settlePaidPayment, failPayment } = require("../controllers/payment.controller");
const { reclaimExpiredReservation } = require("./stock.service");
const { transitionOrder } = require("./orderLifecycle.service");

async function reconcilePayment(payment) {
  if (!payment?.razorpayOrderId) return null;
  if (String(payment.razorpayOrderId).startsWith("pending_")) {
    const remote = await listRazorpayOrdersByReceipt(String(payment.order));
    const recovered = (remote.items || []).find((item) => String(item.receipt) === String(payment.order));
    if (!recovered) return null;
    payment.razorpayOrderId = recovered.id;
    payment.razorpayStatus = recovered.status;
    await payment.save();
  }
  const rpOrder = await getRazorpayOrder(payment.razorpayOrderId);
  const result = { paymentId: payment._id, remoteOrderStatus: rpOrder.status, changed: false };
  const remotePayments = await listRazorpayOrderPayments(payment.razorpayOrderId);
  const captured = (remotePayments.items || []).find((p) => p.status === "captured");

  // Backfill a missing method on an already-settled payment (e.g. rows
  // from before verifyPayment started capturing it) — same fix as the
  // webhook handler, reachable from the admin's "Reconcile" button so
  // existing payments can self-heal without a separate migration.
  if (captured && payment.status === "paid" && !payment.method && captured.method) {
    payment.method = captured.method;
    await payment.save();
    result.changed = true;
  }

  if (captured && !["paid", "refunded"].includes(payment.status)) {
    const order = await Order.findById(payment.order);
    // No time cutoff here either — reclaim the reservation (re-reserve the
    // same stock) rather than treating "expiry timestamp passed" as fatal.
    // Only a genuine stock-out should trigger a refund.
    let reservationValid = false;
    if (order) {
      if (!order.reservationStatus || order.reservationStatus === "reserved") {
        reservationValid = true;
      } else {
        reservationValid = await reclaimExpiredReservation(order);
      }
    }
    if (reservationValid) {
      await settlePaidPayment(payment, { paymentId: captured.id, method: captured.method });
      result.changed = true;
    } else {
      // The customer was charged and the item is genuinely out of stock —
      // not a timing issue. Refund, leave a clear audit trail, and make
      // sure both the order status and the customer's order history
      // reflect what happened instead of the order silently vanishing.
      const reason = "Reconciliation: item out of stock, payment could not be confirmed";
      try {
        const refund = await createRazorpayRefund({
          razorpayPaymentId: captured.id,
          amountInRupees: Number(payment.amount),
          notes: { orderId: String(payment.order), reason },
        });
        payment.status = "refunded";
        payment.refundStatus = refund.status === "processed" ? "processed" : "pending";
        payment.razorpayPaymentId = captured.id;
        payment.razorpayRefundId = refund.id;
        payment.refundedAmount = Number(refund.amount || 0) / 100;
        payment.refundInitiatedAt = new Date();
        payment.refundedAt = refund.status === "processed" ? new Date() : null;
        payment.refundReason = reason;
        payment.failureReason = "Payment captured but item was out of stock; refund initiated.";
        await payment.save();
        result.changed = true;
      } catch (_) {
        payment.failureReason = "Payment captured but item was out of stock; manual reconciliation required.";
        payment.razorpayPaymentId = captured.id;
        payment.razorpayStatus = "captured";
        await payment.save();
      }
      if (order) {
        // Payment briefly succeeded then had to be reversed — this is a
        // paid-then-refunded order, not a "never paid" one. Set the same
        // gate settlePaidPayment sets so it appears in the customer's
        // order history (attachPaymentStatus will surface "refunded").
        await Order.updateOne({ _id: order._id, paymentVerifiedAt: null }, { $set: { paymentVerifiedAt: new Date() } });
        if (["pending", "confirmed"].includes(order.status)) {
          try { await transitionOrder(order, "cancelled", { actorType: "system", note: reason }); } catch (_) {}
        }
      }
    }
  } else if (!captured && payment.status === "created" && payment.expiresAt && new Date(payment.expiresAt) <= new Date()) {
    await failPayment(payment, "Payment attempt expired.", "expired");
    result.changed = true;
  }

  const current = await Payment.findById(payment._id);
  if (current?.status === "refunded") {
    const order = await Order.findById(current.order);
    if (order && ["pending", "confirmed"].includes(order.status) && /cancel/i.test(current.refundReason || "")) {
      try {
        const { restoreConsumedOrderStock } = require("./stock.service");
        await restoreConsumedOrderStock(order, { actorUser: order.user, reason: "Refunded cancellation reconciliation" });
        if (order.couponReservationId) {
          const { releaseCoupon } = require("./coupon.service");
          await releaseCoupon(order.couponReservationId, "Refunded cancellation reconciliation");
        }
        const { transitionOrder } = require("./orderLifecycle.service");
        await transitionOrder(order, "cancelled", { actorType: "system", note: current.refundReason });
      } catch (_) {}
    }
  }
  if (current?.refundStatus === "pending" && current.razorpayPaymentId) {
    const refunds = await listRazorpayPaymentRefunds(current.razorpayPaymentId);
    const processed = (refunds.items || []).find((r) => r.status === "processed");
    if (processed) {
      current.refundStatus = "processed";
      current.status = "refunded";
      current.razorpayRefundId = processed.id;
      current.refundedAmount = Number(processed.amount || 0) / 100;
      current.refundedAt = current.refundedAt || new Date();
      await current.save();
      result.changed = true;
    }
  }
  await Payment.updateOne({ _id: payment._id }, { $set: { razorpayStatus: rpOrder.status, lastReconciledAt: new Date() } });
  return result;
}

async function reconcileRecentPayments() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const payments = await Payment.find({
    createdAt: { $gte: cutoff },
    $or: [{ status: "created" }, { refundStatus: "pending" }],
  }).limit(50);
  let changed = 0;
  for (const payment of payments) {
    try {
      const result = await reconcilePayment(payment);
      if (result?.changed) changed += 1;
    } catch (_) {}
  }
  return changed;
}
function startPaymentReconciliation() {
  const intervalMs = Math.max(30, Number(process.env.PAYMENT_RECONCILE_SECONDS || 120)) * 1000;
  return setInterval(() => reconcileRecentPayments().catch(() => {}), intervalMs);
}
module.exports = { reconcilePayment, reconcileRecentPayments, startPaymentReconciliation };
