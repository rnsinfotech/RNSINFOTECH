const { z } = require("zod");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const adjustInventorySchema = z.object({
  productId: z.string().trim().regex(OBJECT_ID_RE, "productId must be a valid id"),
  delta: z.coerce.number().int(),
  reason: z.string().trim().min(2).max(200).optional().default("Adjustment"),
});

const listInventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  productId: z.string().trim().regex(OBJECT_ID_RE, "productId must be a valid id").optional(),
  search: z.string().trim().optional(),
});

module.exports = { adjustInventorySchema, listInventoryQuerySchema };
