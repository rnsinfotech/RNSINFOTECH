const { Router } = require("express");
const validateParam = require("../middleware/validateParam");

const customerController = require("../controllers/customer.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const { listCustomersQuerySchema } = require("../validators/customer.validators");

const router = Router();

// Read-only for every staff role — viewing the customer list/detail isn't
// gated further the way refunds (payment.routes.js) are, since nothing on
// this router ever mutates a `users`, `orders`, or `addresses` document.
router.use(requireAdmin);

router.get("/", validate(listCustomersQuerySchema, "query"), customerController.list);
router.get("/:id", validateParam("id"), customerController.getById);

module.exports = router;
