const { Router } = require("express");
const healthRoutes = require("./health.routes");
const authRoutes = require("./auth.routes");
const categoryRoutes = require("./category.routes");
const productRoutes = require("./product.routes");
const orderRoutes = require("./order.routes");
const paymentRoutes = require("./payment.routes");
const customerRoutes = require("./customer.routes");
const contentRoutes = require("./content.routes");
const couponRoutes = require("./coupon.routes");
const reviewRoutes = require("./review.routes");
const leadRoutes = require("./lead.routes");
const chatRoutes = require("./chat.routes");
const inventoryRoutes = require("./inventory.routes");
const dashboardRoutes = require("./dashboard.routes");
const staffRoutes = require("./staff.routes");
const settingsRoutes = require("./settings.routes");
const brandRoutes = require("./brand.routes");
const websiteRoutes = require("./website.routes");
const flashMessageRoutes = require("./flashMessage.routes");
const auditRoutes = require("./audit.routes");

// Every future phase adds one line here (e.g. `router.use("/products",
// productRoutes)`) instead of mounting routes directly in server.js, so
// server.js stays a pure bootstrap file.
const router = Router();

router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);
router.use("/payments", paymentRoutes);
router.use("/customers", customerRoutes);
router.use("/coupons", couponRoutes);
router.use("/", contentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/leads", leadRoutes);
router.use("/chat", chatRoutes);
router.use("/inventory", inventoryRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/staff", staffRoutes);
router.use("/settings", settingsRoutes);
router.use("/brands", brandRoutes);
router.use("/website", websiteRoutes);
router.use("/flash-messages", flashMessageRoutes);
router.use("/audit-logs", auditRoutes);

module.exports = router;
