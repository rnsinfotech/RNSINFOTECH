const mongoose = require("mongoose");

// Collection: `orders` — the one collection BOTH services write to, per
// BACKEND_PLAN.md's ownership matrix ("both — storefront creates; admin
// advances status"). The matrix table only says "both", so the actual
// field-level boundary is documented here, in one place, since it's the
// thing a future phase is most likely to get wrong:
//
//   Written ONLY by storefront-backend, at creation, never touched again:
//     user, items, itemsTotal, shippingAddress, couponCode, discount
//
//   `itemsTotal` is the actual payable/charged amount (what Razorpay is
//   asked for and what admin-backend's revenue aggregates sum) — as of
//   Phase BC it already has any coupon discount folded in, NOT a raw
//   Σ price × quantity. `discount` is only the amount that was subtracted
//   at placement time, kept alongside `couponCode` purely so an order can
//   still show/audit what was applied; recompute nothing from it.
//   Written ONLY by admin-backend, after creation (see that project's
//   Order.js / order.controller.js):
//     status, courierName, trackingId, confirmedAt, shippedAt,
//     cancelledAt, cancelReason
//
// Mirror of admin-backend/src/models/Order.js — same hand-sync convention
// as Product.js/Category.js. If a field changes here, mirror it there.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    // Name/image/price are snapshotted at order-placement time, not
    // looked up live from the Product doc on every read — so a later
    // rename, re-image, or price change in admin-backend never
    // retroactively changes what a customer's past order shows they
    // ordered/paid, per BACKEND_PLAN.md Phase B3's "items snapshot" note.
    name: { type: String, required: true },
    sku: { type: String, default: "" },
    image: { type: String, default: null },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    gstin: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "India" },
  },
  { _id: false }
);

// Simplified order lifecycle (see PROGRESS_ORDER_SIMPLIFICATION.md):
//   pending   — payment verified, awaiting admin confirmation
//   confirmed — admin has confirmed the order
//   shipped   — admin has shipped the order (courierName + trackingId set); terminal
//   cancelled — cancelled before shipping; terminal
// An order row only ever exists for a customer once payment is verified —
// see paymentVerifiedAt below and payment.controller.js's settlePaidPayment.
const ORDER_STATUSES = ["pending", "confirmed", "shipped", "cancelled"];

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "An order must contain at least one item.",
      },
    },
    // Final payable amount calculated exclusively by the storefront pricing engine.
    // Kept as itemsTotal for backward compatibility with existing admin/revenue code.
    itemsTotal: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxPolicy: { type: mongoose.Schema.Types.Mixed, default: { priceIncludesTax: false, taxType: "GST" } },
    taxBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    shippingAddress: { type: shippingAddressSchema, required: true },
    // Coupon and discount are persisted as an audit of the server calculation.
    couponCode: { type: String, default: null },
    discount: { type: Number, default: 0, min: 0 },
    couponSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    pricing: { type: mongoose.Schema.Types.Mixed, default: null },
    reservationStatus: { type: String, enum: ["pending", "reserved", "consumed", "released", "expired"], default: "pending", index: true },
    reservationExpiresAt: { type: Date, default: null, index: true },
    reservationReleasedAt: { type: Date, default: null },
    reservationReleaseReason: { type: String, default: null },
    paymentCreationLockUntil: { type: Date, default: null, index: true },
    couponReservationId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    // Set exactly once, by payment.controller.js's settlePaidPayment, the
    // moment Razorpay payment is verified (client-callback signature check
    // OR the webhook — whichever settles first). This is the single gate
    // that decides whether a customer's order is visible in "My Orders" /
    // whether admin-backend's dashboard counts it as a successful sale.
    // Never set anywhere else, never unset.
    paymentVerifiedAt: { type: Date, default: null, index: true },
    // Fixed at order placement, shown to the customer throughout checkout
    // and order tracking. Not derived from courier data — this store's
    // delivery promise is a flat 3-4 day estimate, not per-order ETAs.
    deliveryEstimate: { type: String, default: "3-4 days" },
    // The four fields below are set by admin-backend only (confirm/ship/
    // cancel) — storefront-backend never writes to them after creation,
    // it only ever reads them back for the customer's order-tracking UI.
    courierName: { type: String, default: null },
    trackingId: { type: String, default: null },
    // Admin-uploaded bill/invoice file (replaces the old auto-generated
    // GST invoice). Read-only here — set by admin-backend when the
    // order is shipped.
    billUrl: { type: String, default: null },
    billUploadedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
    statusHistory: [{
      status: { type: String, enum: ORDER_STATUSES, required: true },
      at: { type: Date, default: Date.now },
      actorType: { type: String, enum: ["customer", "admin", "system"], default: "system" },
      actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
      note: { type: String, default: null },
    }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });

orderSchema.statics.ORDER_STATUSES = ORDER_STATUSES;

module.exports = mongoose.model("Order", orderSchema);
