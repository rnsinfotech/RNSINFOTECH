const { Router } = require("express");
const staffController = require("../controllers/staff.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const requirePermission = require("../middleware/requirePermission");
const { sensitiveRateLimit } = require("../middleware/rateLimit");
const { listStaffQuerySchema, createStaffSchema, inviteStaffSchema, acceptInvitationSchema } = require("../validators/staff.validators");

const router = Router();
router.post("/invitations/accept", validate(acceptInvitationSchema), staffController.acceptInvitation);
router.use(requireAdmin, requirePermission("staff.manage"));
router.get("/", validate(listStaffQuerySchema, "query"), staffController.list);
router.post("/", validate(createStaffSchema), staffController.create);
router.post("/invitations", sensitiveRateLimit, validate(inviteStaffSchema), staffController.invite);
module.exports = router;
