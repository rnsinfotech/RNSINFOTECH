const { Router } = require("express");

const authController = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { requestOtpSchema, verifyOtpSchema, refreshSchema } = require("../validators/auth.validators");
const { authRateLimit, otpRateLimit, otpVerifyRateLimit, otpDailyRateLimit } = require("../middleware/rateLimit");

const router = Router();

router.post("/request-otp", otpRateLimit, otpDailyRateLimit, validate(requestOtpSchema), authController.requestOtp);
router.post("/verify-otp", otpVerifyRateLimit, validate(verifyOtpSchema), authController.verifyOtp);
router.post("/refresh", authRateLimit, validate(refreshSchema), authController.refresh);
router.post("/logout", requireAuth, authController.logout);
router.get("/me", requireAuth, authController.me);

module.exports = router;
