const { z } = require("zod");
const createStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["Owner", "Manager", "Staff"]).default("Staff"),
});
const inviteStaffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  role: z.enum(["Owner", "Manager", "Staff"]).default("Staff"),
});
const acceptInvitationSchema = z.object({
  token: z.string().min(32),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(120).optional(),
});
const listStaffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
  role: z.enum(["Owner", "Manager", "Staff"]).optional(),
});
module.exports = { createStaffSchema, inviteStaffSchema, acceptInvitationSchema, listStaffQuerySchema };
