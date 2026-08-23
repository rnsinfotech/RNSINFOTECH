const { Router } = require("express");

const reviewController = require("../controllers/review.controller");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/requireAuth");
const validateParam = require("../middleware/validateParam");
const { createReviewSchema, listReviewsQuerySchema } = require("../validators/review.validators");

const router = Router();

// Only submitting a review requires a signed-in shopper — listing
// reviews is public (any visitor viewing a product page should see
// them), so requireAuth is scoped to the POST route only, not the
// whole router.
router.post("/:productId/reviews", requireAuth, validateParam("productId"), validate(createReviewSchema), reviewController.create);
router.get("/:productId/reviews", validateParam("productId"), validate(listReviewsQuerySchema, "query"), reviewController.listByProduct);
router.get("/:productId/reviews/eligibility", requireAuth, validateParam("productId"), reviewController.eligibility);

module.exports = router;
