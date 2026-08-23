const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { env } = require("../config/env");
const { sendTransactionalEmail } = require("../services/email.service");
const { calculateStoredOrderPricing, pricingMatchesOrder } = require("../services/pricing.service");
const { consumeOrderReservation, releaseFailedPaymentReservation } = require("../services/stock.service");
const { consumeCoupon, releaseCoupon } = require("../services/coupon.service");
const { transitionOrder } = require("../services/orderLifecycle.service");
const {
  createRazorpayOrder,
  createRazorpayRefund,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require("../services/razorpay.service");

async function settlePaidPayment(payment, { paymentId, method = null } = {}) {
  const currentOrder = await Order.findById(payment.order);
  if (!currentOrder) throw ApiError.notFound("Order not found.");

  if (currentOrder.reservationStatus && (currentOrder.reservationStatus !== "reserved" || !currentOrder.reservationExpiresAt || new Date(currentOrder.reservationExpiresAt) <= new Date())) {
    throw ApiError.conflict("Inventory reservation expired before payment could be confirmed.");
  }

  const update = {
    $set: {
      status: "paid",
      razorpayPaymentId: paymentId || payment.razorpayPaymentId,
      method: method || payment.method || null,
      verifiedAt: payment.verifiedAt || new Date(),
      failureReason: null,
      razorpayStatus: "captured",
    },
  };
  let saved = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "refunded" } },
    update,
    { new: true }
  );
  if (saved === undefined) {
    Object.assign(payment, update.$set);
    if (typeof payment.save === "function") await payment.save();
    saved = payment;
  } else if (!saved) {
    return Payment.findById(payment._id);
  }

  const paidOrder = await Order.findById(payment.order);
  if (paidOrder) {
    await consumeOrderReservation(paidOrder);
    if (paidOrder.couponReservationId) await consumeCoupon(paidOrder.couponReservationId);
    // The single gate that makes this order exist for the customer:
    // it only appears in "My Orders" / counts toward admin dashboard
    // revenue once this is set. Set once, never unset, never touched
    // anywhere else in either backend.
    if (!paidOrder.paymentVerifiedAt) {
      await Order.updateOne({ _id: paidOrder._id, paymentVerifiedAt: null }, { $set: { paymentVerifiedAt: new Date() } });
      paidOrder.paymentVerifiedAt = new Date();
    }
    try {
      const user = await User.findById(paidOrder.user).select("email").lean();
      if (user?.email) {
        await sendTransactionalEmail("payment-confirmation", user.email, {
          orderId: paidOrder._id, amount: saved.amount
        }, `payment:${saved._id}:confirmed`);
      }
    } catch (_) { /* email queue failure must never change payment state */ }
  }
  return saved;
}

async function failPayment(payment, reason, status = "failed") {
  let saved = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: ["paid", "refunded"] } },
    { $set: { status, failureReason: reason, razorpayStatus: status === "expired" ? "expired" : "failed" } },
    { new: true }
  );
  if (saved === undefined) {
    payment.status = status;
    payment.failureReason = reason;
    payment.razorpayStatus = status === "expired" ? "expired" : "failed";
    if (typeof payment.save === "function") await payment.save();
    saved = payment;
  } else if (!saved) {
    return Payment.findById(payment._id);
  }
  await releaseFailedPaymentReservation(payment.order, reason);
  const order = await Order.findById(payment.order);
  if (order?.couponReservationId) await releaseCoupon(order.couponReservationId, reason);
  if (order && ["pending", "confirmed"].includes(order.status) && order.reservationStatus !== "consumed") {
    try { await transitionOrder(order, "cancelled", { actorType: "system", note: reason }); } catch (_) {}
  }
  return saved;
}

// POST /api/payments/create-order
const createPaymentOrder = asyncHandler(async (req, res) => {
  let order = await Order.findOne({ _id: req.body.orderId, user: req.auth.userId });
  if (!order) throw ApiError.notFound("Order not found.");

  const existingPaid = await Payment.findOne({ order: order._id, status: "paid" });
  if (existingPaid) throw ApiError.conflict("This order has already been paid for.");

  const existingAttempt = await Payment.findOne({ order: order._id, status: "created", expiresAt: { $gt: new Date() } });
  if (existingAttempt?.razorpayOrderId && !String(existingAttempt.razorpayOrderId).startsWith("pending_")) {
    return res.status(200).json({
      payment: existingAttempt,
      razorpayOrderId: existingAttempt.razorpayOrderId,
      amount: Math.round(existingAttempt.amount * 100),
      currency: existingAttempt.currency || "INR",
      keyId: env.razorpayKeyId,
    });
  }

  if (order.reservationStatus && (order.reservationStatus !== "reserved" || !order.reservationExpiresAt || new Date(order.reservationExpiresAt) <= new Date())) {
    throw ApiError.conflict("This order's inventory reservation has expired. Please place the order again.");
  }

  const calculated = calculateStoredOrderPricing(order);
  if (!pricingMatchesOrder(order, calculated)) throw ApiError.conflict("This order price is no longer internally consistent. Please restart checkout.");

  const lockUntil = new Date(Date.now() + 30000);
  if (typeof Order.findOneAndUpdate === "function") {
    const locked = await Order.findOneAndUpdate(
      {
        _id: order._id,
        user: req.auth.userId,
        $or: [{ paymentCreationLockUntil: null }, { paymentCreationLockUntil: { $lte: new Date() } }],
      },
      { $set: { paymentCreationLockUntil: lockUntil } },
      { new: true }
    );
    if (locked === null) {
      const retry = await Payment.findOne({ order: order._id, status: "created", expiresAt: { $gt: new Date() } });
      if (retry) return res.status(200).json({ payment: retry, razorpayOrderId: retry.razorpayOrderId, amount: Math.round(retry.amount * 100), currency: retry.currency, keyId: env.razorpayKeyId });
      throw ApiError.conflict("Another payment attempt is already being created. Please retry shortly.");
    }
    if (locked) order = locked;
  }

  try {
    const finalAmount = calculated.total;
    const razorpayOrder = await createRazorpayOrder({
      amountInRupees: finalAmount,
      receipt: String(order._id),
      notes: { orderId: String(order._id), userId: String(req.auth.userId) },
    });
    const expectedPaise = Math.round(finalAmount * 100);
    if (Number(razorpayOrder.amount) !== expectedPaise || razorpayOrder.currency !== "INR") {
      throw ApiError.conflict("Razorpay amount does not match the server-calculated order total.");
    }

    const paymentTimeout = new Date(Date.now() + env.paymentTimeoutMinutes * 60 * 1000);
    const expiresAt = order.reservationExpiresAt && new Date(order.reservationExpiresAt) < paymentTimeout
      ? order.reservationExpiresAt
      : paymentTimeout;
    const payment = await Payment.findOneAndUpdate(
      { order: order._id, status: "created", activeAttemptKey: String(order._id) },
      {
        $set: {
          razorpayOrderId: razorpayOrder.id,
          amount: finalAmount,
          currency: razorpayOrder.currency,
          expiresAt,
          creationLockExpiresAt: null,
          activeAttemptKey: null,
        },
        $setOnInsert: {
          order: order._id,
          user: req.auth.userId,
          status: "created",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // If the deployment uses a schema without the new attempt fields during
    // a rolling upgrade, fall back to a normal create.
    const finalPayment = payment || await Payment.create({
      order: order._id,
      user: req.auth.userId,
      razorpayOrderId: razorpayOrder.id,
      amount: finalAmount,
      currency: razorpayOrder.currency || "INR",
      status: "created",
      expiresAt,
    });

    res.status(201).json({
      payment: finalPayment,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: env.razorpayKeyId,
    });
  } finally {
    Promise.resolve(Order.updateOne({ _id: order._id }, { $set: { paymentCreationLockUntil: null } })).catch(() => {});
  }
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const payment = await Payment.findOne({ razorpayOrderId, user: req.auth.userId });
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status === "paid" || payment.status === "refunded") return res.json({ payment });

  if (!verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })) {
    await failPayment(payment, "Signature verification failed.");
    throw ApiError.badRequest("Payment verification failed.");
  }

  const order = await Order.findById(payment.order);
  if (!order || (order.reservationStatus && (order.reservationStatus !== "reserved" || !order.reservationExpiresAt || new Date(order.reservationExpiresAt) <= new Date()))) {
    await failPayment(payment, "Inventory reservation expired before payment verification.", "expired");
    throw ApiError.conflict("The inventory reservation expired before payment could be confirmed. Please contact support if your bank was charged.");
  }

  const updated = await settlePaidPayment(payment, { paymentId: razorpayPaymentId });
  res.json({ payment: updated });
});

const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature || !verifyWebhookSignature(req.body, signature)) throw ApiError.badRequest("Invalid webhook signature.");

  const event = JSON.parse(req.body.toString("utf8"));
  const paymentEntity = event.payload?.payment?.entity;
  const refundEntity = event.payload?.refund?.entity;

  if (event.event?.startsWith("refund.") && refundEntity) {
    const payment = await Payment.findOne({ razorpayPaymentId: refundEntity.payment_id });
    if (payment) {
      const processed = ["refund.processed", "refund.created"].includes(event.event);
      const failed = event.event === "refund.failed";
      if (processed) {
        payment.refundStatus = "processed";
        payment.razorpayRefundId = refundEntity.id;
        payment.refundedAmount = Number(refundEntity.amount || 0) / 100;
        payment.refundedAt = payment.refundedAt || new Date();
        payment.status = "refunded";
        await payment.save();
        // NOTE: the simplified 4-state order model (see
        // PROGRESS_ORDER_SIMPLIFICATION.md) has no "refunded" order status —
        // "refunded" only ever exists on Payment. A refund is only ever
        // initiated for an order that's already "cancelled" (see
        // cancelMyOrder / admin-backend's refund endpoint, which gates on
        // order.status === "cancelled"), so there is nothing to transition
        // here. Previously this called transitionOrder(order, "refunded", ...),
        // which always threw (invalid transition target) and was silently
        // swallowed — dead code left over from before the simplification.
        try {
          const user = await User.findById(payment.user).select("email").lean();
          if (user?.email) await sendTransactionalEmail("refund", user.email, {
            orderId: payment.order, amount: payment.refundedAmount, status: payment.refundStatus, refundId: payment.razorpayRefundId
          }, `refund:${payment._id}:${payment.razorpayRefundId}:processed`);
        } catch (_) {}
      } else if (failed) {
        payment.refundStatus = "failed";
        payment.status = "paid";
        payment.failureReason = refundEntity.failure_reason || "Razorpay refund failed.";
        await payment.save();
      }
    }
    return res.json({ received: true });
  }

  if (!paymentEntity) return res.json({ received: true });
  const payment = await Payment.findOne({ razorpayOrderId: paymentEntity.order_id });
  if (!payment) return res.json({ received: true });

  if (event.event === "payment.captured") {
    if (payment.status !== "paid" && payment.status !== "refunded") {
      try {
        await settlePaidPayment(payment, { paymentId: paymentEntity.id, method: paymentEntity.method });
      } catch (_) {
        await failPayment(payment, "Inventory reservation expired before captured payment was received.", "expired");
        try {
          const refund = await createRazorpayRefund({
            razorpayPaymentId: paymentEntity.id,
            amountInRupees: Number(payment.amount),
            notes: { orderId: String(payment.order), reason: "Captured after inventory reservation expiry" },
          });
          payment.status = "refunded";
          payment.refundStatus = refund.status === "processed" ? "processed" : "pending";
          payment.razorpayPaymentId = paymentEntity.id;
          payment.razorpayRefundId = refund.id;
          payment.refundedAmount = Number(refund.amount || 0) / 100;
          payment.refundInitiatedAt = new Date();
          payment.refundedAt = refund.status === "processed" ? new Date() : null;
          payment.failureReason = "Payment captured after inventory reservation expiry; refund initiated.";
          await payment.save();
        } catch (_) {}
      }
    }
  } else if (event.event === "payment.failed" && !["paid", "refunded"].includes(payment.status)) {
    await failPayment(payment, paymentEntity.error_description || "Payment failed.");
  }

  res.json({ received: true });
});

const listPaymentsForOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.orderId, user: req.auth.userId });
  if (!order) throw ApiError.notFound("Order not found.");
  const payments = await Payment.find({ order: order._id }).sort({ createdAt: -1 });
  res.json({ items: payments });
});

module.exports = { createPaymentOrder, verifyPayment, webhook, listPaymentsForOrder, settlePaidPayment, failPayment };
