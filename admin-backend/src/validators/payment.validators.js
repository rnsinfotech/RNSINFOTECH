const { z } = require("zod");

const listPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["created", "paid", "failed", "expired", "refunded"]).optional(),
  order: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{24}$/i, "order must be a valid id")
    .optional(),
});

// Refund amount is optional — omitting it means "refund the full amount",
// which the controller resolves against the Payment's own `amount`
// rather than trusting a client-supplied full-amount figure either.
const refundPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().trim().max(300).optional(),
});

module.exports = { listPaymentsQuerySchema, refundPaymentSchema };
