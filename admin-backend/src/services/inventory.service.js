const Product = require("../models/Product");
const InventoryLog = require("../models/InventoryLog");
const ApiError = require("../utils/ApiError");

async function adjustProductStock(productId, delta, { orderId = null, actorUser = null, actorId = null, actorName = null, actorEmail = null, actorType = "admin", action = "adjustment", reason = "Inventory adjustment" } = {}) {
  const product = await Product.findById(productId).select("name sku stock");
  if (!product) throw ApiError.notFound("Product not found.");
  const previousQty = Number(product.stock || 0);
  const nextQty = previousQty + Number(delta);
  if (nextQty < 0) throw ApiError.conflict(`Insufficient stock for "${product.name}".`);
  const updated = await Product.findOneAndUpdate({ _id: productId, stock: previousQty }, { $inc: { stock: Number(delta) } }, { new: true }).lean();
  if (!updated) throw ApiError.conflict("Inventory changed concurrently. Please retry.");
  await InventoryLog.create({ product: updated._id, productName: updated.name, sku: updated.sku, action, delta: Number(delta), previousQty, newQty: updated.stock, reason, order: orderId, actorUser, actorId, actorName, actorEmail, actorType });
  return updated;
}

async function releaseOrderStock(order, { actorUser = null, reason = "Order cancelled" } = {}) {
  if (!order || order.reservationStatus !== "reserved") return false;
  const claimed = await require("../models/Order").findOneAndUpdate({ _id: order._id, reservationStatus: "reserved" }, { $set: { reservationStatus: "released", reservationReleasedAt: new Date(), reservationReleaseReason: reason } }, { new: true });
  if (!claimed) return false;
  for (const item of claimed.items) await adjustProductStock(item.product, item.quantity, { orderId: claimed._id, actorUser, actorType: "admin", action: "release", reason });
  return true;
}

module.exports = { adjustProductStock, releaseOrderStock };

async function restoreConsumedOrderStock(order, { actorUser = null, reason = "Order refunded" } = {}) {
  const Order = require("../models/Order");
  const claimed = await Order.findOneAndUpdate({ _id: order._id, reservationStatus: "consumed" }, { $set: { reservationStatus: "released", reservationReleasedAt: new Date(), reservationReleaseReason: reason } }, { new: true });
  if (!claimed) return false;
  for (const item of claimed.items) await adjustProductStock(item.product, item.quantity, { orderId: claimed._id, actorUser, actorType: "admin", action: "increase", reason });
  return true;
}
module.exports.restoreConsumedOrderStock = restoreConsumedOrderStock;
