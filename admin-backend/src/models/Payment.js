const mongoose = require("mongoose");

// Collection: `payments` — per BACKEND_PLAN.md's ownership matrix,
// written by storefront-backend (create/verify) and admin-backend (mark
// refunded), read by both. Field-level split, documented here since the
// matrix row only says who touches the collection:
//   Written ONLY by storefront-backend (create-order, verify, webhook —
//   see that project's Payment.js / payment.controller.js / cashfree.service.js):
//     order, user, gateway, gatewayOrderId, gatewayPaymentId, amount,
//     currency, method, failureReason, verifiedAt, and `status` for every
//     value EXCEPT "refunded"
//   Written ONLY by admin-backend (this file's refund endpoint):
//     status = "refunded", refundedAmount, refundReason, refundedAt,
//     gatewayRefundId, refundStatus
// This service never creates a Payment. It calls Cashfree only to issue and
// read refunds — it never creates a payment order. Mirror of
// storefront-backend/src/models/Payment.js — same hand-sync convention as
// every other shared-collection model.
//
// GATEWAY NEUTRALITY
// The gateway columns are named `gateway*` rather than after a processor, so
// the data model does not have to change again the next time the processor
// does. `gateway` records which one each row belongs to, keeping historical
// rows truthful about their origin instead of relabelling them.
const PAYMENT_STATUSES = ["created", "paid", "failed", "expired", "refunded"];

const ACTIVE_GATEWAY = "cashfree";
const LEGACY_GATEWAY = "legacy";
const PAYMENT_GATEWAYS = [ACTIVE_GATEWAY, LEGACY_GATEWAY];

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    gateway: { type: String, enum: PAYMENT_GATEWAYS, default: ACTIVE_GATEWAY, index: true },
    gatewayOrderId: { type: String, required: true, unique: true, index: true },
    gatewayPaymentId: { type: String, default: null, index: true },
    gatewayStatus: { type: String, default: null },
    gatewayRefundId: { type: String, default: null, index: true },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "created", index: true },
    method: { type: String, default: null },
    failureReason: { type: String, default: null },
    expiresAt: { type: Date, default: null, index: true },
    creationLockExpiresAt: { type: Date, default: null, index: true },
    activeAttemptKey: { type: String, default: null, sparse: true, index: true },
    lastReconciledAt: { type: Date, default: null },
    refundStatus: { type: String, enum: ["none", "pending", "processed", "failed"], default: "none", index: true },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundReason: { type: String, default: null },
    refundInitiatedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    // Verbatim archive of the previous processor's identifiers, written once
    // by the storefront migration script and never again. Retained because
    // accounting, invoices, chargebacks and support tickets can still need to
    // trace an old transaction. select:false keeps it out of ordinary queries
    // and API responses — the admin payment list and detail endpoints do not
    // surface it.
    legacyGatewayData: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.legacyGatewayData;
        delete ret.__v;
        return ret;
      },
    },
  }
);

paymentSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
paymentSchema.statics.PAYMENT_GATEWAYS = PAYMENT_GATEWAYS;
paymentSchema.statics.ACTIVE_GATEWAY = ACTIVE_GATEWAY;
paymentSchema.statics.LEGACY_GATEWAY = LEGACY_GATEWAY;

module.exports = mongoose.model("Payment", paymentSchema);
