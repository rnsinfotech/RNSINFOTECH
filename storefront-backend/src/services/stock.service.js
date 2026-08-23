const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const InventoryLog = require("../models/InventoryLog");
const ApiError = require("../utils/ApiError");

const RESERVATION_MINUTES = Math.max(1, Number(process.env.INVENTORY_RESERVATION_MINUTES || 15));
const RESERVATION_MS = RESERVATION_MINUTES * 60 * 1000;

async function logInventory(item, previousQty, newQty, action, reason, orderId, actorUser, actorType = "system", session = null) {
  const product = item._product || { _id: item.product, name: item.name || "Unknown product", sku: item.sku || "" };
  if (!product) return;
  await InventoryLog.create({
    product: product._id,
    productName: product.name,
    sku: product.sku,
    action,
    delta: newQty - previousQty,
    previousQty,
    newQty,
    reason,
    order: orderId || null,
    actorUser: actorUser || null,
    actorType,
  }, session ? { session } : undefined);
}

async function reserveStock(items, { orderId, actorUser } = {}) {
  const perform = async (session = null) => {
    const reserved = [];
    for (const item of items) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        session ? { session, new: true } : { new: true }
      );
      if (!updated) throw ApiError.conflict(`"${item.name}" no longer has enough stock.`);
      reserved.push({ ...item, _product: updated });
      await logInventory(item, Number(updated.stock) + item.quantity, Number(updated.stock), "reservation", "Order inventory reservation", orderId, actorUser, "customer", session);
    }
    return reserved;
  };

  try {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await perform(session); });
      return result;
    } finally {
      await session.endSession();
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
  }

  const reserved = [];
  try {
    for (const item of items) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) throw ApiError.conflict(`"${item.name}" no longer has enough stock.`);
      reserved.push({ ...item, _product: updated });
      await logInventory(item, Number(updated.stock) + item.quantity, Number(updated.stock), "reservation", "Order inventory reservation", orderId, actorUser, "customer");
    }
    return reserved;
  } catch (err) {
    await restoreStock(reserved);
    throw err;
  }
}

async function releaseStock(items, { orderId, actorUser, reason = "Inventory reservation released", action = "release", actorType = "system" } = {}) {
  for (const item of items || []) {
    const product = await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } }, { new: true });
    if (!product) continue;
    await logInventory({ ...item, _product: product }, product.stock - item.quantity, product.stock, action, reason, orderId, actorUser, actorType);
  }
}

async function releaseOrderReservation(order, reason = "Inventory reservation released") {
  if (!order || order.reservationStatus !== "reserved") return false;
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, reservationStatus: "reserved" },
    { $set: { reservationStatus: reason === "Reservation expired" ? "expired" : "released", reservationReleasedAt: new Date(), reservationReleaseReason: reason } },
    { new: true }
  );
  if (!claimed) return false;
  await releaseStock(claimed.items, { orderId: claimed._id, actorUser: claimed.user, reason });
  return true;
}

async function restoreStock(items) {
  await Promise.all((items || []).map((item) => Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } })));
}

async function consumeOrderReservation(order) {
  if (!order || order.reservationStatus !== "reserved") return false;
  const consumed = await Order.findOneAndUpdate(
    { _id: order._id, reservationStatus: "reserved" },
    { $set: { reservationStatus: "consumed", reservationExpiresAt: null } },
    { new: true }
  );
  return Boolean(consumed);
}

async function restoreConsumedOrderStock(order, { actorUser = null, reason = "Order refunded" } = {}) {
  if (!order || order.reservationStatus !== "consumed") return false;
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, reservationStatus: "consumed" },
    { $set: { reservationStatus: "released", reservationReleasedAt: new Date(), reservationReleaseReason: reason } },
    { new: true }
  );
  if (!claimed) return false;
  await releaseStock(claimed.items, { orderId: claimed._id, actorUser, actorType: "system", action: "increase", reason });
  return true;
}

async function expireReservations() {
  const now = new Date();
  const orders = await Order.find({ reservationStatus: "reserved", reservationExpiresAt: { $lte: now }, status: "pending" }).limit(100);
  let released = 0;
  for (const order of orders) {
    if (await releaseOrderReservation(order, "Reservation expired")) {
      released += 1;
      try {
        const { releaseCoupon } = require("./coupon.service");
        if (order.couponReservationId) await releaseCoupon(order.couponReservationId, "Reservation expired");
      } catch (_) {}
      try {
        const Payment = require("../models/Payment");
        await Payment.updateMany(
          { order: order._id, status: "created" },
          { $set: { status: "expired", failureReason: "Payment timeout / inventory reservation expired", razorpayStatus: "expired" } }
        );
      } catch (_) {}
      try {
        const { transitionOrder } = require("./orderLifecycle.service");
        const updated = await Order.findById(order._id);
        if (updated && updated.status === "pending") {
          await transitionOrder(updated, "cancelled", { actorType: "system", note: "Payment timeout / inventory reservation expired" });
        }
      } catch (_) {}
    }
  }
  return released;
}

async function releaseFailedPaymentReservation(orderId, reason = "Payment failed") {
  const order = await Order.findById(orderId);
  return releaseOrderReservation(order, reason);
}

async function startReservationSweeper() {
  const intervalMs = Math.max(10, Number(process.env.INVENTORY_RESERVATION_SWEEP_SECONDS || 60)) * 1000;
  await expireReservations();
  return setInterval(() => expireReservations().catch(() => {}), intervalMs);
}

async function decrementStock(items, options = {}) {
  return reserveStock(items, options);
}

module.exports = {
  RESERVATION_MINUTES,
  RESERVATION_MS,
  reserveStock,
  decrementStock,
  releaseStock,
  restoreStock,
  releaseOrderReservation,
  releaseFailedPaymentReservation,
  consumeOrderReservation,
  expireReservations,
  startReservationSweeper,
  restoreConsumedOrderStock,
};
