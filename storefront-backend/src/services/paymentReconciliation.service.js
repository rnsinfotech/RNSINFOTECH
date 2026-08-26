const Payment = require("../models/Payment");
const Order = require("../models/Order");
const {
  getCashfreeOrder,
  listCashfreeOrderPayments,
  listCashfreeOrderRefunds,
  findSuccessfulPayment,
  normalizePaymentMethod,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
} = require("./cashfree.service");
const { settlePaidPayment, failPayment, autoRefundOutOfStock } = require("../controllers/payment.controller");
const { reclaimExpiredReservation } = require("./stock.service");
const { transitionOrder } = require("./orderLifecycle.service");
const { isSettled } = require("./paymentState");

const AMOUNT_EPSILON = 0.01;
function amountsMatch(a, b) {
  return Math.abs(Number(a) - Number(b)) < AMOUNT_EPSILON;
}

/**
 * Reconcile one local payment against Cashfree.
 *
 * Cashfree is authoritative for what happened to the money. This database is
 * authoritative for everything else — who owns the order, what it should have
 * cost, whether the stock is still there. Reconciliation is the seam between
 * those two, and the rule that keeps it safe is that it only ever moves a
 * payment forward along the state machine. It never reverses a settled
 * payment on the strength of a remote status: a local "paid" row that reads
 * as unpaid remotely is a discrepancy to surface, not an instruction to
 * un-sell an order that has possibly already shipped.
 */
async function reconcilePayment(payment) {
  if (!payment?.gatewayOrderId) return null;

  // Historical rows from the previous processor are never reconciled — that
  // integration is gone, and its transactions are closed records.
  if (payment.gateway && payment.gateway !== "cashfree") {
    return { paymentId: payment._id, skipped: "legacy-gateway", changed: false };
  }

  const remoteOrder = await getCashfreeOrder(payment.gatewayOrderId);
  const result = { paymentId: payment._id, remoteOrderStatus: remoteOrder?.order_status, changed: false, discrepancy: null };

  const remotePayments = await listCashfreeOrderPayments(payment.gatewayOrderId);
  const captured = findSuccessfulPayment(remotePayments);

  // Backfill a missing method on an already-settled payment (e.g. rows where
  // the customer-return path settled before the method was known) — same fix
  // as the webhook handler, reachable from the admin's "Reconcile" button so
  // existing payments can self-heal without a separate migration.
  if (captured && payment.status === "paid" && !payment.method) {
    const method = normalizePaymentMethod(captured);
    if (method) {
      payment.method = method;
      await payment.save();
      result.changed = true;
    }
  }

  // Local PAID but Cashfree shows no successful payment. Explicitly do NOT
  // reverse anything — record the discrepancy so a human can look. Reversing
  // here would cancel real orders on the strength of a transient read.
  if (isSettled(payment.status) && !captured && remoteOrder?.order_status !== ORDER_STATUS.PAID) {
    result.discrepancy = "local-settled-remote-unpaid";
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { gatewayStatus: remoteOrder?.order_status || null, lastReconciledAt: new Date() } }
    );
    return result;
  }

  if (captured && !isSettled(payment.status)) {
    // Amount is re-checked here as well: reconciliation is a settlement path
    // like any other, so it gets the same guard.
    if (!amountsMatch(captured.payment_amount, payment.amount)) {
      result.discrepancy = "amount-mismatch";
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { failureReason: "Reconciliation found an amount mismatch; flagged for investigation.", gatewayStatus: "AMOUNT_MISMATCH", lastReconciledAt: new Date() } }
      );
      return result;
    }

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
      // settlePaidPayment's atomic claim means this is safe even if the
      // webhook is settling the same payment at this exact moment — one of
      // them wins the transition and the other returns the settled row.
      await settlePaidPayment(payment, {
        gatewayPaymentId: captured.cf_payment_id,
        method: normalizePaymentMethod(captured),
        gatewayStatus: captured.payment_status,
      });
      result.changed = true;
    } else {
      // The customer was charged and the item is genuinely out of stock —
      // not a timing issue. Refund, leave a clear audit trail, and make
      // sure both the order status and the customer's order history
      // reflect what happened instead of the order silently vanishing.
      const reason = "Reconciliation: item out of stock, payment could not be confirmed";
      await failPayment(payment, "Payment succeeded but the item was out of stock; refund initiated.", "expired");
      const refunded = await autoRefundOutOfStock(payment, {
        gatewayOrderId: payment.gatewayOrderId,
        gatewayPaymentId: captured.cf_payment_id,
        reason,
      });
      if (!refunded) {
        payment.failureReason = "Payment succeeded but item was out of stock; manual reconciliation required.";
        payment.gatewayPaymentId = captured.cf_payment_id;
        payment.gatewayStatus = captured.payment_status;
        await payment.save();
      }
      result.changed = true;
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
  } else if (!captured && payment.status === "created") {
    // Only close out an attempt the gateway itself considers over. A local
    // clock running out is not evidence that a payment failed — an ACTIVE
    // order at Cashfree may still be mid-flight on the customer's bank page.
    const remoteClosed = [ORDER_STATUS.EXPIRED, ORDER_STATUS.TERMINATED].includes(remoteOrder?.order_status);
    const locallyExpired = payment.expiresAt && new Date(payment.expiresAt) <= new Date();
    if (remoteClosed || (locallyExpired && remoteOrder?.order_status !== ORDER_STATUS.ACTIVE)) {
      await failPayment(payment, "Payment attempt expired.", "expired");
      result.changed = true;
    }
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

  // Chase a refund we initiated but haven't seen confirmed yet.
  if (current?.refundStatus === "pending" && current.gatewayOrderId) {
    const refunds = await listCashfreeOrderRefunds(current.gatewayOrderId);
    const processed = (refunds || []).find((r) => r?.refund_status === REFUND_STATUS.SUCCESS);
    const failed = (refunds || []).find((r) => [REFUND_STATUS.FAILED, REFUND_STATUS.CANCELLED].includes(r?.refund_status));
    if (processed) {
      current.refundStatus = "processed";
      current.gatewayRefundId = processed.refund_id || processed.cf_refund_id || current.gatewayRefundId;
      current.refundedAmount = Number(processed.refund_amount || 0);
      current.refundedAt = current.refundedAt || new Date();
      current.status = current.refundedAmount >= Number(current.amount) ? "refunded" : "paid";
      await current.save();
      result.changed = true;
    } else if (failed) {
      // A failed refund puts the money back in "we still hold it" territory,
      // so the payment returns to paid rather than staying in limbo.
      current.refundStatus = "failed";
      current.status = "paid";
      current.failureReason = "Cashfree refund failed.";
      await current.save();
      result.changed = true;
    }
  }

  await Payment.updateOne(
    { _id: payment._id },
    { $set: { gatewayStatus: remoteOrder?.order_status || null, lastReconciledAt: new Date() } }
  );
  return result;
}

async function reconcileRecentPayments() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const payments = await Payment.find({
    createdAt: { $gte: cutoff },
    gateway: "cashfree",
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
