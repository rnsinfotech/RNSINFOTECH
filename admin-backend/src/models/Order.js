const mongoose = require("mongoose");

// Collection: `orders` — the one collection BOTH services write to, per
// BACKEND_PLAN.md's ownership matrix ("both — storefront creates; admin
// advances status"). The matrix table only says "both", so the actual
// field-level boundary is documented here, in one place, since it's the
// thing a future phase is most likely to get wrong:
//
//   Written ONLY by storefront-backend, at creation, never touched again
//   (see that project's Order.js / order.controller.js):
//     user, items, itemsTotal, shippingAddress, couponCode, discount
//   itemsTotal is the actual payable/charged amount and, as of that
//   project's Phase BC, already has any coupon discount folded in — this
//   is what dashboard/customer revenue aggregates below correctly sum as
//   real revenue. couponCode/discount are read-only audit fields mirrored
//   here for display; nothing in this service recomputes from them.
//   Written ONLY by admin-backend, after creation (this file):
//     status, courierName, trackingId, confirmedAt, shippedAt,
//     cancelledAt, cancelReason
//
// Mirror of storefront-backend/src/models/Order.js — same hand-sync
// convention as Product.js/Category.js. If a field changes here, mirror
// it there.
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
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
//   pending -> confirmed -> shipped (terminal), or pending/confirmed -> cancelled (terminal).
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
    couponCode: { type: String, default: null },
    discount: { type: Number, default: 0, min: 0 },
    // Immutable snapshot of the pricing inputs used to create this order.
    // Payment creation re-calculates from this snapshot, so later admin
    // pricing changes cannot silently change an existing order's payable amount.
    couponSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    pricing: { type: mongoose.Schema.Types.Mixed, default: null },
    reservationStatus: { type: String, enum: ["pending", "reserved", "consumed", "released", "expired"], default: "pending", index: true },
    reservationExpiresAt: { type: Date, default: null, index: true },
    reservationReleasedAt: { type: Date, default: null },
    reservationReleaseReason: { type: String, default: null },
    paymentCreationLockUntil: { type: Date, default: null, index: true },
    couponReservationId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    // Set exactly once by storefront-backend's payment.controller.js the
    // moment Razorpay payment is verified. Dashboard revenue/growth
    // aggregates below must always filter on this, not just on `status`,
    // per the "only successful orders count as sales" requirement.
    paymentVerifiedAt: { type: Date, default: null, index: true },
    deliveryEstimate: { type: String, default: "3-4 days" },
    courierName: { type: String, default: null },
    trackingId: { type: String, default: null },
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
