const { z } = require("zod");

// Public product listing — every field optional since this is a browse/
// filter query, not a form submission. No `isActive`/`isFeatured`-as-filter
// toggle for hiding inactive products here on purpose: the controller
// always forces isActive: true itself, so a customer can never pull up
// products staff have hidden by passing a query param.
const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  featured: z.coerce.boolean().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "rating", "name"]).optional(),
});

module.exports = { listProductsQuerySchema };
