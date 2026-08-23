const mongoose = require("mongoose");

const couponRedemptionSchema = new mongoose.Schema(
  {
    coupon: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["reserved", "consumed", "released"], default: "reserved", index: true },
    reservedAt: { type: Date, default: Date.now },
    consumedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true, toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);

couponRedemptionSchema.index({ coupon: 1, user: 1, status: 1 });

module.exports = mongoose.model("CouponRedemption", couponRedemptionSchema);
