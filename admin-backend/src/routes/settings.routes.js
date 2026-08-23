const { Router } = require("express");

const settingsController = require("../controllers/settings.controller");
const requireAdmin = require("../middleware/requireAdmin");

const router = Router();

const requirePermission = require("../middleware/requirePermission");
const validate = require("../middleware/validate");
const { updateStoreProfileSchema, updateCommerceSchema, updateAccountSchema } = require("../validators/settings.validators");

router.use(requireAdmin);
router.get("/store-profile", settingsController.getStoreProfile);
router.patch("/store-profile", requirePermission("settings.write"), validate(updateStoreProfileSchema), settingsController.updateStoreProfile);
router.get("/commerce", settingsController.getCommerce);
router.patch("/commerce", requirePermission("settings.write"), validate(updateCommerceSchema), settingsController.updateCommerce);
router.get("/account", settingsController.getAccount);
router.patch("/account", validate(updateAccountSchema), settingsController.updateAccount);

module.exports = router;
