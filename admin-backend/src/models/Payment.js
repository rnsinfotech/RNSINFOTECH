const mongoose = require("mongoose");

// Collection: `payments` — per BACKEND_PLAN.md's ownership matrix,
// written by storefront-backend (create/verify) and admin-backend (mark
// refunded), read by both. Field-level split, documented here since the
// matrix row only says who touches the collection:
//   Written ONLY by storefront-backend (create-order, verify, webhook —
//   see that project's Payment.js / payment.controller.js / razorpay.service.js):
//     order, user, razorpayOrderId, razorpayPaymentId, razorpaySignature,
//     amount, currency, method, failureReason, verifiedAt, and `status`
//     for every value EXCEPT "refunded"
//   Written ONLY by admin-backend (this file's refund endpoint):
//     status = "refunded", refundedAmount, refundReason, refundedAt
// This service never creates a Payment and never calls the Razorpay API
// at all — it only reads records storefront-backend wrote, and marks one
// refunded. Mirror of storefront-backend/src/models/Payment.js — same
// hand-sync convention as every other shared-collection model.
const PAYMENT_STATUSES = ["created", "paid", "failed", "expired", "refunded"];

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, default: null },
    razorpaySignature: { type: String, default: null, select: false },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "created", index: true },
    method: { type: String, default: null },
    failureReason: { type: String, default: null },
    expiresAt: { type: Date, default: null, index: true },
    creationLockExpiresAt: { type: Date, default: null, index: true },
    activeAttemptKey: { type: String, default: null, sparse: true, index: true },
    razorpayStatus: { type: String, default: null },
    lastReconciledAt: { type: Date, default: null },
    refundStatus: { type: String, enum: ["none", "pending", "processed", "failed"], default: "none", index: true },
    razorpayRefundId: { type: String, default: null, index: true },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundReason: { type: String, default: null },
    refundInitiatedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.razorpaySignature;
        delete ret.__v;
        return ret;
      },
    },
  }
);

paymentSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;

module.exports = mongoose.model("Payment", paymentSchema);
