const mongoose = require("mongoose");

// Collection: `addresses` — owned/written by storefront-backend, read-only
// here. Mirror of storefront-backend/src/models/Address.js kept in sync by
// hand, same convention as User.js/Category.js/Product.js/Order.js. This
// service only ever reads a customer's saved address book (Customers
// detail view, this same phase) — never creates/updates/deletes one, per
// BACKEND_PLAN.md's ownership split (this follows the `users` row's
// precedent, since address book CRUD wasn't a named row in the original
// matrix — see that file's Address.js for the full reasoning).
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
    country: { type: String, trim: true, default: "India" },
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
