const mongoose = require("mongoose");

// Collection: `products` — owned/written by admin-backend, read-only
// here, per BACKEND_PLAN.md's ownership matrix. Mirror of
// admin-backend/src/models/Product.js — see that file for field
// reasoning. This service only ever queries it.
const PRODUCT_TYPES = ["Pen Tablet", "Pen Display", "Stylus", "Accessory"];

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
  },
  { _id: true }
);

// Mirrors admin-backend/src/models/Product.js — manufacturer-hosted
// driver/manual links set by the admin at product creation/edit time.
// Read-only here, same as the rest of this file.
const productDownloadLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true, trim: true },
  },
  { _id: true }
);

// Mirrors admin-backend/src/models/Product.js — "what's in the box"
// item names shown on the storefront product page. Read-only here.

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    brand: { type: String, trim: true, default: "" },
    productType: { type: String, enum: PRODUCT_TYPES, default: "Pen Tablet" },
    // Rich-text HTML authored and sanitized on the admin side; rendered
    // as-is on the storefront product page.
    description: { type: String, trim: true, default: "", maxlength: 50000 },
    shortDescription: { type: String, trim: true, default: "", maxlength: 200 },
    images: { type: [productImageSchema], default: [] },
    // Mirrors admin-backend/src/models/Product.js — see that file for the
    // field's reasoning. Read-only here.
    highlights: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    // Mirrors admin-backend/src/models/Product.js — see that file for the
    // field's reasoning. Read-only here.
    specifications: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    tags: [{ type: String, trim: true, lowercase: true }],
    downloadLinks: { type: [productDownloadLinkSchema], default: [] },
    // Mirrors admin-backend/src/models/Product.js — see that file for
    // the field's reasoning. Read-only here.
    packageContents: { type: [{ type: String, trim: true, maxlength: 100 }], default: [] },
    // Written by admin-backend's Phase B6 review-moderation flow, read
    // here for product listing/detail display only.
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    // Mirrors admin-backend/src/models/Product.js — see that file for
    // the Phase H1 homepage-curation field reasoning. Read-only here.
    isFeatured: { type: Boolean, default: false },
    homepageFeaturedOrder: { type: Number, default: null, min: 0 },
    isBestSeller: { type: Boolean, default: false },
    homepageBestSellerOrder: { type: Number, default: null, min: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

productSchema.statics.PRODUCT_TYPES = PRODUCT_TYPES;

productSchema.virtual("discountPercent").get(function computeDiscountPercent() {
  if (!this.mrp || this.mrp <= this.price) return 0;
  return Math.round(((this.mrp - this.price) / this.mrp) * 100);
});

// Backs the public `search` query param ($text search across
// name/description/tags) — see catalog.controller.js. Mongo only stores
// one text index per collection; this must stay identical to
// admin-backend's index definition since they're the same collection.
productSchema.index({ name: "text", description: "text", tags: "text" });

// listProducts always filters on isActive and, absent an explicit sort,
// orders by createdAt desc ("newest") — this compound index covers that
// default path. isFeatured is also a common filter (homepage/featured
// rails), hence the second index.
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ isActive: 1, stock: 1 });
// Backs the homepage endpoint's curated-rail queries (Phase H1) — see
// admin-backend/src/models/Product.js for the matching pair.
productSchema.index({ isActive: 1, isFeatured: 1, homepageFeaturedOrder: 1 });
productSchema.index({ isActive: 1, isBestSeller: 1, homepageBestSellerOrder: 1 });

module.exports = mongoose.model("Product", productSchema);
