const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const Order = require("../models/Order");
const { rollbackConsumedCoupon } = require("../services/coupon.service");
const { restoreConsumedOrderStock } = require("../services/inventory.service");
const { initiateRefund } = require("../services/refund.service");
const {
  listCashfreeOrderPayments,
  listCashfreeOrderRefunds,
  getCashfreeOrder,
  findSuccessfulPayment,
  normalizePaymentMethod,
  PAYMENT_STATUS,
  REFUND_STATUS,
} = require("../services/cashfree.service");
const { transitionOrder } = require("../services/orderLifecycle.service");

const SORT_NEWEST = { createdAt: -1 };

const list = asyncHandler(async (req, res) => {
  const { page, limit, status, order } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (order) filter.order = order;
  const [items, total] = await Promise.all([
    Payment.find(filter).populate("user", "name email").sort(SORT_NEWEST).skip((page - 1) * limit).limit(limit),
    Payment.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

const getById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate("user", "name email").populate("order", "status");
  if (!payment) throw ApiError.notFound("Payment not found.");
  res.json({ payment });
});

const refund = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status !== "paid") throw ApiError.conflict("Only paid payments can be refunded.");
  if (payment.refundStatus === "pending" || payment.refundStatus === "processed") throw ApiError.conflict("This payment already has a refund in progress or completed.");
  if (req.body.amount !== undefined && Number(req.body.amount) > Number(payment.amount)) throw ApiError.badRequest("Refund amount cannot exceed the original payment amount.");
  const order = await Order.findById(payment.order);
  if (!order) throw ApiError.notFound("Order not found.");
  if (order.status !== "cancelled") {
    throw ApiError.conflict("Refund is only allowed for cancelled orders.");
  }

  const updated = await initiateRefund(payment, {
    amount: req.body.amount,
    reason: req.body.reason || "Cancelled order",
    actorId: req.admin?._id || null,
  });

  const fullyRefunded = Number(updated.refundedAmount || 0) >= Number(updated.amount || 0);
  if (fullyRefunded) {
    updated.refundReason = updated.refundReason || "Cancelled order";
    await updated.save();
    await rollbackConsumedCoupon(order._id, "Order fully refunded");
    await restoreConsumedOrderStock(order, { actorUser: req.admin?._id || null, reason: "Order fully refunded" });
  }

  res.json({ payment: updated });
});

const AMOUNT_EPSILON = 0.01;

/**
 * Reconcile one payment against Cashfree's authoritative state.
 *
 * The safety rule is the same one the storefront's background reconciler
 * follows: only ever move a payment FORWARD. A local "paid" row that reads as
 * unpaid at the gateway is a discrepancy to surface to a human, never an
 * instruction to un-sell an order that may already have shipped.
 */
const reconcile = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (!payment.gatewayOrderId) {
    throw ApiError.conflict("Payment has no remote gateway order.");
  }
  // Historical rows belong to a processor this application no longer talks
  // to; there is nothing to reconcile them against.
  if (payment.gateway && payment.gateway !== Payment.ACTIVE_GATEWAY) {
    throw ApiError.conflict("This is a historical transaction from a previous payment provider and cannot be reconciled.");
  }

  const remoteOrder = await getCashfreeOrder(payment.gatewayOrderId);
  const remotePayments = await listCashfreeOrderPayments(payment.gatewayOrderId);
  const captured = findSuccessfulPayment(remotePayments);

  if (captured && !["paid", "refunded"].includes(payment.status)) {
    // Settlement path, so it gets the same amount guard every other
    // settlement path has: a signed remote record is proof of a payment, not
    // proof it was for the right amount.
    if (Math.abs(Number(captured.payment_amount) - Number(payment.amount)) >= AMOUNT_EPSILON) {
      payment.failureReason = "Reconciliation found an amount mismatch; flagged for investigation.";
      payment.gatewayStatus = "AMOUNT_MISMATCH";
      payment.lastReconciledAt = new Date();
      await payment.save();
      throw ApiError.conflict("The gateway amount does not match this payment. It has been flagged for review rather than settled.");
    }
    payment.status = "paid";
    payment.gatewayPaymentId = captured.cf_payment_id;
    payment.method = normalizePaymentMethod(captured);
    payment.gatewayStatus = captured.payment_status;
    payment.verifiedAt = payment.verifiedAt || new Date();
    payment.lastReconciledAt = new Date();
    await payment.save();
  } else {
    // Backfill a method onto an already-settled payment. The storefront's
    // customer-return path often wins the race before the method is known,
    // so this is how an existing row self-heals from the Reconcile button
    // without needing a separate migration.
    if (captured && payment.status === "paid" && !payment.method) {
      payment.method = normalizePaymentMethod(captured);
    }
    payment.gatewayStatus = remoteOrder?.order_status || null;
    payment.lastReconciledAt = new Date();
    await payment.save();
  }

  if (payment.status === "refunded") {
    const currentOrder = await Order.findById(payment.order);
    if (currentOrder && ["pending", "confirmed"].includes(currentOrder.status) && /cancel/i.test(payment.refundReason || "")) {
      await restoreConsumedOrderStock(currentOrder, { actorUser: req.admin?._id || null, reason: "Refunded cancellation reconciliation" });
      if (currentOrder.couponReservationId) await rollbackConsumedCoupon(currentOrder._id, "Refunded cancellation reconciliation");
      try { await transitionOrder(currentOrder, "cancelled", { actorType: "admin", actorId: req.admin?._id || null, note: payment.refundReason }); } catch (_) {}
    }
  }

  // Resolve a refund we initiated but have not seen confirmed.
  if (payment.refundStatus === "pending" && payment.gatewayOrderId) {
    const refunds = await listCashfreeOrderRefunds(payment.gatewayOrderId);
    const processed = (refunds || []).find((r) => r?.refund_status === REFUND_STATUS.SUCCESS);
    const failed = (refunds || []).find((r) => [REFUND_STATUS.FAILED, REFUND_STATUS.CANCELLED].includes(r?.refund_status));
    if (processed) {
      payment.refundStatus = "processed";
      payment.gatewayRefundId = processed.refund_id || processed.cf_refund_id || payment.gatewayRefundId;
      payment.refundedAmount = Number(processed.refund_amount || 0);
      payment.refundedAt = payment.refundedAt || new Date();
      payment.status = payment.refundedAmount >= Number(payment.amount) - AMOUNT_EPSILON ? "refunded" : "paid";
      await payment.save();
    } else if (failed) {
      // A failed refund means we still hold the money, so the payment
      // returns to paid rather than staying in limbo.
      payment.status = "paid";
      payment.refundStatus = "failed";
      payment.gatewayRefundId = failed.refund_id || failed.cf_refund_id || payment.gatewayRefundId;
      payment.failureReason = "Cashfree refund failed.";
      await payment.save();
    }
  }
  res.json({ payment });
});

module.exports = { list, getById, refund, reconcile };
