const { Router } = require("express");
const validateParam = require("../middleware/validateParam");
const brandController = require("../controllers/brand.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const { createBrandSchema, updateBrandSchema, listBrandQuerySchema } = require("../validators/brand.validators");

const router = Router();
const requirePermission = require("../middleware/requirePermission");

router.use(requireAdmin);
router.get("/", validate(listBrandQuerySchema, "query"), brandController.list);
router.get("/:id", validateParam("id"), brandController.getById);
router.post("/", requirePermission("catalog.write"), validate(createBrandSchema), brandController.create);
router.patch("/:id", validateParam("id"), requirePermission("catalog.write"), validate(updateBrandSchema), brandController.update);
router.delete("/:id", validateParam("id"), requirePermission("catalog.write"), brandController.remove);
module.exports = router;
