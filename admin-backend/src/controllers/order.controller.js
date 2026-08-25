const Order = require("../models/Order");
const Payment = require("../models/Payment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { OBJECT_ID_RE } = require("../validators/order.validators");
const { transitionOrder } = require("../services/orderLifecycle.service");
const { releaseOrderStock, restoreConsumedOrderStock } = require("../services/inventory.service");
const { releaseCoupon, rollbackConsumedCoupon } = require("../services/coupon.service");
const { initiateRefund } = require("../services/refund.service");
const { uploadDocumentBuffer, destroyDocument } = require("../services/upload.service");

const SORT_NEWEST = { createdAt: -1 };

async function attachPaymentStatus(orders) {
  if (!orders.length) return [];
  const orderIds = orders.map((o) => o._id);
  const payments = await Payment.find({ order: { $in: orderIds } }).sort({ createdAt: -1 });
  const statusByOrder = new Map();
  for (const payment of payments) {
    const key = String(payment.order);
    if (!statusByOrder.has(key)) statusByOrder.set(key, payment.status);
    if (payment.status === "paid") statusByOrder.set(key, "paid");
  }
  return orders.map((order) => ({ ...order.toJSON(), paymentStatus: statusByOrder.get(String(order._id)) || "unpaid" }));
}

// Gap fixed (see PROGRESS_ORDER_SIMPLIFICATION.md): placeOrder creates the
// Order row in storefront-backend BEFORE payment (status "pending",
// paymentVerifiedAt null) so the reservation/pricing/coupon machinery has
// something to hang off of during checkout. If the customer never pays —
// abandons checkout, payment fails, reservation expires — that draft row
// can still sit in the `orders` collection. Per the target model's own
// definition of "pending" ("payment verified, awaiting admin confirmation")
// and its hard rule #1 ("no unpaid order state ... is ever shown"), admin
// must never see these. `list`/`getById` previously had no such filter —
// only the dashboard aggregates did — so an admin could see, and even
// confirm/cancel, an order nobody ever paid for. Every admin-facing read
// below now hard-filters on paymentVerifiedAt, the same single gate
// storefront-backend's listMyOrders already uses for the customer's side.
const PAID_ORDER_FILTER = { paymentVerifiedAt: { $ne: null } };

const list = asyncHandler(async (req, res) => {
  const { page, limit, status, search } = req.query;
  const filter = { ...PAID_ORDER_FILTER };
  if (status) filter.status = status;
  if (search) filter._id = OBJECT_ID_RE.test(search) ? search : null;
  const [orders, total] = await Promise.all([
    Order.find(filter).populate("user", "name email").sort(SORT_NEWEST).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ items: await attachPaymentStatus(orders), page, limit, total, totalPages: Math.ceil(total / limit) });
});

const getById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...PAID_ORDER_FILTER }).populate("user", "name email");
  if (!order) throw ApiError.notFound("Order not found.");
  const [withPaymentStatus] = await attachPaymentStatus([order]);
  res.json({ order: withPaymentStatus });
});

async function transition(req, res, to) {
  const order = await Order.findOne({ _id: req.params.id, ...PAID_ORDER_FILTER });
  if (!order) throw ApiError.notFound("Order not found.");
  const updated = await transitionOrder(order, to, { actorType: "admin", actorId: req.admin?._id || null, note: req.body?.note || null });
  res.json({ order: updated });
}

// Admin's role is exactly three actions on an order, in this order:
// confirm (pending -> confirmed), ship (confirmed -> shipped, with
// courier + tracking), or cancel (pending/confirmed -> cancelled).
// Nothing else — see PROGRESS_ORDER_SIMPLIFICATION.md.
const confirm = asyncHandler((req, res) => transition(req, res, "confirmed"));

const ship = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...PAID_ORDER_FILTER });
  if (!order) throw ApiError.notFound("Order not found.");
  if (order.status !== "confirmed") throw ApiError.conflict(`Cannot ship an order in "${order.status}" status — it must be confirmed first.`);
  const updated = await transitionOrder(order, "shipped", { actorType: "admin", actorId: req.admin?._id || null, note: `${req.body.courierName} / ${req.body.trackingId}` });
  updated.courierName = req.body.courierName;
  updated.trackingId = req.body.trackingId;

  // Bill upload is optional at ship time — the admin can also add or
  // replace it later via POST /:id/bill (uploadBill below).
  if (req.file) {
    const uploaded = await uploadDocumentBuffer(req.file.buffer, "rns-bills", req.file.originalname);
    updated.billUrl = uploaded.url;
    updated.billPublicId = uploaded.publicId;
    updated.billUploadedAt = new Date();
  }

  await updated.save();
  res.json({ order: updated });
});

// POST /:id/bill — upload or replace the bill/invoice file for an order,
// independent of the ship action above (e.g. the admin forgot it at ship
// time, or needs to correct/replace a previously uploaded file).
const uploadBill = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...PAID_ORDER_FILTER });
  if (!order) throw ApiError.notFound("Order not found.");
  if (!req.file) throw ApiError.badRequest("No bill file was uploaded.");

  const uploaded = await uploadDocumentBuffer(req.file.buffer, "rns-bills", req.file.originalname);
  const previousPublicId = order.billPublicId;

  order.billUrl = uploaded.url;
  order.billPublicId = uploaded.publicId;
  order.billUploadedAt = new Date();
  await order.save();

  // Best-effort cleanup of the replaced file — never blocks the response.
  if (previousPublicId) destroyDocument(previousPublicId).catch(() => {});

  res.json({ order });
});

const cancel = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...PAID_ORDER_FILTER });
  if (!order) throw ApiError.notFound("Order not found.");
  if (!["pending", "confirmed"].includes(order.status)) throw ApiError.conflict(`Cannot cancel an order in "${order.status}" status.`);

  const paidPayment = await Payment.findOne({ order: order._id, status: "paid" });
  if (paidPayment) {
    await initiateRefund(paidPayment, { reason: req.body.reason || "Order cancelled by admin", actorId: req.admin?._id || null });
    await restoreConsumedOrderStock(order, { actorUser: req.admin?._id || null, reason: "Order cancelled and refund initiated" });
    await rollbackConsumedCoupon(order._id, "Order cancelled");
  } else {
    await releaseOrderStock(order, { actorUser: req.admin?._id || null, reason: "Order cancelled" });
    if (order.couponReservationId) await releaseCoupon(order.couponReservationId, "Order cancelled");
  }
  const updated = await transitionOrder(order, "cancelled", { actorType: "admin", actorId: req.admin?._id || null, note: req.body.reason || "Order cancelled" });
  res.json({ order: updated });
});

module.exports = { list, getById, confirm, ship, cancel, uploadBill };
