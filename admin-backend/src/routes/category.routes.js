const { Router } = require("express");
const validateParam = require("../middleware/validateParam");

const categoryController = require("../controllers/category.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const upload = require("../middleware/upload");
const {
  createCategorySchema,
  updateCategorySchema,
  listQuerySchema,
} = require("../validators/category.validators");

const router = Router();

// Every route in this service is staff-only (see HANDOFF.md) — no public
// route category here at all, unlike storefront-backend.
const requirePermission = require("../middleware/requirePermission");

router.use(requireAdmin);

router.get("/", validate(listQuerySchema, "query"), categoryController.list);
router.get("/:id", validateParam("id"), categoryController.getById);
router.post("/", requirePermission("catalog.write"), validate(createCategorySchema), categoryController.create);
router.patch("/:id", validateParam("id"), requirePermission("catalog.write"), validate(updateCategorySchema), categoryController.update);
router.delete("/:id", validateParam("id"), requirePermission("catalog.write"), categoryController.remove);
router.post("/:id/image", validateParam("id"), requirePermission("catalog.write"), upload.single("image"), categoryController.setImage);

module.exports = router;
