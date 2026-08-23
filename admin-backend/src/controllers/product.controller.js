const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const slugify = require("../utils/slugify");
const { uploadBuffer, destroyImage } = require("../services/upload.service");

async function uniqueSlug(base, excludeId) {
  let slug = base;
  let suffix = 1;
  while (await Product.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

async function assertCategoryExists(categoryId) {
  const exists = await Category.exists({ _id: categoryId });
  if (!exists) throw ApiError.badRequest("category does not reference an existing category.");
}

function generateSku() {
  return `RNS-${Date.now().toString(36).toUpperCase()}`;
}

// Homepage curation (Phase H1/H2). isFeatured/isBestSeller each pair with
// an *Order field that controls display order within that rail; null
// means "not curated for that rail" (see the note in models/Product.js).
// The admin portal's order inputs (Phase H4) are the primary way order
// gets set going forward, but this keeps the API self-consistent even
// when only the boolean is sent:
//   - unmarking (flag -> false) always nulls the order out, regardless
//     of what was sent for the order field, since a null flag makes the
//     order meaningless.
//   - an explicit order is always respected as-is.
//   - marking a product that wasn't already curated, with no explicit
//     order, auto-assigns the next free slot (current max + 1) so it
//     never ends up flagged with a null order.
//   - re-sending the flag on an already-curated product, with no order
//     change, leaves the existing order untouched.
async function nextHomepageOrder(flagField, orderField) {
  const top = await Product.findOne({ [flagField]: true })
    .sort({ [orderField]: -1 })
    .select(orderField)
    .lean();
  const topOrder = top && typeof top[orderField] === "number" ? top[orderField] : -1;
  return topOrder + 1;
}

async function resolveHomepageCuration(body, current, flagField, orderField) {
  const flagProvided = Object.prototype.hasOwnProperty.call(body, flagField);
  const orderProvided = Object.prototype.hasOwnProperty.call(body, orderField);
  const nextFlag = flagProvided ? body[flagField] : current.flag;

  if (!nextFlag) return { flag: nextFlag, order: null };
  if (orderProvided) return { flag: true, order: body[orderField] };
  if (flagProvided && !current.flag) return { flag: true, order: await nextHomepageOrder(flagField, orderField) };
  return { flag: true, order: current.order ?? (await nextHomepageOrder(flagField, orderField)) };
}

const HOMEPAGE_RAILS = [
  ["isFeatured", "homepageFeaturedOrder"],
  ["isBestSeller", "homepageBestSellerOrder"],
];

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  rating: { rating: -1, _id: 1 },
  name: { name: 1, _id: 1 },
  stock_asc: { stock: 1, _id: 1 },
  stock_desc: { stock: -1, _id: 1 },
};

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, category, brand, stock, isActive, isFeatured, isBestSeller, sort } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (stock === "out-of-stock") filter.stock = { $lte: 0 };
  if (stock === "low-stock") filter.stock = { $gt: 0, $lte: 5 };
  if (stock === "in-stock") filter.stock = { $gt: 5 };
  if (isActive !== undefined) filter.isActive = isActive;
  if (isFeatured !== undefined) filter.isFeatured = isFeatured;
  if (isBestSeller !== undefined) filter.isBestSeller = isBestSeller;
  if (search) filter.$text = { $search: search };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(SORT_OPTIONS[sort] || SORT_OPTIONS.newest)
      .skip(skip)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

const getById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) throw ApiError.notFound("Product not found.");
  res.json({ product });
});

const create = asyncHandler(async (req, res) => {
  await assertCategoryExists(req.body.category);
  const base = slugify(req.body.slug || req.body.name);
  const slug = await uniqueSlug(base);
  const sku = (req.body.sku || generateSku()).toUpperCase();

  const curation = {};
  for (const [flagField, orderField] of HOMEPAGE_RAILS) {
    const resolved = await resolveHomepageCuration(req.body, { flag: false, order: null }, flagField, orderField);
    curation[flagField] = resolved.flag;
    curation[orderField] = resolved.order;
  }

  const product = await Product.create({ ...req.body, slug, sku, ...curation });
  res.status(201).json({ product });
});

const update = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found.");
  if (req.body.category) await assertCategoryExists(req.body.category);

  if (req.body.name || req.body.slug) {
    const base = slugify(req.body.slug || req.body.name || product.name);
    product.slug = await uniqueSlug(base, product._id);
  }
  if (req.body.sku) req.body.sku = req.body.sku.toUpperCase();

  for (const [flagField, orderField] of HOMEPAGE_RAILS) {
    const flagProvided = Object.prototype.hasOwnProperty.call(req.body, flagField);
    const orderProvided = Object.prototype.hasOwnProperty.call(req.body, orderField);
    if (!flagProvided && !orderProvided) continue;
    const resolved = await resolveHomepageCuration(
      req.body,
      { flag: product[flagField], order: product[orderField] },
      flagField,
      orderField
    );
    req.body[flagField] = resolved.flag;
    req.body[orderField] = resolved.order;
  }

  Object.assign(product, req.body);
  await product.save();
  res.json({ product });
});

const remove = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found.");
  await Promise.all((product.images || []).map((image) => destroyImage(image.publicId)));
  await product.deleteOne();
  res.status(204).send();
});

const addImages = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found.");
  if (!req.files || req.files.length === 0) throw ApiError.badRequest("At least one image file is required.");
  if (product.images.length + req.files.length > 12) throw ApiError.badRequest("A product may have at most 12 images.");

  const uploaded = [];
  try {
    for (const file of req.files) uploaded.push(await uploadBuffer(file.buffer, "rns/products"));
    product.images.push(...uploaded);
    await product.save();
  } catch (err) {
    await Promise.all(uploaded.map((image) => destroyImage(image.publicId)));
    throw err;
  }
  res.status(201).json({ product });
});

const replaceImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found.");
  const image = product.images.id(req.params.imageId);
  if (!image) throw ApiError.notFound("Image not found on this product.");
  if (!req.file) throw ApiError.badRequest("An image file is required.");

  const oldPublicId = image.publicId;
  const uploaded = await uploadBuffer(req.file.buffer, "rns/products");
  try {
    image.url = uploaded.url;
    image.publicId = uploaded.publicId;
    await product.save();
  } catch (err) {
    await destroyImage(uploaded.publicId);
    throw err;
  }
  await destroyImage(oldPublicId);
  res.json({ product });
});

const removeImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound("Product not found.");
  const image = product.images.id(req.params.imageId);
  if (!image) throw ApiError.notFound("Image not found on this product.");
  const publicId = image.publicId;
  image.deleteOne();
  await product.save();
  await destroyImage(publicId);
  res.json({ product });
});

const bulkAction = asyncHandler(async (req, res) => {
  const { ids, action, categoryId } = req.body;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100) throw ApiError.badRequest("Select between 1 and 100 products.");
  if (new Set(ids).size !== ids.length || ids.some((id) => !mongoose.isValidObjectId(id))) throw ApiError.badRequest("All product ids must be valid and unique.");

  const allowedActions = new Set(["activate", "deactivate", "change-category", "delete"]);
  if (!allowedActions.has(action)) throw ApiError.badRequest("Unsupported bulk product action.");
  if ((action === "delete" || action === "change-category") && !["Owner", "Manager"].includes(req.admin.role)) {
    throw ApiError.forbidden("Only Owners and Managers can perform this bulk action.");
  }

  if (action === "activate" || action === "deactivate") {
    const result = await Product.updateMany({ _id: { $in: ids } }, { $set: { isActive: action === "activate" } });
    return res.json({ action, matched: result.matchedCount, modified: result.modifiedCount });
  }

  if (action === "change-category") {
    if (!mongoose.isValidObjectId(categoryId)) throw ApiError.badRequest("categoryId must be a valid id.");
    await assertCategoryExists(categoryId);
    const result = await Product.updateMany({ _id: { $in: ids } }, { $set: { category: categoryId } });
    return res.json({ action, categoryId, matched: result.matchedCount, modified: result.modifiedCount });
  }

  const products = await Product.find({ _id: { $in: ids } }).select("_id images");
  await Promise.all(products.flatMap((product) => (product.images || []).map((image) => destroyImage(image.publicId))));
  const result = await Product.deleteMany({ _id: { $in: ids } });
  return res.json({ action, deleted: result.deletedCount });
});

module.exports = { list, getById, create, update, remove, addImages, replaceImage, removeImage, bulkAction };
