const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { rating: -1 },
  name: { name: 1 },
};

// GET /api/categories — public, always isActive: true only. No pagination:
// the storefront nav renders every active category at once, and category
// counts stay small enough that this never needs it.
const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
  res.json({ items: categories });
});

// GET /api/categories/:slug — public
const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!category) throw ApiError.notFound("Category not found.");
  res.json({ category });
});

// discountPercent is a Mongoose virtual on Product — .lean() (used below
// for read-only public queries) skips virtuals, so it's computed here
// instead to keep the response shape identical.
function withDiscountPercent(product) {
  if (!product) return product;
  const discountPercent = product.mrp && product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  return { ...product, discountPercent };
}

// GET /api/products — public list/filter/sort/paginate/search
const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, search, category, minPrice, maxPrice, featured, sort } = req.query;
  const filter = { isActive: true };

  if (category) {
    // Accept either a category slug or its id, since both the storefront
    // nav (slug-based URLs) and a "same category" product-detail widget
    // (id already in hand) need to filter by category.
    const categoryFilter = category.match(/^[a-f0-9]{24}$/i) ? { _id: category } : { slug: category };
    const matchedCategory = await Category.findOne({ ...categoryFilter, isActive: true }).select("_id");
    // No matching category → empty result set, not a 404: a stale/typo'd
    // category filter in the URL should just show zero products, not
    // break the whole product listing page.
    filter.category = matchedCategory ? matchedCategory._id : null;
  }
  if (typeof featured === "boolean") filter.isFeatured = featured;
  if (minPrice != null || maxPrice != null) {
    filter.price = {};
    if (minPrice != null) filter.price.$gte = minPrice;
    if (maxPrice != null) filter.price.$lte = maxPrice;
  }
  if (search) filter.$text = { $search: search };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(SORT_OPTIONS[sort] || SORT_OPTIONS.newest)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({ items: items.map(withDiscountPercent), page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /api/products/:slug — public detail
// Accepts either the human-readable slug or a Mongo ObjectId in the same
// param: several frontend call sites (cart, orders, compare) only ever
// carry the product's _id, not its slug, so both need to resolve here.
const getProductBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const lookup = mongoose.Types.ObjectId.isValid(slug) ? { _id: slug } : { slug };
  const product = await Product.findOne({ ...lookup, isActive: true }).populate("category", "name slug").lean();
  if (!product) throw ApiError.notFound("Product not found.");
  res.json({ product: withDiscountPercent(product) });
});

// Cap on each homepage rail. Kept small and fixed (no query param) since
// this endpoint's whole point is "one request, four ready-made lists" for
// the storefront homepage — not a general-purpose paginated feed.
const HOMEPAGE_RAIL_LIMIT = 8;

// GET /api/homepage-products — public, single-call homepage data source.
// Replaces the old flow (frontend fetching one featured=true page of
// /api/products and re-slicing that same array three ways client-side —
// see HomePage.jsx Phase 5 for the consuming change). Every rail is
// isActive: true only.
//   - featured / bestSellers: admin-curated (isFeatured/isBestSeller flags
//     set in admin-backend), ordered by the matching homepage*Order field.
//   - newArrivals: fully automatic, newest createdAt first.
//   - discounted: fully automatic, computed from mrp vs price (no stored
//     flag), via aggregation since sorting needs the computed value.
//     Sorted by discount PERCENT rather than raw ₹ amount — a ₹200-off
//     ₹500 item outranks a ₹200-off ₹20,000 item, which reads as a better
//     "deal" to a browsing customer. (Design call — flag if raw amount is
//     preferred instead.)
const getHomepageProducts = asyncHandler(async (req, res) => {
  const [featured, bestSellers, newArrivals, discounted] = await Promise.all([
    Product.find({ isActive: true, isFeatured: true })
      .populate("category", "name slug")
      .sort({ homepageFeaturedOrder: 1 })
      .limit(HOMEPAGE_RAIL_LIMIT)
      .lean(),
    Product.find({ isActive: true, isBestSeller: true })
      .populate("category", "name slug")
      .sort({ homepageBestSellerOrder: 1 })
      .limit(HOMEPAGE_RAIL_LIMIT)
      .lean(),
    Product.find({ isActive: true })
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .limit(HOMEPAGE_RAIL_LIMIT)
      .lean(),
    Product.aggregate([
      { $match: { isActive: true, $expr: { $gt: ["$mrp", "$price"] } } },
      {
        $addFields: {
          discountPercent: {
            $round: [{ $multiply: [{ $divide: [{ $subtract: ["$mrp", "$price"] }, "$mrp"] }, 100] }, 0],
          },
        },
      },
      { $sort: { discountPercent: -1 } },
      { $limit: HOMEPAGE_RAIL_LIMIT },
      { $lookup: { from: "categories", localField: "category", foreignField: "_id", as: "category" } },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: 1,
          slug: 1,
          sku: 1,
          brand: 1,
          productType: 1,
          shortDescription: 1,
          images: 1,
          price: 1,
          mrp: 1,
          stock: 1,
          rating: 1,
          reviewCount: 1,
          isFeatured: 1,
          isBestSeller: 1,
          discountPercent: 1,
          createdAt: 1,
          "category._id": 1,
          "category.name": 1,
          "category.slug": 1,
        },
      },
    ]),
  ]);

  res.json({
    featured: featured.map(withDiscountPercent),
    bestSellers: bestSellers.map(withDiscountPercent),
    newArrivals: newArrivals.map(withDiscountPercent),
    // Already carries a computed discountPercent from the pipeline —
    // withDiscountPercent would just recompute the same number, so skip it.
    discounted,
  });
});

module.exports = { listCategories, getCategoryBySlug, listProducts, getProductBySlug, getHomepageProducts };
