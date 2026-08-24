const mongoose = require("mongoose");

// Collection: `products` — owned by admin-backend, read-only in
// storefront-backend, per BACKEND_PLAN.md's ownership matrix. Mirror any
// field change in storefront-backend/src/models/Product.js too — see the
// note in Category.js for why there's no shared schema package yet.
//
// Single brand catalogue (per the earlier storefront redesign this build
// is based on) — deliberately no `brand` field.
const PRODUCT_TYPES = ["Pen Tablet", "Pen Display", "Stylus", "Accessory"];

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: null },
  },
  { _id: true }
);

// Manufacturer-hosted driver/manual links, added by the admin at product
// creation/edit time. These point at the original brand website rather
// than any file we host ourselves — no upload, no storage, just a label
// + URL shown on the product's detail page.
const productDownloadLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 100 },
    url: { type: String, required: true, trim: true },
  },
  { _id: true }
);

// "What's in the box" — the physical items that ship with the product,
// shown on the storefront product page alongside Description and
// Specifications. Just item names (e.g. "Pen Tablet", "USB-C cable",
// "Quick start guide") — same shape as `highlights` below, capped at 20
// for the same reason.

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    brand: { type: String, trim: true, default: "" },
    productType: { type: String, enum: PRODUCT_TYPES, default: "Pen Tablet" },
    // Rich-text HTML (headings, lists, links, embedded images) authored in
    // the admin portal's description editor; sanitized on save (see
    // utils/sanitizeDescription.js) before ever reaching the storefront.
    description: { type: String, trim: true, default: "", maxlength: 50000 },
    shortDescription: { type: String, trim: true, default: "", maxlength: 200 },
    images: { type: [productImageSchema], default: [], validate: { validator: (images) => images.length <= 12, message: "A product may have at most 12 images." } },
    // Short bullet points shown on the storefront product page just below
    // the price (e.g. "8,192 pressure levels with tilt recognition") —
    // distinct from `specifications` below, which is structured label/value
    // spec-sheet data. Capped at 20 for the same reason as downloadLinks.
    highlights: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      default: [],
      validate: { validator: (items) => items.length <= 20, message: "A product may have at most 20 highlights." },
    },
    price: { type: Number, required: true, min: 0 },
    // Struck-through "original" price shown alongside `price` in the UI;
    // discountPercent below is derived from the two, never stored.
    mrp: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    // Free-form spec sheet (e.g. "Active Area" -> "10 x 6 in") so new spec
    // rows never need a schema migration. Structured stock adjustments
    // with an audit trail are Phase B10 (inventorylog) — this field is
    // just the current count.
    specifications: { type: Map, of: String, default: {} },
    tags: [{ type: String, trim: true, lowercase: true }],
    // Links to drivers/manuals hosted on the manufacturer's own site —
    // see productDownloadLinkSchema above. Capped at 20, same rationale
    // as the 12-image cap: keep the admin form and detail page sane.
    downloadLinks: {
      type: [productDownloadLinkSchema],
      default: [],
      validate: { validator: (links) => links.length <= 20, message: "A product may have at most 20 download links." },
    },
    // "What's in the box" — see the note above.
    packageContents: {
      type: [{ type: String, trim: true, maxlength: 100 }],
      default: [],
      validate: { validator: (items) => items.length <= 20, message: "A product may have at most 20 package content items." },
    },
    // Both set by Phase B6 (Reviews) moderation, not written here in B2 —
    // present now so the field exists on every product from the start
    // rather than being backfilled later.
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    // Homepage curation (Phase H1). isFeatured/isBestSeller are the
    // admin's manual picks for the two curated homepage rails; the other
    // two rails (New Arrivals, Discounted) are computed automatically
    // from createdAt / price vs mrp and need no flag here. The paired
    // *Order fields let admin control display order within each rail —
    // null means "not curated for that rail" (kept out of the query
    // filter with $ne: null rather than doing an isFeatured boolean AND
    // an order sort, so a product can be unmarked without a second
    // write). Lower number = shown first.
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

// Text index backs both services' `search` query param ($text search
// across name/description/tags) — see product.controller.js (admin) and
// catalog.controller.js (storefront).
productSchema.index({ name: "text", description: "text", tags: "text" });

// Mirrors storefront-backend/src/models/Product.js — same physical
// collection, so defined here too to keep both mongoose models' index
// declarations in sync (avoid drift, even though MongoDB only needs the
// index created once). Backs the storefront's default "isActive +
// newest" product listing and its isFeatured filter.
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ isActive: 1, stock: 1 });
// Backs the storefront homepage endpoint's curated-rail queries (Phase
// H1): fetch isActive + isFeatured/isBestSeller docs pre-sorted by the
// admin's chosen order without an in-memory sort.
productSchema.index({ isActive: 1, isFeatured: 1, homepageFeaturedOrder: 1 });
productSchema.index({ isActive: 1, isBestSeller: 1, homepageBestSellerOrder: 1 });

module.exports = mongoose.model("Product", productSchema);
