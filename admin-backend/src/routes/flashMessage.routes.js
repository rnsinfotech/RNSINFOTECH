const { Router } = require("express");
const validateParam = require("../middleware/validateParam");
const controller = require("../controllers/flashMessage.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const { createFlashMessageSchema, updateFlashMessageSchema, reorderFlashMessagesSchema } = require("../validators/flashMessage.validators");

const router = Router();
const requirePermission = require("../middleware/requirePermission");

router.use(requireAdmin);
router.get("/", controller.list);
router.post("/", requirePermission("website.write"), validate(createFlashMessageSchema), controller.create);
router.patch("/reorder", requirePermission("website.write"), validate(reorderFlashMessagesSchema), controller.reorder);
router.patch("/:id", validateParam("id"), requirePermission("website.write"), validate(updateFlashMessageSchema), controller.update);
router.delete("/:id", validateParam("id"), requirePermission("website.write"), controller.remove);
module.exports = router;
