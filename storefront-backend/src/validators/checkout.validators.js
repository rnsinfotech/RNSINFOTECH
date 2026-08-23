const { z } = require("zod");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const checkoutItemSchema = z.object({
  product: z.string().trim().regex(OBJECT_ID_RE, "product must be a valid id"),
  quantity: z.coerce.number().int().min(1).max(50),
});

const checkoutQuoteSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, "Cart cannot be empty."),
  couponCode: z.string().trim().min(1).max(50).optional(),
});

module.exports = { checkoutQuoteSchema };
