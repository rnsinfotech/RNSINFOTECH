const { z } = require("zod");

const couponCodePattern = /^[A-Z0-9-]+$/;

const createCouponSchema = z.object({
  code: z.string().trim().min(2).max(50).refine((value) => couponCodePattern.test(value.toUpperCase()), {
    message: "code may only contain uppercase letters, numbers, and hyphens",
  }),
  description: z.string().trim().max(500).optional().default(""),
  type: z.enum(["percent", "fixed"]).default("percent"),
  value: z.coerce.number().min(0).max(1000000),
  minOrderValue: z.coerce.number().min(0).optional().default(0),
  usageLimit: z.coerce.number().int().min(0).optional().default(0),
  expiresAt: z.coerce.date().optional().nullable().default(null),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  allowedUsers: z.array(z.string().trim()).optional().default([]),
  maxUsesPerUser: z.coerce.number().int().min(0).optional().default(0),
});

const updateCouponSchema = createCouponSchema.partial();

const listCouponQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

module.exports = { createCouponSchema, updateCouponSchema, listCouponQuerySchema };
