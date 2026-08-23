const { z } = require("zod");

// Same address-field shape as order.validators.js's shippingAddressInputSchema
// (kept deliberately consistent, since a saved address and a one-off
// shipping address on an order are the same real-world thing), plus
// `label` and `isDefault` which only make sense for a saved, reusable
// address — an order's shippingAddress snapshot never needs either.
const createAddressSchema = z.object({
  label: z.string().trim().min(1).max(40).optional().default("Home"),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().min(3).max(12),
  gstin: z.string().trim().max(15).optional().default(""),
  country: z.string().trim().min(2).max(100).optional().default("India"),
  isDefault: z.coerce.boolean().optional().default(false),
});

// Every field optional on update, same convention as
// category.validators.js's updateCategorySchema — the controller only
// touches what's actually present in the (already-parsed) body.
const updateAddressSchema = createAddressSchema.partial();

module.exports = { createAddressSchema, updateAddressSchema };
