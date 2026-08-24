const { z } = require("zod");

const requestOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  intent: z.enum(["login", "signup"]).optional(),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Code must be 6 digits."),
  // Only used the first time a given email verifies (i.e. account creation);
  // ignored on subsequent logins where the user already has a name.
  name: z.string().trim().min(1).max(100).optional(),
  // Which flow the code came from — the Login page vs the Signup page.
  // Defaults to "login" (the safer default: don't silently create an
  // account for someone who only meant to log in). See verifyOtp in
  // auth.controller.js for how this gates account creation.
  intent: z.enum(["login", "signup"]).optional().default("login"),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10, "refreshToken is required."),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Enter a valid 10-digit phone number.")
    .optional(),
});

module.exports = { requestOtpSchema, verifyOtpSchema, refreshSchema, updateMeSchema };