const Address = require("../models/Address");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Whenever an address is saved as the default, every other address
// belonging to that same user has its isDefault cleared first — so
// "default" is enforced here as a single-winner invariant at write time,
// not just trusted from whatever an individual request happens to send.
async function clearOtherDefaults(userId, exceptId) {
  await Address.updateMany(
    { user: userId, isDefault: true, ...(exceptId ? { _id: { $ne: exceptId } } : {}) },
    { $set: { isDefault: false } }
  );
}

// GET /api/addresses — the current customer's own address book, default
// first then newest. Always scoped to req.auth.userId, same "never accepts
// a userId from the client" rule order.controller.js already follows.
const list = asyncHandler(async (req, res) => {
  const addresses = await Address.find({ user: req.auth.userId }).sort({ isDefault: -1, createdAt: -1 });
  res.json({ items: addresses });
});

// GET /api/addresses/:id — 404 (not 403) for someone else's address id,
// same "don't reveal which ids exist" reasoning as getMyOrderById.
const getById = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!address) throw ApiError.notFound("Address not found.");
  res.json({ address });
});

// POST /api/addresses — the first address a customer ever saves becomes
// their default automatically, regardless of what isDefault was sent, so
// checkout always has exactly one sane default to preselect from address
// one onward.
const create = asyncHandler(async (req, res) => {
  const isFirst = (await Address.countDocuments({ user: req.auth.userId })) === 0;
  const isDefault = isFirst || req.body.isDefault === true;

  if (isDefault) await clearOtherDefaults(req.auth.userId);

  const address = await Address.create({ ...req.body, user: req.auth.userId, isDefault });
  res.status(201).json({ address });
});

// PATCH /api/addresses/:id
const update = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!address) throw ApiError.notFound("Address not found.");

  if (req.body.isDefault === true) await clearOtherDefaults(req.auth.userId, address._id);

  Object.assign(address, req.body);
  await address.save();
  res.json({ address });
});

// DELETE /api/addresses/:id — if the deleted address was the default and
// other addresses remain, the most recently added one is promoted to
// default, so a customer's address book never ends up with saved
// addresses but no default among them.
const remove = asyncHandler(async (req, res) => {
  const address = await Address.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!address) throw ApiError.notFound("Address not found.");

  await address.deleteOne();

  if (address.isDefault) {
    const next = await Address.findOne({ user: req.auth.userId }).sort({ createdAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  res.status(204).send();
});

module.exports = { list, getById, create, update, remove };
