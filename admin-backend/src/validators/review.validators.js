const { z } = require("zod");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  product: z.string().trim().regex(OBJECT_ID_RE, "product must be a valid id").optional(),
});

module.exports = { listReviewsQuerySchema };
