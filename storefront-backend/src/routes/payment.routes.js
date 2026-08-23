const { Router } = require("express");

const paymentController = require("../controllers/payment.controller");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const { createPaymentOrderSchema, verifyPaymentSchema } = require("../validators/payment.validators");
const { paymentRateLimit, sensitiveRateLimit } = require("../middleware/rateLimit");
const validateParam = require("../middleware/validateParam");

const router = Router();

// The webhook route is NOT here — Razorpay needs raw-body access for its
// HMAC check, and calls it with no user session at all, so it's mounted
// directly in app.js at /api/payments/webhook, ahead of the global JSON
// parser and outside this requireAuth block. See app.js and
// payment.controller.js's webhook handler for why.
router.use(requireAuth);

router.post("/create-order", paymentRateLimit, validate(createPaymentOrderSchema), paymentController.createPaymentOrder);
router.post("/verify", paymentRateLimit, validate(verifyPaymentSchema), paymentController.verifyPayment);
router.get("/order/:orderId", sensitiveRateLimit, validateParam("orderId"), paymentController.listPaymentsForOrder);

module.exports = router;
