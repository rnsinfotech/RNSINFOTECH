const mongoose = require("mongoose");

// Collection: `addresses` — owned/written by storefront-backend, read-only
// for admin-backend (see that project's Address.js mirror, added this same
// phase). Not one of the rows BACKEND_PLAN.md's original ownership matrix
// called out ahead of time — address book CRUD was scoped to Phase B5, not
// known when that table was written — but it follows the exact same
// owner/reader split as the `users` row right above it: a customer's own
// data, admin only ever needs to see it on that customer's record, never
// edit it.
const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, trim: true, default: "Home" },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: "" },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    gstin: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "India" },
    // Enforced as a single-winner invariant in address.controller.js (every
    // other address for the same user gets isDefault cleared whenever one
    // is set), not just a plain boolean field trusted as-is from the client.
    isDefault: { type: Boolean, default: false },
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

module.exports = mongoose.model("Address", addressSchema);
