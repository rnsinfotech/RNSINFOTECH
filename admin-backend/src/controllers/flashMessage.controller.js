const FlashMessage = require("../models/FlashMessage");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const items = await FlashMessage.find({}).sort({ sortOrder: 1, createdAt: 1 });
  res.json({ items });
});

const create = asyncHandler(async (req, res) => {
  const max = await FlashMessage.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean();
  const message = await FlashMessage.create({ ...req.body, sortOrder: Number(max?.sortOrder || 0) + 1 });
  res.status(201).json({ message });
});

const update = asyncHandler(async (req, res) => {
  const message = await FlashMessage.findById(req.params.id);
  if (!message) throw ApiError.notFound("Flash message not found.");
  Object.assign(message, req.body);
  await message.save();
  res.json({ message });
});

const remove = asyncHandler(async (req, res) => {
  const message = await FlashMessage.findById(req.params.id);
  if (!message) throw ApiError.notFound("Flash message not found.");
  await message.deleteOne();
  res.status(204).send();
});

const reorder = asyncHandler(async (req, res) => {
  const ids = req.body.orderedIds;
  const messages = await FlashMessage.find({ _id: { $in: ids } });
  if (messages.length !== ids.length) throw ApiError.badRequest("orderedIds contains an unknown flash message.");
  await Promise.all(ids.map((id, index) => FlashMessage.findByIdAndUpdate(id, { sortOrder: index })));
  const items = await FlashMessage.find({}).sort({ sortOrder: 1, createdAt: 1 });
  res.json({ items });
});

module.exports = { list, create, update, remove, reorder };
