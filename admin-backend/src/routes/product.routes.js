const { Router } = require("express");
const validateParam = require("../middleware/validateParam");
const productController = require("../controllers/product.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const upload = require("../middleware/upload");
const { createProductSchema, updateProductSchema, listQuerySchema, bulkActionSchema } = require("../validators/product.validators");

const router = Router();
const requirePermission = require("../middleware/requirePermission");
const { sensitiveRateLimit } = require("../middleware/rateLimit");

router.use(requireAdmin);

router.get("/", validate(listQuerySchema, "query"), productController.list);
router.post("/bulk", sensitiveRateLimit, requirePermission("catalog.write"), validate(bulkActionSchema), productController.bulkAction);
router.get("/:id", validateParam("id"), productController.getById);
router.post("/", requirePermission("catalog.write"), validate(createProductSchema), productController.create);
router.patch("/:id", validateParam("id"), requirePermission("catalog.write"), validate(updateProductSchema), productController.update);
router.delete("/:id", validateParam("id"), requirePermission("catalog.write"), productController.remove);
router.post("/:id/images", validateParam("id"), requirePermission("catalog.write"), upload.array("images", 6), productController.addImages);
router.patch("/:id/images/:imageId", validateParam("imageId"), validateParam("id"), requirePermission("catalog.write"), upload.single("image"), productController.replaceImage);
router.delete("/:id/images/:imageId", validateParam("imageId"), validateParam("id"), requirePermission("catalog.write"), productController.removeImage);

module.exports = router;
