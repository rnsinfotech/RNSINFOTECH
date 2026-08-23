const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const { createRazorpayRefund } = require("./razorpay.service");
const Order = require("../models/Order");
const User = require("../models/User");
const { sendTransactionalEmail } = require("./email.service");

async function initiateRefund(payment, { amount = null, reason = null, actorId = null } = {}) {
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status !== "paid") throw ApiError.conflict(`Cannot refund a payment in "${payment.status}" status.`);
  if (!payment.razorpayPaymentId) throw ApiError.conflict("Payment has no Razorpay payment ID.");
  const outstanding = Number(payment.amount) - Number(payment.refundedAmount || 0);
  const refundAmount = amount == null ? outstanding : Number(amount);
  if (refundAmount <= 0 || refundAmount > outstanding) throw ApiError.badRequest("Refund amount exceeds the outstanding payment amount.");

  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "paid", refundStatus: { $in: ["none", "failed"] } },
    { $set: { refundStatus: "pending", refundInitiatedAt: new Date(), refundReason: reason || null } },
    { new: true }
  );
  if (!claimed) throw ApiError.conflict("A refund is already being processed for this payment.");

  try {
    const refund = await createRazorpayRefund({
      razorpayPaymentId: payment.razorpayPaymentId,
      amountInRupees: refundAmount,
      notes: { orderId: String(payment.order), reason: reason || "Admin refund", actorId: actorId ? String(actorId) : undefined },
    });
    claimed.status = refundAmount >= outstanding ? "refunded" : "paid";
    claimed.refundStatus = refund.status === "processed" ? "processed" : "pending";
    claimed.razorpayRefundId = refund.id;
    claimed.refundedAmount = Number(payment.refundedAmount || 0) + Number(refund.amount || 0) / 100;
    claimed.refundedAt = refund.status === "processed" ? new Date() : null;
    await claimed.save();
    try {
      const order = await Order.findById(payment.order).select("_id");
      const user = await User.findById(payment.user).select("email").lean();
      if (user?.email) await sendTransactionalEmail("refund", user.email, {
        orderId: order?._id || payment.order, amount: claimed.refundedAmount, status: claimed.refundStatus,
        refundId: claimed.razorpayRefundId
      }, `refund:${payment._id}:${claimed.razorpayRefundId || "pending"}`);
    } catch (_) { /* email is asynchronous and must not change refund state */ }
    return claimed;
  } catch (err) {
    await Payment.updateOne({ _id: payment._id, refundStatus: "pending" }, { $set: { refundStatus: "failed", failureReason: err.message } });
    throw ApiError.badGateway("Razorpay refund could not be initiated.");
  }
}
module.exports = { initiateRefund };
