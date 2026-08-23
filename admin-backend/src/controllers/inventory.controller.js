const Product = require("../models/Product");
const { adjustProductStock } = require("../services/inventory.service");
const InventoryLog = require("../models/InventoryLog");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const LOW_STOCK_THRESHOLD = 5;

function calculateStockState(stock) {
  if (stock <= 0) return "out-of-stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}

const getStats = asyncHandler(async (req, res) => {
  const products = await Product.find({});

  const stats = products.reduce(
    (acc, product) => {
      const stockState = calculateStockState(Number(product.stock || 0));
      acc.total += 1;
      if (stockState === "in-stock") acc.inStock += 1;
      if (stockState === "low-stock") acc.lowStock += 1;
      if (stockState === "out-of-stock") acc.outOfStock += 1;
      return acc;
    },
    { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 }
  );

  res.json(stats);
});

const createAdjustment = asyncHandler(async (req, res) => {
  const delta = Number(req.body.delta || 0);
  if (!delta) throw ApiError.badRequest("delta must not be zero.");
  const reason = String(req.body.reason || "").trim() || (delta > 0 ? "Restock" : "Adjustment");
  const product = await adjustProductStock(req.body.productId, delta, { actorId: req.admin?._id || null, actorName: req.admin?.name || null, actorEmail: req.admin?.email || null, actorType: "admin", action: "adjustment", reason });
  const entry = await InventoryLog.findOne({ product: product._id }).sort({ createdAt: -1 });
  res.status(201).json({ product, entry });
});

const listAdjustments = asyncHandler(async (req, res) => {
  const { page, limit, productId, search } = req.query;
  const filter = {};

  if (productId) filter.product = productId;
  if (search) {
    filter.$or = [
      { productName: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
      { reason: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    InventoryLog.find(filter)
      .populate("product", "name sku")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    InventoryLog.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

module.exports = { getStats, createAdjustment, listAdjustments };
