const { z } = require("zod");

const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(50),
  orderTotal: z.coerce.number().min(0),
});

module.exports = { validateCouponSchema };
