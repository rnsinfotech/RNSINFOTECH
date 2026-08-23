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
router.get("/:id/invoice", validateParam("id"), orderController.getMyInvoice);
router.get("/:id", validateParam("id"), orderController.getMyOrderById);

module.exports = router;
