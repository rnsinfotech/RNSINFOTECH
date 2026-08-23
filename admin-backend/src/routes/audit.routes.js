const { Router } = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const requirePermission = require("../middleware/requirePermission");
const validate = require("../middleware/validate");
const auditController = require("../controllers/audit.controller");

const router = Router();
router.use(requireAdmin, requirePermission("audit.read"));
router.get("/", validate({ safeParse: (value) => ({ success: true, data: value || {} }) }, "query"), auditController.list);
module.exports = router;
