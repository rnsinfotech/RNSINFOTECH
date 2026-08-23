const asyncHandler = require("../utils/asyncHandler");
const { computeDiscount, findValidCoupon } = require("../services/coupon.service");

// POST /api/coupons/validate — a read-only preview. Does NOT increment
// usageCount or attach anything to an order; see order.controller.js's
// placeOrder (Phase BC) for the real, usage-incrementing application of a
// coupon at checkout.
const validateCoupon = asyncHandler(async (req, res) => {
  const orderTotal = Number(req.body.orderTotal || 0);
  const coupon = await findValidCoupon(req.body.code, orderTotal, req.auth?.userId || null);
  const discount = computeDiscount(coupon, orderTotal);

  res.json({
    valid: true,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minOrderValue: coupon.minOrderValue,
      status: coupon.status,
      expiresAt: coupon.expiresAt,
    },
    discount,
    finalTotal: Number((orderTotal - discount).toFixed(2)),
  });
});

module.exports = { validateCoupon };
