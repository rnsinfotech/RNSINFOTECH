const { Router } = require("express");

const couponController = require("../controllers/coupon.controller");
const validate = require("../middleware/validate");
const { validateCouponSchema } = require("../validators/coupon.validators");

const router = Router();

router.post("/validate", validate(validateCouponSchema), couponController.validateCoupon);

module.exports = router;
