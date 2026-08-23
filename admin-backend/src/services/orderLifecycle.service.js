const ApiError = require("../utils/ApiError");
const Order = require("../models/Order");
const User = require("../models/User");
const { sendTransactionalEmail } = require("./email.service");

const TRANSITIONS = Object.freeze({
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: [],
  cancelled: [],
});

const TIMESTAMP_FIELDS = {
  confirmed: "confirmedAt",
  shipped: "shippedAt",
  cancelled: "cancelledAt",
};

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

async function transitionOrder(order, to, { actorType = "system", actorId = null, note = null, session = null } = {}) {
  if (!order) throw ApiError.notFound("Order not found.");
  if (!canTransition(order.status, to)) {
    throw ApiError.conflict(`Invalid order transition: "${order.status}" -> "${to}".`);
  }

  const update = {
    $set: { status: to },
    $push: {
      statusHistory: {
        status: to,
        at: new Date(),
        actorType,
        actorId,
        note,
      },
    },
  };
  const timestampField = TIMESTAMP_FIELDS[to];
  if (timestampField) update.$set[timestampField] = new Date();
  if (to === "cancelled" && note) update.$set.cancelReason = note;

  const query = { _id: order._id, status: order.status };
  const options = { new: true };
  if (session) options.session = session;
  const updated = await Order.findOneAndUpdate(query, update, options);
  if (updated === undefined) {
    order.status = to;
    if (timestampField) order[timestampField] = new Date();
    if (to === "cancelled" && note) order.cancelReason = note;
    order.statusHistory = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    order.statusHistory.push(update.$push.statusHistory);
    if (typeof order.save === "function") await order.save();
    return order;
  }
  if (!updated) throw ApiError.conflict("Order changed concurrently. Refresh and retry.");
  try {
    const user = await User.findById(updated.user).select("email").lean();
    if (user?.email) {
      const templates = { confirmed: "order-confirmation", shipped: "shipping", cancelled: "cancellation" };
      const template = templates[to];
      if (template) await sendTransactionalEmail(template,user.email,{
        orderId:updated._id,total:updated.itemsTotal,courier:updated.courierName,trackingId:updated.trackingId,
        status:to,reason:updated.cancelReason || note || ""
      },`order:${updated._id}:${to}`);
    }
  } catch (emailErr) {
    // Email is retried asynchronously; lifecycle state must not be rolled back.
  }
  return updated;
}

module.exports = { TRANSITIONS, TIMESTAMP_FIELDS, canTransition, transitionOrder };
