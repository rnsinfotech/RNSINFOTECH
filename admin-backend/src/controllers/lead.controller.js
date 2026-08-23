const Lead = require("../models/Lead");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const { page, limit, type, status, search } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { message: { $regex: search, $options: "i" } },
    ];
  }

  let query = Lead.find(filter);
  if (typeof query.sort === "function") query = query.sort({ createdAt: -1 });
  if (typeof query.skip === "function") query = query.skip((page - 1) * limit);
  if (typeof query.limit === "function") query = query.limit(limit);

  const [items, total] = await Promise.all([query, Lead.countDocuments(filter)]);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

// Counts by type (newsletter/demo/contact/quote — quote also covers
// bulk-pricing requests, which share the /request-quote form) and by
// status, so the Leads page can show both the type tabs and a
// new/contacted/closed breakdown without a second round trip per tab.
const stats = asyncHandler(async (req, res) => {
  const [total, newCount, contacted, closed, newsletter, demo, contact, quote] = await Promise.all([
    Lead.countDocuments({}),
    Lead.countDocuments({ status: "new" }),
    Lead.countDocuments({ status: "contacted" }),
    Lead.countDocuments({ status: "closed" }),
    Lead.countDocuments({ type: "newsletter" }),
    Lead.countDocuments({ type: "demo" }),
    Lead.countDocuments({ type: "contact" }),
    Lead.countDocuments({ type: "quote" }),
  ]);
  res.json({
    total,
    new: newCount,
    contacted,
    closed,
    byType: { newsletter, demo, contact, quote },
  });
});

const getById = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found.");
  res.json({ lead });
});

const updateStatus = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found.");

  lead.status = req.body.status;
  await lead.save();

  res.json({ lead });
});

const remove = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw ApiError.notFound("Lead not found.");

  await lead.deleteOne();
  res.status(204).send();
});

module.exports = { list, stats, getById, updateStatus, remove };
