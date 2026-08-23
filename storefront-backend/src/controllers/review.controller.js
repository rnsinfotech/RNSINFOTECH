const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Reviews go live immediately — there's no moderation queue, so a
// product's rating/reviewCount is just the aggregate over every review
// it has (see admin-backend's mirror of this in review.controller.js,
// which only adds the ability to delete a review, not approve one).
async function updateProductRating(productId) {
  const reviews = (await Review.find({ product: productId })) || [];
  const reviewCount = Array.isArray(reviews) ? reviews.length : 0;
  const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1));

  await Product.findByIdAndUpdate(productId, { rating, reviewCount });
}

const create = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound("Product not found.");

  const existing = await Review.findOne({ product: productId, user: req.auth.userId });
  if (existing) {
    throw ApiError.conflict("You have already reviewed this product.");
  }

  // Verified-purchase gate: only someone who has actually received this
  // product can review it — matches the "Write a review" link that only
  // appears on shipped orders in OrdersPage/OrderDetailPage. Checking
  // status: "shipped" (rather than just "any order exists") means a
  // pending/confirmed-but-not-yet-delivered order doesn't unlock reviewing.
  const purchase = await Order.findOne({
    user: req.auth.userId,
    status: "shipped",
    "items.product": productId,
  });
  if (!purchase) {
    throw ApiError.forbidden("You can only review products from a delivered order.");
  }

  const review = await Review.create({
    product: productId,
    user: req.auth.userId,
    rating: req.body.rating,
    comment: req.body.comment || "",
  });
  await updateProductRating(productId);
  if (typeof review.populate === "function") await review.populate("user", "name");

  res.status(201).json({ review });
});

const listByProduct = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page, limit } = req.query;

  // Public and unfiltered — every review shows here, and only the
  // reviewer's name is populated (never email or anything else).
  const [items, total] = await Promise.all([
    Review.find({ product: productId })
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Review.countDocuments({ product: productId }),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

// Lets the storefront decide up front whether to show the review form
// (vs. "buy it and get it delivered first" / "you've already reviewed
// this") instead of only finding out after the shopper writes a review
// and hits submit. Mirrors the same checks `create` enforces server-side.
const eligibility = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const [alreadyReviewed, purchase] = await Promise.all([
    Review.exists({ product: productId, user: req.auth.userId }),
    Order.exists({ user: req.auth.userId, status: "shipped", "items.product": productId }),
  ]);

  if (alreadyReviewed) {
    return res.json({ canReview: false, reason: "already_reviewed" });
  }
  if (!purchase) {
    return res.json({ canReview: false, reason: "not_purchased" });
  }
  res.json({ canReview: true, reason: null });
});

module.exports = { create, listByProduct, eligibility, updateProductRating };
