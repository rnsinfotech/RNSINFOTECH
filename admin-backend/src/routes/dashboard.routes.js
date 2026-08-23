const { Router } = require("express");

const dashboardController = require("../controllers/dashboard.controller");
const requireAdmin = require("../middleware/requireAdmin");

const router = Router();

router.use(requireAdmin);
router.get("/summary", dashboardController.getDashboardSummary);

module.exports = router;
