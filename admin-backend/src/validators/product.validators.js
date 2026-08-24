const { z } = require("zod");
const Product = require("../models/Product");

const SLUG_RE = /^[a-z0-9-]+$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

// Manufacturer-hosted driver/manual links (see models/Product.js) —
// label + an absolute URL pointing at the original brand website.
const downloadLinkSchema = z.object({
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().url("Each download link must be a valid URL."),
});

// "What's in the box" — see the matching schema note in models/Product.js.
// Same shape as `highlights`: a plain list of item names.

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, "slug may only contain lowercase letters, numbers, and hyphens").optional(),
  sku: z.string().trim().min(2).max(40).optional(),
  category: z.string().trim().regex(OBJECT_ID_RE, "category must be a valid id"),
  brand: z.string().trim().min(1).max(100).optional().default(""),
  productType: z.enum(Product.PRODUCT_TYPES).optional(),
  // Full description is authored as rich-text HTML (headings, lists, links,
  // embedded images) — 50,000 chars comfortably covers a long, image-heavy
  // description while still guarding against pathological payloads. It's
  // sanitized server-side (see utils/sanitizeDescription.js) before saving.
  description: z.string().trim().max(50000).optional().default(""),
  shortDescription: z.string().trim().max(200).optional().default(""),
  price: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0).optional().default(0),
  specifications: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  highlights: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  tags: z.array(z.string().trim().toLowerCase()).optional(),
  downloadLinks: z.array(downloadLinkSchema).max(20).optional(),
  packageContents: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  isActive: z.coerce.boolean().optional(),
  // isFeatured/isBestSeller mark a product for a curated homepage rail;
  // the paired *Order fields are optional here because the controller
  // auto-assigns the next order slot when a product is newly marked
  // without one (see resolveHomepageCuration in product.controller.js).
  // Pass an explicit order to control placement directly.
  isFeatured: z.coerce.boolean().optional(),
  homepageFeaturedOrder: z.coerce.number().int().min(0).optional(),
  isBestSeller: z.coerce.boolean().optional(),
  homepageBestSellerOrder: z.coerce.number().int().min(0).optional(),
}).refine((data) => data.mrp >= data.price, { message: "mrp must be greater than or equal to price", path: ["mrp"] });

const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(150),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, "slug may only contain lowercase letters, numbers, and hyphens"),
  sku: z.string().trim().min(2).max(40),
  category: z.string().trim().regex(OBJECT_ID_RE, "category must be a valid id"),
  brand: z.string().trim().min(1).max(100),
  productType: z.enum(Product.PRODUCT_TYPES),
  description: z.string().trim().max(50000),
  shortDescription: z.string().trim().max(200),
  price: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0),
  specifications: z.array(z.string().trim().min(1).max(200)).max(20),
  highlights: z.array(z.string().trim().min(1).max(200)).max(20),
  tags: z.array(z.string().trim().toLowerCase()),
  downloadLinks: z.array(downloadLinkSchema).max(20),
  packageContents: z.array(z.string().trim().min(1).max(100)).max(20),
  isActive: z.coerce.boolean(),
  isFeatured: z.coerce.boolean(),
  homepageFeaturedOrder: z.coerce.number().int().min(0),
  isBestSeller: z.coerce.boolean(),
  homepageBestSellerOrder: z.coerce.number().int().min(0),
}).partial().refine((data) => data.mrp === undefined || data.price === undefined || data.mrp >= data.price, { message: "mrp must be greater than or equal to price", path: ["mrp"] });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().regex(OBJECT_ID_RE, "category must be a valid id").optional(),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  isFeatured: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  isBestSeller: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating", "name", "stock_asc", "stock_desc"]).optional(),
  brand: z.string().trim().optional(),
  stock: z.enum(["in-stock", "low-stock", "out-of-stock"]).optional(),
});

const bulkActionSchema = z.object({
  ids: z.array(z.string().regex(OBJECT_ID_RE)).min(1).max(100),
  action: z.enum(["activate", "deactivate", "change-category", "delete"]),
  categoryId: z.string().regex(OBJECT_ID_RE).optional(),
}).superRefine((data, ctx) => {
  if (new Set(data.ids).size !== data.ids.length) ctx.addIssue({ code: "custom", path: ["ids"], message: "Product ids must be unique." });
  if (data.action === "change-category" && !data.categoryId) ctx.addIssue({ code: "custom", path: ["categoryId"], message: "categoryId is required for category changes." });
});

module.exports = { createProductSchema, updateProductSchema, listQuerySchema, bulkActionSchema };
