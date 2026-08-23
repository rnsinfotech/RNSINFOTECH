const { Router } = require("express");

const inventoryController = require("../controllers/inventory.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const { adjustInventorySchema, listInventoryQuerySchema } = require("../validators/inventory.validators");

const router = Router();

const requirePermission = require("../middleware/requirePermission");
const { sensitiveRateLimit } = require("../middleware/rateLimit");

router.use(requireAdmin);
router.get("/stats", inventoryController.getStats);
router.get("/adjustments", validate(listInventoryQuerySchema, "query"), inventoryController.listAdjustments);
router.post("/adjustments", sensitiveRateLimit, requirePermission("inventory.write"), validate(adjustInventorySchema), inventoryController.createAdjustment);

module.exports = router;
