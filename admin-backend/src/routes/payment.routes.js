const { Router } = require("express");

const paymentController = require("../controllers/payment.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const requireRole = require("../middleware/requireRole");
const { listPaymentsQuerySchema, refundPaymentSchema } = require("../validators/payment.validators");
const { sensitiveRateLimit } = require("../middleware/rateLimit");
const validateParam = require("../middleware/validateParam");

const router = Router();

router.use(requireAdmin);

router.get("/", validate(listPaymentsQuerySchema, "query"), paymentController.list);
router.get("/:id", validateParam("id"), paymentController.getById);
// Refunds are gated one level stricter than the rest of this router —
// Owner/Manager only, not every Staff account — since this is a
// financial action with no undo.
router.post(
  "/:id/refund",
  validateParam("id"),
  sensitiveRateLimit,
  requireRole("Owner", "Manager"),
  validate(refundPaymentSchema),
  paymentController.refund
);

module.exports = router;
