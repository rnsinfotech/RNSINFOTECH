const { Router } = require("express");
const validateParam = require("../middleware/validateParam");

const leadController = require("../controllers/lead.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const requirePermission = require("../middleware/requirePermission");
const { listLeadsQuerySchema, setLeadStatusSchema } = require("../validators/lead.validators");

const router = Router();

router.use(requireAdmin);

router.get("/stats", leadController.stats);
router.get("/", validate(listLeadsQuerySchema, "query"), leadController.list);
router.get("/:id", validateParam("id"), leadController.getById);
router.patch("/:id/status", validateParam("id"), requirePermission("leads.write"), validate(setLeadStatusSchema), leadController.updateStatus);
router.delete("/:id", validateParam("id"), requirePermission("leads.write"), leadController.remove);

module.exports = router;
