const mongoose = require("mongoose");

// Collection: `users` (customers) — owned/written by storefront-backend,
// read-only here, per BACKEND_PLAN.md's ownership matrix. This service
// never creates/updates/deletes a User document; it only ever populates
// one onto an Order (see order.controller.js) so staff can see who
// placed it. Full customer-list functionality (join users with their
// orders) is Phase B5 — this is just enough of a mirror for that
// `.populate("user", "name email")` call to work in B3.
//
// Mirror of storefront-backend/src/models/User.js kept in sync by hand,
// same convention as Category.js/Product.js. Only the fields admin-backend
// actually reads are declared here — no OTP/refresh-token internals,
// since this service never touches those.
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

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model("User", userSchema);
