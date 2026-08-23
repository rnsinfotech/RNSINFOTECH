const { Router } = require("express");
const validateParam = require("../middleware/validateParam");
const websiteController = require("../controllers/website.controller");
const requireAdmin = require("../middleware/requireAdmin");
const validate = require("../middleware/validate");
const validateParamPattern = require("../middleware/validateParamPattern");
const { websitePayloadSchema } = require("../validators/website.validators");

const router = Router();
const requirePermission = require("../middleware/requirePermission");
const { sensitiveRateLimit } = require("../middleware/rateLimit");

router.use(requireAdmin);
router.get("/", websiteController.get);
router.get("/preview", websiteController.preview);
router.post("/publish", sensitiveRateLimit, requirePermission("website.write"), websiteController.publish);
router.patch("/:section", validateParamPattern("section", /^(hero|promo|whyChooseUs|solutions|testimonials)$/), requirePermission("website.write"), validate(websitePayloadSchema), websiteController.updateSection);
router.post("/:section/items", validateParamPattern("section", /^(whyChooseUs|solutions|testimonials)$/), requirePermission("website.write"), validate(websitePayloadSchema), websiteController.createItem);
router.patch("/:section/items/:id", validateParamPattern("section", /^(whyChooseUs|solutions|testimonials)$/), validateParam("id"), requirePermission("website.write"), validate(websitePayloadSchema), websiteController.updateItem);
router.delete("/:section/items/:id", validateParam("id"), requirePermission("website.write"), websiteController.deleteItem);
module.exports = router;
