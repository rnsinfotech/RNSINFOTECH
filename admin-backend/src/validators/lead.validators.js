const { z } = require("zod");

const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.enum(["newsletter", "demo", "contact", "quote"]).optional(),
  status: z.enum(["new", "contacted", "closed"]).optional(),
  search: z.string().trim().max(200).optional(),
});

const setLeadStatusSchema = z.object({
  status: z.enum(["new", "contacted", "closed"]),
});

module.exports = { listLeadsQuerySchema, setLeadStatusSchema };
