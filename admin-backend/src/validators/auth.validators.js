const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
const refreshSchema = z.object({ refreshToken: z.string().min(10).optional() }).default({});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(12, "New password must be at least 12 characters.").max(128),
});
const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});
const resetPasswordSchema = z.object({
  token: z.string().min(32, "Reset token is required."),
  newPassword: z.string().min(12, "New password must be at least 12 characters.").max(128),
});
module.exports = { loginSchema, refreshSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };
