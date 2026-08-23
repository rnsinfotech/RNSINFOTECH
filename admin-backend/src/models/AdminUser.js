const mongoose = require("mongoose");

const ROLES = ["Owner", "Manager", "Staff"];

const adminUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: false, default: null, select: false },
    role: { type: String, enum: ROLES, default: "Staff" },
    isActive: { type: Boolean, default: true },
    refreshTokenHash: { type: String, default: null, select: false },
    sessionVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.refreshTokenHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

adminUserSchema.statics.ROLES = ROLES;

module.exports = mongoose.model("AdminUser", adminUserSchema);
