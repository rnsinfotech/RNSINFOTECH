const { z } = require("zod");

const SLUG_RE = /^[a-z0-9-]+$/;

// Kept in sync with admin-portal's CategoryFormModal ICONS list — those
// are the only keys the storefront's Icon component actually renders.
const CATEGORY_ICONS = ["display", "tablet", "pen", "layers", "package", "tag", "gear", "star"];

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, "slug may only contain lowercase letters, numbers, and hyphens").optional(),
  description: z.string().trim().max(1000).optional().default(""),
  icon: z.enum(CATEGORY_ICONS).optional(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
});

// Every field optional on update — the controller only touches what's
// actually present in the (already-parsed) body.
const updateCategorySchema = createCategorySchema.partial();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

module.exports = { createCategorySchema, updateCategorySchema, listQuerySchema };
