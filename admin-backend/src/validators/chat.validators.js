const { z } = require("zod");
const adminChatMessageSchema = z.object({ text: z.string().trim().min(1).max(5000), clientMessageId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,120}$/).nullable().optional() });
const chatQuerySchema = z.object({ q: z.string().trim().max(200).optional() });
module.exports = { adminChatMessageSchema, chatQuerySchema };
