const mongoose = require("mongoose");

// Collection: `payments` — per BACKEND_PLAN.md's ownership matrix,
// written by storefront-backend (create/verify) and admin-backend (mark
// refunded), read by both. The matrix row only says who touches the
// collection, not which fields — so the actual split is documented here,
// same convention as Order.js:
//   Written ONLY by storefront-backend (create-order, verify, webhook):
//     order, user, gateway, gatewayOrderId, gatewayPaymentId, amount,
//     currency, method, failureReason, verifiedAt, and `status` for every
//     value EXCEPT "refunded"
//   Written ONLY by admin-backend (refund):
//     status = "refunded" (the one status value only admin-backend ever
//     sets), refundedAmount, refundReason, refundedAt
// Mirror of admin-backend/src/models/Payment.js — same hand-sync
// convention as every other shared-collection model in this build.
//
// GATEWAY NEUTRALITY
// The gateway-specific columns are deliberately named `gateway*` rather than
// after a provider. The previous schema hard-coded one processor's field
// names into the data model, which is what turned swapping processors into a
// 30-file change instead of a one-service change. `gateway` records which
// processor each row belongs to, so historical rows stay truthful about
// their origin rather than being relabelled as payments they never were.
const PAYMENT_STATUSES = ["created", "paid", "failed", "expired", "refunded"];

// Only these two ever appear. The legacy value is read-only history carried
// by rows migrated from the previous processor (see
// scripts/migrateLegacyGatewayPayments.js); nothing in the application can
// create a new row with it — see the pre-validate guard below.
const ACTIVE_GATEWAY = "cashfree";
const LEGACY_GATEWAY = "legacy";
const PAYMENT_GATEWAYS = [ACTIVE_GATEWAY, LEGACY_GATEWAY];

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    gateway: { type: String, enum: PAYMENT_GATEWAYS, default: ACTIVE_GATEWAY, index: true },
    // Our own server-generated identifier, handed to Cashfree as `order_id`.
    // Never client-supplied: a customer able to choose their own gateway
    // order id could aim a payment at somebody else's order.
    gatewayOrderId: { type: String, required: true, unique: true, index: true },
    // Cashfree's `cf_payment_id` for the attempt that actually succeeded.
    gatewayPaymentId: { type: String, default: null, index: true },
    // Last known authoritative status string from the gateway, kept verbatim
    // for support and debugging. Never the source of truth for whether an
    // order is paid — `status` is, and only settlement writes it.
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
    // by the migration script and never again. Kept because accounting,
    // invoices, chargebacks and support tickets can all still need to trace
    // an old transaction back to the processor that handled it. select:false
    // keeps it out of ordinary queries and API responses.
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

// Structural backing for the "no new legacy transactions" requirement: even
// if some future code path tried, a brand-new document can only ever be
// created on the active gateway.
paymentSchema.pre("validate", function guardActiveGateway(next) {
  if (this.isNew && this.gateway && this.gateway !== ACTIVE_GATEWAY) {
    return next(new Error(`New payments must use the active gateway ("${ACTIVE_GATEWAY}").`));
  }
  next();
});

paymentSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
paymentSchema.statics.PAYMENT_GATEWAYS = PAYMENT_GATEWAYS;
paymentSchema.statics.ACTIVE_GATEWAY = ACTIVE_GATEWAY;
paymentSchema.statics.LEGACY_GATEWAY = LEGACY_GATEWAY;

module.exports = mongoose.model("Payment", paymentSchema);
