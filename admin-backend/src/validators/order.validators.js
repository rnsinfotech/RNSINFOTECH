const { z } = require("zod");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["pending", "confirmed", "shipped", "cancelled"]).optional(),
  // Order-id search only for now (no full-text index on this collection).
  // A non-id search string just resolves to zero results in the
  // controller rather than a 400 — a staff member pasting something that
  // isn't an id shouldn't break the page.
  search: z.string().trim().optional(),
});

const shipOrderSchema = z.object({
  courierName: z.string().trim().min(2).max(100),
  trackingId: z.string().trim().min(2).max(100),
});

const cancelOrderSchema = z.object({ reason: z.string().trim().max(300).optional() });

module.exports = { listOrdersQuerySchema, shipOrderSchema, cancelOrderSchema, OBJECT_ID_RE };
