const { z } = require("zod");

const base = {
  type: z.enum(["login", "sale", "newsletter", "custom"]).optional().default("custom"),
  message: z.string().trim().min(1).max(500),
  ctaLabel: z.string().trim().max(100).optional().default(""),
  ctaHref: z.string().trim().max(500).optional().default(""),
  active: z.coerce.boolean().optional().default(true),
  durationSeconds: z.coerce.number().int().min(1).max(120).optional().default(5),
};
const createFlashMessageSchema = z.object(base);
const updateFlashMessageSchema = z.object(base).partial();
const reorderFlashMessagesSchema = z.object({ orderedIds: z.array(z.string().min(1)).min(0).max(500) });
module.exports = { createFlashMessageSchema, updateFlashMessageSchema, reorderFlashMessagesSchema };
