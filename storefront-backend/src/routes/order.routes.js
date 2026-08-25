const { Router } = require("express");

const orderController = require("../controllers/order.controller");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const validateParam = require("../middleware/validateParam");
const { placeOrderSchema, listMyOrdersQuerySchema } = require("../validators/order.validators");

const router = Router();

// Every route here requires a logged-in customer — unlike catalog.routes.js,
// an order always belongs to somebody.
router.use(requireAuth);

router.post("/", validate(placeOrderSchema), orderController.placeOrder);
router.get("/", validate(listMyOrdersQuerySchema, "query"), orderController.listMyOrders);
// The old auto-generated GST invoice endpoint has been retired — bills
// are now uploaded manually by admin (see admin-backend's order.controller
// ship/uploadBill) and served directly via Order.billUrl on the order
// object itself, no separate endpoint needed. getMyInvoice/invoice.service.js
// are left in place, unused, in case this needs to be revisited later.
router.get("/:id", validateParam("id"), orderController.getMyOrderById);

module.exports = router;
