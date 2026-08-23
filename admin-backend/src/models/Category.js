const mongoose = require("mongoose");

// Collection: `categories` — owned by admin-backend (writes full CRUD +
// image), read-only in storefront-backend, per BACKEND_PLAN.md's
// ownership matrix. storefront-backend keeps its own copy of this schema
// for read queries only — no shared package between the two services yet
// (see BACKEND_PLAN.md's Phase B0 note on why one isn't required to ship
// Phase 10). If you change a field here, mirror the change in
// storefront-backend/src/models/Category.js too.
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Auto-generated from name (or an explicit override) in the
    // controller — see utils/slugify.js — and kept unique there via a
    // uniqueSlug() collision check, not a DB-level retry loop.
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, trim: true, default: "" },
    // One of the fixed icon keys the admin-portal picker offers (see
    // admin-portal's CategoryFormModal ICONS list / Icon component) —
    // rendered next to the category name in the storefront nav/homepage.
    icon: { type: String, trim: true, default: "tag" },
    image: {
      url: { type: String, default: null },
      publicId: { type: String, default: null },
    },
    // Manual display ordering in the storefront's category nav —
    // ascending, lower first. Ties break on name.
    sortOrder: { type: Number, default: 0 },
    // Soft-hide instead of delete: storefront-backend's public reads
    // always filter isActive: true, but existing products can keep
    // referencing a deactivated category without a dangling ref.
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
