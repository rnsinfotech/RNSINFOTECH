const { Router } = require("express");

const addressController = require("../controllers/address.controller");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const validateParam = require("../middleware/validateParam");
const { createAddressSchema, updateAddressSchema } = require("../validators/address.validators");

const router = Router();

// Every route here requires a logged-in customer — same rule as
// order.routes.js, an address always belongs to somebody.
router.use(requireAuth);

router.get("/", addressController.list);
router.get("/:id", validateParam("id"), addressController.getById);
router.post("/", validate(createAddressSchema), addressController.create);
router.patch("/:id", validateParam("id"), validate(updateAddressSchema), addressController.update);
router.delete("/:id", validateParam("id"), addressController.remove);

module.exports = router;
