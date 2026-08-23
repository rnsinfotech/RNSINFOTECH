const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: "" },
    type: { type: String, enum: ["percent", "fixed"], default: "percent" },
    value: { type: Number, required: true, min: 0 },
    minOrderValue: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: 0, min: 0 },
    usageCount: { type: Number, default: 0, min: 0 },
    reservedCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    allowedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    maxUsesPerUser: { type: Number, default: 0, min: 0 },
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

couponSchema.methods.isExpired = function isExpired() {
  return !!this.expiresAt && new Date(this.expiresAt) < new Date();
};

couponSchema.methods.isExhausted = function isExhausted() {
  return this.usageLimit > 0 && this.usageCount >= this.usageLimit;
};

module.exports = mongoose.model("Coupon", couponSchema);
