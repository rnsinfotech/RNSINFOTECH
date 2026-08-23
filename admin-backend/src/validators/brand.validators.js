const { z } = require("zod");

const createBrandSchema = z.object({
  name: z.string().trim().min(2).max(100),
  logo: z.string().trim().max(1000).optional().default(""),
  isActive: z.coerce.boolean().optional().default(true),
});

const updateBrandSchema = createBrandSchema.partial();

const listBrandQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
  search: z.string().trim().optional(),
  isActive: z.coerce.boolean().optional(),
});

module.exports = { createBrandSchema, updateBrandSchema, listBrandQuerySchema };
