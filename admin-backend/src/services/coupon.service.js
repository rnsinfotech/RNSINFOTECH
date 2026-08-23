const Coupon = require("../models/Coupon");
const CouponRedemption = require("../models/CouponRedemption");

async function releaseCoupon(redemptionId, reason = "Order cancelled") {
  if (!redemptionId) return false;
  const redemption = await CouponRedemption.findOneAndUpdate({ _id: redemptionId, status: "reserved" }, { $set: { status: "released", releasedAt: new Date(), releaseReason: reason } }, { new: true });
  if (!redemption) return false;
  await Coupon.findOneAndUpdate({ _id: redemption.coupon, reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1 } });
  return true;
}

async function rollbackConsumedCoupon(orderId, reason = "Order refunded") {
  const redemption = await CouponRedemption.findOneAndUpdate({ order: orderId, status: "consumed" }, { $set: { status: "released", releasedAt: new Date(), releaseReason: reason } }, { new: true });
  if (!redemption) return false;
  await Coupon.findOneAndUpdate({ _id: redemption.coupon, usageCount: { $gt: 0 } }, { $inc: { usageCount: -1 } });
  return true;
}

module.exports = { releaseCoupon, rollbackConsumedCoupon };
