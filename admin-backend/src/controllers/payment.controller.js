const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const Order = require("../models/Order");
const { rollbackConsumedCoupon } = require("../services/coupon.service");
const { restoreConsumedOrderStock } = require("../services/inventory.service");
const { initiateRefund } = require("../services/refund.service");
const { listRazorpayOrderPayments, listRazorpayPaymentRefunds, getRazorpayOrder } = require("../services/razorpay.service");
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

const reconcile = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (!payment.razorpayOrderId || String(payment.razorpayOrderId).startsWith("pending_")) {
    throw ApiError.conflict("Payment has no remote Razorpay order.");
  }
  const remoteOrder = await getRazorpayOrder(payment.razorpayOrderId);
  const remotePayments = await listRazorpayOrderPayments(payment.razorpayOrderId);
  const captured = (remotePayments.items || []).find((p) => ["captured", "authorized"].includes(p.status));
  if (captured && !["paid", "refunded"].includes(payment.status)) {
    payment.status = "paid";
    payment.razorpayPaymentId = captured.id;
    payment.method = captured.method || null;
    payment.razorpayStatus = captured.status;
    payment.verifiedAt = payment.verifiedAt || new Date();
    await payment.save();
  } else {
    // Same bug as the one just fixed on the storefront-backend side: this
    // branch used to only touch razorpayStatus/lastReconciledAt, so a
    // payment that was already "paid" (the common case — verifyPayment
    // settles it before the webhook/reconcile ever runs) could never get
    // its real method backfilled here, even by hitting Reconcile.
    if (captured && payment.status === "paid" && !payment.method && captured.method) {
      payment.method = captured.method;
    }
    payment.razorpayStatus = remoteOrder.status;
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
  if (payment.refundStatus === "pending" && payment.razorpayPaymentId) {
    const refunds = await listRazorpayPaymentRefunds(payment.razorpayPaymentId);
    const remoteRefund = (refunds.items || []).find((r) => ["processed", "failed", "created"].includes(r.status));
    if (remoteRefund && remoteRefund.status === "processed") {
      payment.status = "refunded";
      payment.refundStatus = "processed";
      payment.razorpayRefundId = remoteRefund.id;
      payment.refundedAmount = Number(remoteRefund.amount || 0) / 100;
      payment.refundedAt = payment.refundedAt || new Date();
      await payment.save();
    } else if (remoteRefund && remoteRefund.status === "failed") {
      payment.status = "paid";
      payment.refundStatus = "failed";
      payment.razorpayRefundId = remoteRefund.id;
      payment.failureReason = remoteRefund.failure_reason || "Razorpay refund failed.";
      await payment.save();
    }
  }
  res.json({ payment });
});

module.exports = { list, getById, refund, reconcile };
