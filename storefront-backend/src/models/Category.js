const mongoose = require("mongoose");

// Collection: `categories` — owned/written by admin-backend, read-only
// here, per BACKEND_PLAN.md's ownership matrix. This is a mirror of
// admin-backend/src/models/Category.js kept in sync by hand (no shared
// schema package yet — see that project's Category.js for why). This
// service only ever queries it; it never creates/updates/deletes a
// Category document.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: "" },
    icon: { type: String, trim: true, default: "tag" },
    image: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
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

module.exports = mongoose.model("Category", categorySchema);
