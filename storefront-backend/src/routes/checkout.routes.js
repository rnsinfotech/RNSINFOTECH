const { Router } = require("express");
const checkoutController = require("../controllers/checkout.controller");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { checkoutQuoteSchema } = require("../validators/checkout.validators");

const router = Router();

router.use(requireAuth);
router.post("/quote", validate(checkoutQuoteSchema), checkoutController.getQuote);

module.exports = router;
