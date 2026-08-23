const { Router } = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const catalogRoutes = require("./catalog.routes");
const orderRoutes = require("./order.routes");
const checkoutRoutes = require("./checkout.routes");
const paymentRoutes = require("./payment.routes");
const addressRoutes = require("./address.routes");
const contentRoutes = require("./content.routes");
const couponRoutes = require("./coupon.routes");
const reviewRoutes = require("./review.routes");
const chatRoutes = require("./chat.routes");
const leadRoutes = require("./lead.routes");

// Every future phase adds one line here (e.g. `router.use("/products",
// productRoutes)`) instead of mounting routes directly in server.js, so
// server.js stays a pure bootstrap file. Exception: the Razorpay webhook,
// which is mounted directly in app.js — see payment.routes.js.
const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/", catalogRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/addresses", addressRoutes);
router.use("/coupons", couponRoutes);
router.use("/", contentRoutes);
router.use("/products", reviewRoutes);
router.use("/chat", chatRoutes);
router.use("/leads", leadRoutes);

module.exports = router;
