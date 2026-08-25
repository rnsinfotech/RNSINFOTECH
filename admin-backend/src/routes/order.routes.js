const { Router } = require("express");
const validateParam = require("../middleware/validateParam");

const orderController = require("../controllers/order.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const upload = require("../middleware/upload");
const { listOrdersQuerySchema, shipOrderSchema, cancelOrderSchema } = require("../validators/order.validators");

const router = Router();

// Every route in this service is staff-only, per this project's convention
// (see HANDOFF.md) — no public route here at all, unlike storefront-backend.
const requirePermission = require("../middleware/requirePermission");
const { sensitiveRateLimit } = require("../middleware/rateLimit");

router.use(requireAdmin);

router.get("/", validate(listOrdersQuerySchema, "query"), orderController.list);
router.get("/:id", validateParam("id"), orderController.getById);
router.post("/:id/confirm", sensitiveRateLimit, validateParam("id"), requirePermission("orders.write"), orderController.confirm);
// multer (upload.bill) must run before validate() here — it's what
// parses the multipart body into req.body in the first place, since the
// ship form can now optionally carry a bill file alongside courierName
// and trackingId.
router.post(
  "/:id/ship",
  sensitiveRateLimit,
  validateParam("id"),
  requirePermission("orders.write"),
  upload.bill("bill"),
  validate(shipOrderSchema),
  orderController.ship
);
router.post("/:id/bill", sensitiveRateLimit, validateParam("id"), requirePermission("orders.write"), upload.bill("bill"), orderController.uploadBill);
router.post("/:id/cancel", sensitiveRateLimit, validateParam("id"), requirePermission("orders.write"), validate(cancelOrderSchema), orderController.cancel);

module.exports = router;
