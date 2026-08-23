const Coupon = require("../models/Coupon");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const normalizeCode = (value) => String(value || "").trim().toUpperCase();

const list = asyncHandler(async (req, res) => {
  const { page, limit, search, status } = req.query;
  const filter = {};

  if (search) {
    filter.$or = [{ code: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }];
  }

  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Coupon.countDocuments(filter),
  ]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

const stats = asyncHandler(async (req, res) => {
  const now = new Date();
  const [total, active, expired, aggregate] = await Promise.all([
    Coupon.countDocuments({}),
    Coupon.countDocuments({ status: "active", $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }], $expr: { $or: [{ $eq: [{ $ifNull: ["$usageLimit", 0] }, 0] }, { $lt: [{ $add: [{ $ifNull: ["$usageCount", 0] }, { $ifNull: ["$reservedCount", 0] }] }, "$usageLimit"] }] } }),
    Coupon.countDocuments({ expiresAt: { $lt: now } }),
    Coupon.aggregate([{ $group: { _id: null, totalRedemptions: { $sum: "$usageCount" } } }]),
  ]);
  res.json({ total, active, expired, totalRedemptions: aggregate[0]?.totalRedemptions || 0 });
});

const getById = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound("Coupon not found.");
  res.json({ coupon });
});

const create = asyncHandler(async (req, res) => {
  const code = normalizeCode(req.body.code);
  if (!code) throw ApiError.badRequest("Coupon code is required.");

  const exists = await Coupon.exists({ code });
  if (exists) {
    throw ApiError.conflict(`A coupon with the code "${code}" already exists.`);
  }

  const coupon = await Coupon.create({
    ...req.body,
    code,
    status: req.body.status || "active",
    usageCount: Number(req.body.usageCount || 0),
    minOrderValue: Number(req.body.minOrderValue || 0),
    usageLimit: Number(req.body.usageLimit || 0),
  });

  res.status(201).json({ coupon });
});

const update = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound("Coupon not found.");

  if (req.body.code) {
    const code = normalizeCode(req.body.code);
    const duplicate = await Coupon.exists({ code, _id: { $ne: coupon._id } });
    if (duplicate) throw ApiError.conflict(`A coupon with the code "${code}" already exists.`);
    coupon.code = code;
  }

  Object.assign(coupon, req.body);
  await coupon.save();
  res.json({ coupon });
});

const remove = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw ApiError.notFound("Coupon not found.");

  await coupon.deleteOne();
  res.status(204).send();
});

module.exports = { list, stats, getById, create, update, remove };
