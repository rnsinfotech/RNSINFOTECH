const { z } = require("zod");
const objectPayload = z.record(z.string(), z.any());
const updateStoreProfileSchema = objectPayload;
const updateCommerceSchema = objectPayload;
const updateAccountSchema = z.object({ name: z.string().trim().min(1).max(120).optional(), email: z.string().trim().toLowerCase().email().optional() });
module.exports = { updateStoreProfileSchema, updateCommerceSchema, updateAccountSchema };
