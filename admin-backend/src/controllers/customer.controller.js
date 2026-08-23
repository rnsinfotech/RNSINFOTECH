const User = require("../models/User");
const Order = require("../models/Order");
const Address = require("../models/Address");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/customers — every real customer is a `users` doc (storefront-
// backend writes it at signup, Phase B1), joined here at read time with an
// order-count/total-spent/last-order-at summary computed from `orders`.
// Deliberately NOT the admin-portal mock layer's old "derive a customer
// from customerEmail on every order" approach — a signed-up customer with
// zero orders still shows up here, which that approach could never do.
// Cancelled orders are excluded from totalSpent/orderCount so a cancelled
// order doesn't inflate a customer's apparent order history.
const list = asyncHandler(async (req, res) => {
  const { page, limit, search } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const userIds = users.map((user) => user._id);
  const stats = await Order.aggregate([
    { $match: { user: { $in: userIds }, status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: "$user",
        orderCount: { $sum: 1 },
        totalSpent: { $sum: "$itemsTotal" },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);
  const statsByUser = new Map(stats.map((stat) => [String(stat._id), stat]));

  const items = users.map((user) => {
    const obj = user.toJSON();
    const stat = statsByUser.get(String(user._id));
    obj.orderCount = stat ? stat.orderCount : 0;
    obj.totalSpent = stat ? stat.totalSpent : 0;
    obj.lastOrderAt = stat ? stat.lastOrderAt : null;
    return obj;
  });

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /api/customers/:id — full profile for one customer: the user doc,
// their complete order history, and their saved address book. All three
// collections are read-only here per BACKEND_PLAN.md's ownership matrix
// (`users`/`addresses` owned by storefront-backend, `orders` written by
// both but never deleted by this service) — this endpoint never mutates
// any of them, it only reads and joins.
const getById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("Customer not found.");

  const [orders, addresses] = await Promise.all([
    Order.find({ user: user._id }).sort({ createdAt: -1 }),
    Address.find({ user: user._id }).sort({ isDefault: -1, createdAt: -1 }),
  ]);

  res.json({ customer: user, orders, addresses });
});

module.exports = { list, getById };
