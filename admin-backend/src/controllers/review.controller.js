const Review = require("../models/Review");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Mirrors storefront-backend's version of this helper — every review
// counts toward the aggregate, since there's no approved/pending split
// anymore. Only used here after a delete (creation happens storefront-side).
async function recomputeProductRating(productId) {
  const reviews = (await Review.find({ product: productId })) || [];
  const reviewCount = Array.isArray(reviews) ? reviews.length : 0;
  const rating = reviewCount === 0 ? 0 : Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(1));

  await Product.findByIdAndUpdate(productId, { rating, reviewCount });
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, product } = req.query;
  const filter = {};
  if (product) filter.product = product;

  let query = Review.find(filter);
  if (typeof query.populate === "function") query = query.populate("product", "name sku");
  if (typeof query.populate === "function") query = query.populate("user", "name email");
  if (typeof query.sort === "function") query = query.sort({ createdAt: -1 });
  if (typeof query.skip === "function") query = query.skip((page - 1) * limit);
  if (typeof query.limit === "function") query = query.limit(limit);

  const [items, total] = await Promise.all([query, Review.countDocuments(filter)]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

const stats = asyncHandler(async (req, res) => {
  const [total, agg] = await Promise.all([
    Review.countDocuments({}),
    Review.aggregate([{ $group: { _id: null, avgRating: { $avg: "$rating" } } }]),
  ]);
  const averageRating = agg.length ? Number(agg[0].avgRating.toFixed(1)) : 0;
  res.json({ total, averageRating });
});

const getById = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound("Review not found.");
  res.json({ review });
});

const remove = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) throw ApiError.notFound("Review not found.");

  await review.deleteOne();
  await recomputeProductRating(review.product);
  res.status(204).send();
});

module.exports = { list, stats, getById, remove };
