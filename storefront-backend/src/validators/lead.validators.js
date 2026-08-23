const { z } = require("zod");

const createLeadSchema = z.object({
  type: z.enum(["newsletter", "demo", "contact", "quote"]),
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional().default(""),
  company: z.string().trim().max(150).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  // Anything else the specific form wants to send along (interest, mode,
  // preferredDate, product, quantity, etc.) - kept unstructured on purpose
  // since it varies per form and isn't queried on, only displayed in admin.
  meta: z.record(z.string(), z.any()).optional().default({}),
});

module.exports = { createLeadSchema };
