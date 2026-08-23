const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");
const CouponRedemption = require("../models/CouponRedemption");
const ApiError = require("../utils/ApiError");

function computeDiscount(coupon, orderTotal) {
  const total = Number(orderTotal || 0);
  if (coupon.type === "percent") return Number(((total * coupon.value) / 100).toFixed(2));
  if (coupon.type === "fixed") return Number(Math.min(Number(coupon.value || 0), total).toFixed(2));
  return 0;
}

async function findValidCoupon(code, orderTotal, userId = null) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  if (!normalizedCode) throw ApiError.badRequest("Coupon code is required.");
  const coupon = await Coupon.findOne({ code: normalizedCode });
  if (!coupon) throw ApiError.notFound("Coupon not found.");
  if (coupon.status !== "active") throw ApiError.badRequest("This coupon is not active.");
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) throw ApiError.badRequest("This coupon has expired.");
  if (coupon.usageLimit > 0 && Number(coupon.usageCount || 0) + Number(coupon.reservedCount || 0) >= coupon.usageLimit) throw ApiError.badRequest("This coupon has reached its usage limit.");
  if (Number(orderTotal || 0) < Number(coupon.minOrderValue || 0)) throw ApiError.badRequest(`Order total must be at least ${Number(coupon.minOrderValue || 0)}.`);
  if (userId && coupon.allowedUsers?.length && !coupon.allowedUsers.some((id) => String(id) === String(userId))) throw ApiError.forbidden("This coupon is not available for your account.");
  if (userId && Number(coupon.maxUsesPerUser || 0) > 0) {
    const userUses = await CouponRedemption.countDocuments({ coupon: coupon._id, user: userId, status: { $in: ["reserved", "consumed"] } });
    if (userUses >= coupon.maxUsesPerUser) throw ApiError.badRequest("You have reached the usage limit for this coupon.");
  }
  return coupon;
}

async function reserveCoupon(coupon, { orderId, userId, expiresAt }) {
  const doReserve = async (session = null) => {
    const updated = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        status: "active",
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        $expr: {
          $or: [
            { $eq: [{ $ifNull: ["$usageLimit", 0] }, 0] },
            { $lt: [{ $add: [{ $ifNull: ["$usageCount", 0] }, { $ifNull: ["$reservedCount", 0] }] }, "$usageLimit"] },
          ],
        },
      },
      { $inc: { reservedCount: 1 } },
      session ? { new: true, session } : { new: true }
    );
    if (!updated) throw ApiError.conflict("This coupon is no longer available. Please refresh checkout.");
    const created = await CouponRedemption.create([{ coupon: updated._id, order: orderId, user: userId, status: "reserved", expiresAt }], ...(session ? [{ session }] : []));
    return Array.isArray(created) ? created[0] : created;
  };

  if (mongoose.connection.readyState === 1) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => { result = await doReserve(session); });
      return result;
    } finally { await session.endSession(); }
  }
  return doReserve();
}

async function consumeCoupon(redemptionId) {
  const apply = async (session = null) => {
    const redemption = await CouponRedemption.findOneAndUpdate(
      { _id: redemptionId, status: "reserved" },
      { $set: { status: "consumed", consumedAt: new Date() } },
      session ? { new: true, session } : { new: true }
    );
    if (!redemption) return false;
    if (session) await Coupon.findOneAndUpdate({ _id: redemption.coupon, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1, usageCount: 1 } }, { session });
    else await Coupon.findOneAndUpdate({ _id: redemption.coupon, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1, usageCount: 1 } });
    return true;
  };
  if (mongoose.connection.readyState === 1) {
    const session = await mongoose.startSession();
    try { let result; await session.withTransaction(async () => { result = await apply(session); }); return result; } finally { await session.endSession(); }
  }
  return apply();
}

async function releaseCoupon(redemptionId, reason = "Coupon reservation released") {
  const release = async (session = null) => {
    const redemption = await CouponRedemption.findOneAndUpdate(
      { _id: redemptionId, status: "reserved" },
      { $set: { status: "released", releasedAt: new Date(), releaseReason: reason } },
      session ? { new: true, session } : { new: true }
    );
    if (!redemption) return false;
    if (session) await Coupon.findOneAndUpdate({ _id: redemption.coupon, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } }, { session });
    else await Coupon.findOneAndUpdate({ _id: redemption.coupon, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } });
    return true;
  };
  if (mongoose.connection.readyState === 1) {
    const session = await mongoose.startSession();
    try { let result; await session.withTransaction(async () => { result = await release(session); }); return result; } finally { await session.endSession(); }
  }
  return release();
}

async function rollbackConsumedCouponForRefund(orderId, reason = "Order refunded") {
  const redemption = await CouponRedemption.findOneAndUpdate({ order: orderId, status: "consumed" }, { $set: { status: "released", releasedAt: new Date(), releaseReason: reason } }, { new: true });
  if (!redemption) return false;
  await Coupon.findOneAndUpdate({ _id: redemption.coupon, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
  return true;
}

async function expireCouponReservations() {
  const expired = await CouponRedemption.find({ status: "reserved", expiresAt: { $lte: new Date() } }).limit(200);
  let count = 0;
  for (const redemption of expired) if (await releaseCoupon(redemption._id, "Coupon reservation expired")) count += 1;
  return count;
}

async function startCouponSweeper() {
  const intervalMs = Math.max(10, Number(process.env.INVENTORY_RESERVATION_SWEEP_SECONDS || 60)) * 1000;
  await expireCouponReservations();
  return setInterval(() => expireCouponReservations().catch(() => {}), intervalMs);
}

module.exports = { computeDiscount, findValidCoupon, reserveCoupon, consumeCoupon, releaseCoupon, rollbackConsumedCouponForRefund, expireCouponReservations, startCouponSweeper };
