const { Router } = require("express");
const validateParam = require("../middleware/validateParam");

const reviewController = require("../controllers/review.controller");
const validate = require("../middleware/validate");
const requireAdmin = require("../middleware/requireAdmin");
const { listReviewsQuerySchema } = require("../validators/review.validators");

const router = Router();

const requirePermission = require("../middleware/requirePermission");

router.use(requireAdmin);

// Reviews go live the moment a shopper submits them (no moderation
// queue), so the admin side is read + delete only — see review.controller.js.
router.get("/stats", reviewController.stats);
router.get("/", validate(listReviewsQuerySchema, "query"), reviewController.list);
router.get("/:id", validateParam("id"), reviewController.getById);
router.delete("/:id", validateParam("id"), requirePermission("reviews.write"), reviewController.remove);

module.exports = router;
