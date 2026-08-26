const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const { createCashfreeRefund, REFUND_STATUS } = require("./cashfree.service");
const Order = require("../models/Order");
const User = require("../models/User");
const { sendTransactionalEmail } = require("./email.service");

const AMOUNT_EPSILON = 0.01;

/**
 * Deterministic refund identifier.
 *
 * Cashfree treats refund_id as the idempotency key on Create Refund, so this
 * is derived from local state rather than randomised. Two consequences:
 *
 *   - a retried call (network timeout, admin double-click, a reconciliation
 *     job racing the button) resolves to the SAME Cashfree refund instead of
 *     issuing a second one;
 *   - the sequence suffix is what allows genuine successive partial refunds
 *     to be distinct, since each starts from a different refunded total.
 *
 * Must stay in step with buildRefundId in
 * storefront-backend/src/controllers/payment.controller.js, which uses the
 * "cancel" and "stockout" suffixes for the paths it owns.
 */
function buildRefundId(payment, alreadyRefunded) {
  const sequence = Math.round(Number(alreadyRefunded || 0) * 100);
  return `rfnd_${String(payment._id)}_a${sequence}`.slice(0, 40);
}

/**
 * Issue a refund against a paid payment.
 *
 * Authorization is NOT decided here — the caller (payment.controller's
 * refund action, behind requireAdmin + requireRole("Owner","Manager")) has
 * already established that. What this owns is the money: how much is legally
 * refundable, that it is claimed exactly once, and that local state only
 * moves after Cashfree confirms.
 */
async function initiateRefund(payment, { amount = null, reason = null, actorId = null } = {}) {
  if (!payment) throw ApiError.notFound("Payment not found.");
  if (payment.status !== "paid") throw ApiError.conflict(`Cannot refund a payment in "${payment.status}" status.`);
  if (!payment.gatewayOrderId) throw ApiError.conflict("Payment has no gateway order reference.");

  // Historical rows belong to a processor this application no longer talks
  // to. Refunding one has to happen out of band, in that provider's own
  // dashboard — silently routing it to Cashfree would attempt a refund
  // against an order Cashfree has never heard of.
  if (payment.gateway && payment.gateway !== Payment.ACTIVE_GATEWAY) {
    throw ApiError.conflict("This is a historical transaction from a previous payment provider and cannot be refunded through this system.");
  }

  // Refundable amount is derived from stored payment state. A caller-supplied
  // amount may only ever narrow it, never exceed it.
  const alreadyRefunded = Number(payment.refundedAmount || 0);
  const outstanding = Number(payment.amount) - alreadyRefunded;
  const refundAmount = amount == null ? outstanding : Number(amount);
  if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > outstanding + AMOUNT_EPSILON) {
    throw ApiError.badRequest("Refund amount exceeds the outstanding payment amount.");
  }

  // Atomic claim: whichever request flips refundStatus to "pending" first is
  // the only one that reaches the gateway call below. A second concurrent
  // refund attempt finds refundStatus already "pending" and is rejected,
  // which is what stops a double-click becoming two refunds.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "paid", refundStatus: { $in: ["none", "failed"] } },
    { $set: { refundStatus: "pending", refundInitiatedAt: new Date(), refundReason: reason || null } },
    { new: true }
  );
  if (!claimed) throw ApiError.conflict("A refund is already being processed for this payment.");

  try {
    const refund = await createCashfreeRefund({
      orderId: payment.gatewayOrderId,
      refundId: buildRefundId(payment, alreadyRefunded),
      amountInRupees: refundAmount,
      note: reason || "Admin refund",
    });

    const refundedTotal = alreadyRefunded + Number(refund.refund_amount || refundAmount);
    // Partial refunds keep the payment "paid" with a non-zero refundedAmount;
    // only a full refund moves the row to "refunded". Same convention the
    // storefront webhook handler uses.
    claimed.status = refundedTotal >= Number(payment.amount) - AMOUNT_EPSILON ? "refunded" : "paid";
    claimed.refundStatus = refund.refund_status === REFUND_STATUS.SUCCESS ? "processed" : "pending";
    claimed.gatewayRefundId = refund.refund_id || refund.cf_refund_id || null;
    claimed.refundedAmount = refundedTotal;
    claimed.refundedAt = refund.refund_status === REFUND_STATUS.SUCCESS ? new Date() : null;
    await claimed.save();
    try {
      const order = await Order.findById(payment.order).select("_id");
      const user = await User.findById(payment.user).select("email").lean();
      // eventKey is unique-indexed on EmailLog, so a retried refund cannot
      // produce a second notification for the same refund.
      if (user?.email) await sendTransactionalEmail("refund", user.email, {
        orderId: order?._id || payment.order, amount: claimed.refundedAmount, status: claimed.refundStatus,
        refundId: claimed.gatewayRefundId
      }, `refund:${payment._id}:${claimed.gatewayRefundId || "pending"}`);
    } catch (_) { /* email is asynchronous and must not change refund state */ }
    return claimed;
  } catch (err) {
    // A transport-level failure is NOT proof the refund did not happen —
    // Cashfree may have accepted it and the response been lost. Leave the
    // row in "pending" so reconciliation can resolve it against the gateway,
    // rather than marking it failed and inviting a second refund.
    if (err?.retryable) {
      throw ApiError.badGateway("The refund could not be confirmed and will be reconciled automatically. Do not retry manually yet.");
    }
    await Payment.updateOne(
      { _id: payment._id, refundStatus: "pending" },
      { $set: { refundStatus: "failed", failureReason: err.message } }
    );
    throw ApiError.badGateway("The refund could not be initiated.");
  }
}

module.exports = { initiateRefund, buildRefundId };
