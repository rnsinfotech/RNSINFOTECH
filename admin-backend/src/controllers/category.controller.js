const Category = require("../models/Category");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const slugify = require("../utils/slugify");
const { uploadBuffer, destroyImage } = require("../services/upload.service");

// Appends "-2", "-3", ... until the slug is free. A DB round trip per
// attempt is fine here — category names rarely collide, so this loop
// almost always runs once.
async function uniqueSlug(base, excludeId) {
  let slug = base;
  let suffix = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Category.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    suffix += 1;
    slug = `${base}-${suffix}`;
  }
  return slug;
}

// GET /api/categories
const list = asyncHandler(async (req, res) => {
  const { page, limit, search, isActive } = req.query;
  const filter = {};
  if (typeof isActive === "boolean") filter.isActive = isActive;
  if (search) filter.name = { $regex: search, $options: "i" };

  const [items, total] = await Promise.all([
    Category.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Category.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /api/categories/:id
const getById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound("Category not found.");
  res.json({ category });
});

// POST /api/categories
const create = asyncHandler(async (req, res) => {
  const base = slugify(req.body.slug || req.body.name);
  const slug = await uniqueSlug(base);
  const category = await Category.create({ ...req.body, slug });
  res.status(201).json({ category });
});

// PATCH /api/categories/:id
const update = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound("Category not found.");

  if (req.body.name || req.body.slug) {
    const base = slugify(req.body.slug || req.body.name || category.name);
    category.slug = await uniqueSlug(base, category._id);
  }

  Object.assign(category, req.body);
  await category.save();
  res.json({ category });
});

// DELETE /api/categories/:id
const remove = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound("Category not found.");

  // Refuse rather than cascade-delete or null out the ref — a category
  // with products still assigned should be reassigned/emptied by staff
  // first, not silently orphan those products' category field.
  const inUse = await Product.exists({ category: category._id });
  if (inUse) {
    throw ApiError.conflict("This category still has products assigned to it. Reassign or remove them first.");
  }

  if (category.image?.publicId) await destroyImage(category.image.publicId);
  await category.deleteOne();
  res.status(204).send();
});

// POST /api/categories/:id/image
const setImage = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound("Category not found.");
  if (!req.file) throw ApiError.badRequest("An image file is required.");

  const previousPublicId = category.image?.publicId;
  category.image = await uploadBuffer(req.file.buffer, "rns/categories");
  await category.save();

  // Delete the old asset only after the new one is safely saved, so a
  // failed save never leaves the category without any image at all.
  if (previousPublicId) await destroyImage(previousPublicId);

  res.json({ category });
});

module.exports = { list, getById, create, update, remove, setImage };
