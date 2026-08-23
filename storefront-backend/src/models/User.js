const mongoose = require("mongoose");

// Collection: `users` — owned/written by storefront-backend, read-only for
// admin-backend (see BACKEND_PLAN.md's ownership matrix). No password field
// at all: customers authenticate via email-OTP, matching the storefront's
// existing AuthContext UX (see that project's HANDOFF.md).
const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    isVerified: { type: Boolean, default: false },
    // Hash of the most recently issued refresh token, so a refresh token
    // can be checked against the DB (and invalidated on logout/rotation)
    // without persisting the raw token anywhere. `select: false` keeps it
    // out of normal queries/JSON responses by default.
    refreshTokenHash: { type: String, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.refreshTokenHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("User", userSchema);
