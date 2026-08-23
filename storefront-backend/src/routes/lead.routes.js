const { Router } = require("express");

const leadController = require("../controllers/lead.controller");
const validate = require("../middleware/validate");
const { sensitiveRateLimit } = require("../middleware/rateLimit");
const { createLeadSchema } = require("../validators/lead.validators");

const router = Router();

// Public, unauthenticated - anyone can submit the newsletter/demo/contact/
// quote forms without an account. Rate-limited (same tier as other
// public-write endpoints) so this can't be used to spam the notification
// inbox or fill the Lead collection.
router.post("/", sensitiveRateLimit, validate(createLeadSchema), leadController.create);

module.exports = router;
