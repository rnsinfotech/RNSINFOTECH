const { Router } = require("express");
const validateParam = require("../middleware/validateParam");

const couponController = require("../controllers/coupon.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const { createCouponSchema, updateCouponSchema, listCouponQuerySchema } = require("../validators/coupon.validators");

const router = Router();

const requirePermission = require("../middleware/requirePermission");

router.use(requireAdmin);

router.get("/stats", couponController.stats);
router.get("/", validate(listCouponQuerySchema, "query"), couponController.list);
router.get("/:id", validateParam("id"), couponController.getById);
router.post("/", requirePermission("coupons.write"), validate(createCouponSchema), couponController.create);
router.patch("/:id", validateParam("id"), requirePermission("coupons.write"), validate(updateCouponSchema), couponController.update);
router.delete("/:id", validateParam("id"), requirePermission("coupons.write"), couponController.remove);

module.exports = router;
