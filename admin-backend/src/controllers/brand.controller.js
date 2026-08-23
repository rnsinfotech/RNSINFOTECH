const Brand = require("../models/Brand");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const slugify = require("../utils/slugify");

async function uniqueSlug(base, excludeId) {
  let slug = slugify(base) || "brand";
  let suffix = 1;
  while (await Brand.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    suffix += 1;
    slug = `${slugify(base) || "brand"}-${suffix}`;
  }
  return slug;
}

async function withCounts(items) {
  return Promise.all(items.map(async (brand) => ({
    ...brand.toJSON(),
    count: await Product.countDocuments({ brand: brand.name }),
  })));
}

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, isActive } = req.query;
  const filter = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (typeof isActive === "boolean") filter.isActive = isActive;

  const [items, total] = await Promise.all([
    Brand.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    Brand.countDocuments(filter),
  ]);

  res.json({ items: await withCounts(items), page, limit, total, totalPages: Math.ceil(total / limit) });
});

const getById = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw ApiError.notFound("Brand not found.");
  const [result] = await withCounts([brand]);
  res.json({ brand: result });
});

const create = asyncHandler(async (req, res) => {
  const name = req.body.name.trim();
  if (await Brand.exists({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })) {
    throw ApiError.conflict(`A brand named "${name}" already exists.`);
  }
  const slug = await uniqueSlug(name);
  const brand = await Brand.create({ ...req.body, name, slug });
  const [result] = await withCounts([brand]);
  res.status(201).json({ brand: result });
});

const update = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw ApiError.notFound("Brand not found.");

  const oldName = brand.name;
  if (req.body.name && req.body.name.trim().toLowerCase() !== oldName.toLowerCase()) {
    const duplicate = await Brand.exists({ name: new RegExp(`^${req.body.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), _id: { $ne: brand._id } });
    if (duplicate) throw ApiError.conflict(`A brand named "${req.body.name.trim()}" already exists.`);
    brand.name = req.body.name.trim();
    brand.slug = await uniqueSlug(brand.name, brand._id);
  }
  if (req.body.logo !== undefined) brand.logo = req.body.logo;
  if (req.body.isActive !== undefined) brand.isActive = req.body.isActive;
  await brand.save();

  if (brand.name !== oldName) {
    await Product.updateMany({ brand: oldName }, { $set: { brand: brand.name } });
  }

  const [result] = await withCounts([brand]);
  res.json({ brand: result });
});

const remove = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);
  if (!brand) throw ApiError.notFound("Brand not found.");
  const count = await Product.countDocuments({ brand: brand.name });
  if (count > 0) throw ApiError.conflict(`Cannot delete "${brand.name}" while ${count} product(s) are assigned to it.`);
  await brand.deleteOne();
  res.status(204).send();
});

module.exports = { list, getById, create, update, remove };
