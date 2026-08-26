const Order = require("../models/Order");
const Product = require("../models/Product");
const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { decrementStock, restoreStock } = require("../services/stock.service");
const { findValidCoupon, recordCouponUsage } = require("../services/coupon.service");
const { calculatePricing, getCommerceSettings } = require("../services/pricing.service");
const { env } = require("../config/env");
const SiteSettings = require("../models/SiteSettings");
const { splitTax } = require("../services/tax.service");
const { getOrCreateInvoice } = require("../services/invoice.service");
const User = require("../models/User");
const { sendTransactionalEmail } = require("../services/email.service");

// Joins each order with a `paymentStatus` summary at read time, rather
// than denormalizing anything onto the Order document itself — `payments`
// stays its own collection per BACKEND_PLAN.md's ownership matrix, and
// Order.js's ownership comment doesn't have to grow a "storefront also
// writes this one payment-related field" exception the way stock.service.js
// documents for Product.stock. "paid" wins if ANY payment attempt for the
// order succeeded, even if a later duplicate/retry attempt shows
// something else; otherwise the most recent attempt's status is shown
// (or "unpaid" if there's no Payment at all yet).
async function attachPaymentStatus(orders) {
  if (orders.length === 0) return [];
  const orderIds = orders.map((order) => order._id);
  const payments = await Payment.find({ order: { $in: orderIds } }).sort({ createdAt: -1 });

  const statusByOrder = new Map();
  for (const payment of payments) {
    const key = String(payment.order);
    if (!statusByOrder.has(key)) statusByOrder.set(key, payment.status);
  }
  for (const payment of payments) {
    if (payment.status === "paid") statusByOrder.set(String(payment.order), "paid");
  }

  return orders.map((order) => {
    const obj = order.toJSON();
    obj.paymentStatus = statusByOrder.get(String(order._id)) || "unpaid";
    return obj;
  });
}

// POST /api/orders — place an order (protected). Body: items
// [{ product, quantity }], shippingAddress. Every item is re-priced from
// the current Product doc server-side and snapshotted onto the order —
// see Order.js and order.validators.js for why. Inactive/unknown/
// insufficient-stock products fail the whole request with a clear
// message before anything is written; stock is then decremented
// atomically (see stock.service.js) right before the order itself is
// created.
const placeOrder = asyncHandler(async (req, res) => {
  const {
    items: requestedItems,
    shippingAddress,
    couponCode: requestedCouponCode,
  } = req.body;

  const productIds = requestedItems.map((requested) => requested.product);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productById = new Map(products.map((product) => [String(product._id), product]));

  const items = requestedItems.map((requested) => {
    const product = productById.get(requested.product);
    if (!product) throw ApiError.badRequest(`Product ${requested.product} is unavailable.`);
    if (product.stock < requested.quantity) throw ApiError.conflict(`"${product.name}" only has ${product.stock} left in stock.`);
    return {
      product: product._id,
      name: product.name,
      sku: product.sku || "",
      image: (product.images && product.images[0] && product.images[0].url) || null,
      price: product.price,
      quantity: requested.quantity,
    };
  });

  let coupon = null;
  if (requestedCouponCode) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    coupon = await findValidCoupon(requestedCouponCode, subtotal, req.auth.userId);
  }

  const commerce = await getCommerceSettings();
  const pricing = calculatePricing({ items, coupon, commerce });
  const siteSettings = await SiteSettings.findOne({ key: "global" }).lean();
  const sellerProfile = siteSettings?.storeProfile || {};
  const taxBreakdown = splitTax({
    taxableValue: pricing.taxableAmount,
    taxRate: pricing.taxRate,
    sellerState: sellerProfile.state,
    customerState: shippingAddress.state,
    sellerGstin: sellerProfile.gstin,
  });
  const reservationExpiresAt = new Date(Date.now() + require("../services/stock.service").RESERVATION_MS);

  // Create the order before touching inventory so every stock reservation has
  // a durable owner. If the process dies after the stock update, the expiry
  // worker can find and release this order safely.
  let order;
  let stockReserved = false;
  try {
    order = await Order.create({
      user: req.auth.userId,
      items,
      itemsTotal: pricing.total,
      subtotal: pricing.subtotal,
      shippingFee: pricing.shippingFee,
      deliveryFee: pricing.deliveryFee,
      tax: pricing.tax,
      taxRate: pricing.taxRate,
      taxPolicy: {
        priceIncludesTax: false,
        taxType: "GST",
        placeOfSupply: shippingAddress.state || "",
        supplyType: taxBreakdown.supplyType,
      },
      taxBreakdown: {
        cgstRate: taxBreakdown.cgstRate,
        cgstAmount: taxBreakdown.cgstAmount,
        sgstRate: taxBreakdown.sgstRate,
        sgstAmount: taxBreakdown.sgstAmount,
        igstRate: taxBreakdown.igstRate,
        igstAmount: taxBreakdown.igstAmount,
      },
      shippingAddress: { ...shippingAddress, gstin: shippingAddress.gstin || "" },
      status: "pending",
      reservationStatus: "pending",
      reservationExpiresAt,
      couponCode: coupon ? coupon.code : null,
      discount: pricing.discount,
      couponSnapshot: coupon ? { code: coupon.code, type: coupon.type, value: coupon.value } : null,
      pricing: { currency: pricing.currency, subtotal: pricing.subtotal, discount: pricing.discount, shippingFee: pricing.shippingFee, deliveryFee: pricing.deliveryFee, tax: pricing.tax, taxRate: pricing.taxRate, taxPolicy: pricing.taxPolicy, taxableAmount: pricing.taxableAmount, total: pricing.total, commerce: pricing.commerce },
    });

    const { decrementStock } = require("../services/stock.service");
    await decrementStock(items, { orderId: order._id, actorUser: req.auth.userId });
    stockReserved = true;
    await Order.updateOne({ _id: order._id, reservationStatus: "pending" }, { $set: { reservationStatus: "reserved" } });
    order.reservationStatus = "reserved";

    if (coupon) {
      const { reserveCoupon } = require("../services/coupon.service");
      try {
        const redemption = await reserveCoupon(coupon, { orderId: order._id, userId: req.auth.userId, expiresAt: reservationExpiresAt });
        await Order.updateOne({ _id: order._id }, { $set: { couponReservationId: redemption._id } });
      } catch (couponErr) {
        const { releaseOrderReservation } = require("../services/stock.service");
        await releaseOrderReservation(order, "Coupon reservation failed");
        await Order.deleteOne({ _id: order._id });
        throw couponErr;
      }
    }

    order = await Order.findById(order._id);
  } catch (err) {
    if (order) {
      try {
        if (stockReserved) {
          await require("../services/stock.service").releaseOrderReservation(order, "Order creation rollback");
          if (order.reservationStatus === "pending") await require("../services/stock.service").releaseStock(items, { orderId: order._id, actorUser: req.auth.userId, reason: "Order creation rollback" });
        }
      } catch (_) { /* best effort; sweeper handles reserved orders */ }
      try {
        const { releaseCoupon } = require("../services/coupon.service");
        if (order.couponReservationId) await releaseCoupon(order.couponReservationId, "Order creation rollback");
      } catch (_) { /* best effort; coupon sweeper handles stale reservations */ }
      await Order.deleteOne({ _id: order._id });
    }
    throw err;
  }

  res.status(201).json({ order });
});

// GET /api/orders — the current customer's own orders only, newest first.
// Always scoped to req.auth.userId — never accepts a userId from the
// client, so there's no way to request someone else's orders.
const listMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  // An order is only ever shown to the customer once payment is verified —
  // see Order.js's paymentVerifiedAt and payment.controller.js's
  // settlePaidPayment. This filter is not optional/overridable by the client.
  const filter = { user: req.auth.userId, paymentVerifiedAt: { $ne: null } };
  if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  const items = await attachPaymentStatus(orders);

  res.json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
});

// GET /api/orders/:id — must belong to the requesting customer. Returns
// 404 (not 403) for someone else's order id, so this endpoint can't be
// used to probe which order ids exist.
const getMyInvoice = asyncHandler(async (req, res) => {
  const invoice = await getOrCreateInvoice(req.params.id, req.auth.userId);
  res.json({ invoice });
});

const getMyOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.auth.userId, paymentVerifiedAt: { $ne: null } });
  if (!order) throw ApiError.notFound("Order not found.");
  const [withPaymentStatus] = await attachPaymentStatus([order]);
  res.json({ order: withPaymentStatus });
});

const cancelMyOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.auth.userId });
  if (!order) throw ApiError.notFound("Order not found.");
  if (!["pending", "confirmed"].includes(order.status)) {
    throw ApiError.conflict(`This order cannot be cancelled in "${order.status}" status.`);
  }

  const payments = await Payment.find({ order: order._id }).sort({ createdAt: -1 });
  const paidPayment = payments.find((payment) =>
    payment.status === "paid" &&
    payment.refundStatus !== "pending" &&
    Number(payment.refundedAmount || 0) < Number(payment.amount || 0)
  );

  if (paidPayment) {
    const { createCashfreeRefund, REFUND_STATUS } = require("../services/cashfree.service");
    const { buildRefundId } = require("./payment.controller");
    const claimed = await Payment.findOneAndUpdate(
      { _id: paidPayment._id, status: "paid", refundStatus: { $in: ["none", "failed"] } },
      { $set: { refundStatus: "pending", refundInitiatedAt: new Date(), refundReason: req.body?.reason || "Customer cancellation" } },
      { new: true }
    );
    if (!claimed) throw ApiError.conflict("A refund is already being processed for this payment.");
    try {
      // Amount is derived server-side from the payment record, never from
      // the request body — a customer cancelling an order has no say in how
      // much comes back. The refund id is deterministic, so a retried
      // cancellation resolves to the same Cashfree refund instead of a
      // second one.
      const refundAmount = Number(paidPayment.amount) - Number(paidPayment.refundedAmount || 0);
      const refund = await createCashfreeRefund({
        orderId: paidPayment.gatewayOrderId,
        refundId: buildRefundId(paidPayment, "cancel"),
        amountInRupees: refundAmount,
        note: req.body?.reason || "Customer cancellation",
      });
      claimed.status = "refunded";
      claimed.refundStatus = refund.refund_status === REFUND_STATUS.SUCCESS ? "processed" : "pending";
      claimed.gatewayRefundId = refund.refund_id || refund.cf_refund_id || null;
      claimed.refundedAmount = Number(refund.refund_amount || 0);
      claimed.refundedAt = refund.refund_status === REFUND_STATUS.SUCCESS ? new Date() : null;
      await claimed.save();
    } catch (err) {
      await Payment.updateOne({ _id: paidPayment._id }, { $set: { refundStatus: "failed", failureReason: err.message } });
      throw ApiError.badGateway("The refund could not be initiated. The order remains active.");
    }

    const { restoreConsumedOrderStock } = require("../services/stock.service");
    await restoreConsumedOrderStock(order, { actorUser: req.auth.userId, reason: "Customer cancellation after payment" });
    if (order.couponReservationId) await releaseCoupon(order.couponReservationId, "Customer cancellation");
  } else {
    await require("../services/stock.service").releaseOrderReservation(order, "Order cancelled by customer");
    if (order.couponReservationId) await releaseCoupon(order.couponReservationId, "Order cancelled by customer");
  }

  const updated = await transitionOrder(order, "cancelled", {
    actorType: "customer",
    actorId: req.auth.userId,
    note: req.body?.reason || "Cancelled by customer",
  });
  const [withPaymentStatus] = await attachPaymentStatus([updated]);
  try {
    const user = await User.findById(req.auth.userId).select("email").lean();
    if (user?.email) await sendTransactionalEmail("cancellation", user.email, { orderId:updated._id, reason:updated.cancelReason }, `order:${updated._id}:cancelled`);
  } catch (_) {}
  res.json({ order: withPaymentStatus });
});

module.exports = { placeOrder, listMyOrders, getMyOrderById, getMyInvoice, cancelMyOrder };
