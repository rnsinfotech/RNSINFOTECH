const { Router } = require("express");
const authController = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const { loginSchema, refreshSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require("../validators/auth.validators");
const { authRateLimit, sensitiveRateLimit } = require("../middleware/rateLimit");

const router = Router();
router.post("/login", authRateLimit, validate(loginSchema), authController.login);
router.post("/refresh", authRateLimit, validate(refreshSchema), authController.refresh);
router.post("/forgot-password", authRateLimit, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", sensitiveRateLimit, validate(resetPasswordSchema), authController.resetPassword);
router.post("/change-password", requireAdmin, sensitiveRateLimit, validate(changePasswordSchema), authController.changePassword);
router.post("/logout", requireAdmin, authController.logout);
router.get("/me", requireAdmin, authController.me);
module.exports = router;
