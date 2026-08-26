const crypto = require("crypto");

const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");
const WebhookEvent = require("../models/WebhookEvent");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { env } = require("../config/env");
const { sendTransactionalEmail } = require("../services/email.service");
const { calculateStoredOrderPricing, pricingMatchesOrder } = require("../services/pricing.service");
const { consumeOrderReservation, releaseFailedPaymentReservation, reclaimExpiredReservation } = require("../services/stock.service");
const { consumeCoupon, releaseCoupon } = require("../services/coupon.service");
const { transitionOrder } = require("../services/orderLifecycle.service");
const { SETTLEABLE_FROM, assertTransition, isSettled } = require("../services/paymentState");
const {
  createCashfreeOrder,
  getCashfreeOrder,
  listCashfreeOrderPayments,
  createCashfreeRefund,
  verifyWebhookSignature,
  webhookEventKey,
  findSuccessfulPayment,
  normalizePaymentMethod,
  ORDER_STATUS,
  PAYMENT_STATUS,
  REFUND_STATUS,
  WEBHOOK_TYPES,
  CASHFREE_WEBHOOK_VERSION,
} = require("../services/cashfree.service");

// Rupee comparisons have to tolerate float representation (0.1 + 0.2 style
// drift) without tolerating an actual discrepancy. One paise is well below
// the smallest amount anyone can be charged and well above float error.
const AMOUNT_EPSILON = 0.01;

// Order statuses from which a payment attempt may still be started. Mirrors
// ORDER_STATUSES in models/Order.js — ["pending","confirmed","shipped",
// "cancelled"] — deliberately naming only the two that make sense to charge.
const PAYABLE_ORDER_STATUSES = ["pending", "confirmed"];

function amountsMatch(a, b) {
  return Math.abs(Number(a) - Number(b)) < AMOUNT_EPSILON;
}

/**
 * Build the gateway order id we hand to Cashfree.
 *
 * Generated server-side, never accepted from a client, and unique per
 * attempt because Cashfree rejects a reused order_id. The local order id is
 * embedded so a support engineer looking at the Cashfree dashboard can map a
 * transaction back to an order without a lookup, and the random suffix keeps
 * retries distinct. Stays inside Cashfree's identifier constraints
 * (alphanumeric plus underscore, comfortably under the length cap).
 */
function buildGatewayOrderId(orderId) {
  return `rns_${String(orderId)}_${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * Deterministic refund identifier.
 *
 * Cashfree treats refund_id as the idempotency key for Create Refund, so
 * deriving it from local state (rather than randomising it) is what stops a
 * retried refund call from issuing a second refund: replaying the same id
 * returns the existing refund instead of creating another one.
 */
function buildRefundId(payment, suffix = "full") {
  return `rfnd_${String(payment._id)}_${suffix}`.slice(0, 40);
}

/**
 * The only payment shape that ever reaches a browser.
 *
 * Deliberately a whitelist rather than a redaction pass: a whitelist fails
 * closed when a field is added to the schema later, which is exactly the
 * failure mode that matters for a payments API.
 */
function publicPaymentView(payment) {
  if (!payment) return null;
  return {
    id: payment._id || payment.id || null,
    order: payment.order || null,
    amount: Number(payment.amount || 0),
    currency: payment.currency || "INR",
    status: payment.status || "created",
    method: payment.method || null,
    refundStatus: payment.refundStatus || "none",
    refundedAmount: Number(payment.refundedAmount || 0),
    failureReason: payment.failureReason || null,
    verifiedAt: payment.verifiedAt || null,
    refundedAt: payment.refundedAt || null,
    createdAt: payment.createdAt || null,
  };
}

/**
 * Settle a payment as paid — exactly once.
 *
 * Three callers can race here: the customer returning from checkout, the
 * Cashfree webhook, and the reconciliation sweep. Previously the claiming
 * update matched any non-refunded row, so every one of them proceeded into
 * the side effects and correctness rested on each individual side effect
 * being idempotent. That works until one of them isn't.
 *
 * The claim below only matches a payment that has not yet settled, so the
 * status transition itself elects a single winner at the database level. The
 * losers fall through to the idempotent-return path and touch nothing. The
 * downstream operations remain individually idempotent as defence in depth,
 * not as the primary guarantee.
 */
async function settlePaidPayment(payment, { gatewayPaymentId = null, method = null, gatewayStatus = null } = {}) {
  const currentOrder = await Order.findById(payment.order);
  if (!currentOrder) throw ApiError.notFound("Order not found.");

  // There is no time limit on confirming a payment. reservationExpiresAt is
  // only a hint for the sweeper; reservationStatus is what actually tells us
  // whether the stock is still held. Callers (verifyPayment/webhook/
  // reconciliation) are expected to have already tried reclaimExpiredReservation
  // before calling this — if the status is still "released"/"expired" here,
  // the stock is genuinely gone, not merely late.
  if (currentOrder.reservationStatus === "released" || currentOrder.reservationStatus === "expired") {
    throw ApiError.conflict("This item is no longer in stock.");
  }

  if (payment.status) assertTransition(payment.status, "paid");

  const update = {
    $set: {
      status: "paid",
      gatewayPaymentId: gatewayPaymentId || payment.gatewayPaymentId,
      method: method || payment.method || null,
      verifiedAt: payment.verifiedAt || new Date(),
      failureReason: null,
      gatewayStatus: gatewayStatus || PAYMENT_STATUS.SUCCESS,
    },
  };

  // The concurrency gate. `status: { $in: SETTLEABLE_FROM }` means a payment
  // that is already "paid" or "refunded" cannot be claimed a second time.
  let saved = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $in: SETTLEABLE_FROM } },
    update,
    { new: true }
  );
  if (saved === undefined) {
    // Model layer without findOneAndUpdate (unit-test doubles, and the
    // rolling-upgrade case the original code allowed for). Fall back to a
    // direct write; the caller-side guards still apply.
    Object.assign(payment, update.$set);
    if (typeof payment.save === "function") await payment.save();
    saved = payment;
  } else if (!saved) {
    // Lost the race, or already settled. Someone else has run — or is
    // running — the side effects below. Return current state and stop.
    return Payment.findById(payment._id);
  }

  const paidOrder = await Order.findById(payment.order);
  if (paidOrder) {
    await consumeOrderReservation(paidOrder);
    if (paidOrder.couponReservationId) await consumeCoupon(paidOrder.couponReservationId);
    // The single gate that makes this order exist for the customer:
    // it only appears in "My Orders" / counts toward admin dashboard
    // revenue once this is set. Set once, never unset, never touched
    // anywhere else in either backend.
    if (!paidOrder.paymentVerifiedAt) {
      await Order.updateOne({ _id: paidOrder._id, paymentVerifiedAt: null }, { $set: { paymentVerifiedAt: new Date() } });
      paidOrder.paymentVerifiedAt = new Date();
    }
    try {
      const user = await User.findById(paidOrder.user).select("email").lean();
      if (user?.email) {
        // eventKey is unique-indexed on EmailLog, so even if two settlement
        // attempts somehow both reached here the customer still receives one
        // confirmation.
        await sendTransactionalEmail("payment-confirmation", user.email, {
          orderId: paidOrder._id, amount: saved.amount
        }, `payment:${saved._id}:confirmed`);
      }
    } catch (_) { /* email queue failure must never change payment state */ }
  }
  return saved;
}

async function failPayment(payment, reason, status = "failed") {
  let saved = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: ["paid", "refunded"] } },
    { $set: { status, failureReason: reason, gatewayStatus: status === "expired" ? ORDER_STATUS.EXPIRED : PAYMENT_STATUS.FAILED } },
    { new: true }
  );
  if (saved === undefined) {
    payment.status = status;
    payment.failureReason = reason;
    payment.gatewayStatus = status === "expired" ? ORDER_STATUS.EXPIRED : PAYMENT_STATUS.FAILED;
    if (typeof payment.save === "function") await payment.save();
    saved = payment;
  } else if (!saved) {
    return Payment.findById(payment._id);
  }
  await releaseFailedPaymentReservation(payment.order, reason);
  const order = await Order.findById(payment.order);
  if (order?.couponReservationId) await releaseCoupon(order.couponReservationId, reason);
  if (order && ["pending", "confirmed"].includes(order.status) && order.reservationStatus !== "consumed") {
    try { await transitionOrder(order, "cancelled", { actorType: "system", note: reason }); } catch (_) {}
  }
  return saved;
}

/**
 * Money was taken but the goods are gone — refund it without waiting for a
 * human. Shared by the three paths that can discover this (customer return,
 * webhook, reconciliation) so the compensating logic exists once.
 *
 * The refund id is deterministic, so if two of those paths reach this at the
 * same moment Cashfree still only issues one refund.
 */
async function autoRefundOutOfStock(payment, { gatewayOrderId, gatewayPaymentId, reason }) {
  try {
    const refund = await createCashfreeRefund({
      orderId: gatewayOrderId,
      refundId: buildRefundId(payment, "stockout"),
      amountInRupees: Number(payment.amount),
      note: reason,
    });
    payment.status = "refunded";
    payment.refundStatus = refund.refund_status === REFUND_STATUS.SUCCESS ? "processed" : "pending";
    payment.gatewayPaymentId = gatewayPaymentId || payment.gatewayPaymentId;
    payment.gatewayRefundId = refund.refund_id || refund.cf_refund_id || null;
    payment.refundedAmount = Number(refund.refund_amount || 0);
    payment.refundInitiatedAt = new Date();
    payment.refundedAt = refund.refund_status === REFUND_STATUS.SUCCESS ? new Date() : null;
    payment.refundReason = "Out of stock — order cancelled";
    payment.failureReason = "Item went out of stock after payment; refund initiated.";
    if (typeof payment.save === "function") await payment.save();
    return true;
  } catch (_) {
    // The refund call failed. The payment stays in its non-paid state so it
    // surfaces in the admin payments list for manual follow-up rather than
    // being quietly forgotten.
    return false;
  }
}

// POST /api/payments/create-order
const createPaymentOrder = asyncHandler(async (req, res) => {
  // Authorization: the order is fetched BY the authenticated user id, so an
  // order belonging to someone else simply does not resolve. req.body.userId
  // is never consulted — the only identity that counts is the one the auth
  // middleware established.
  let order = await Order.findOne({ _id: req.body.orderId, user: req.auth.userId });
  if (!order) throw ApiError.notFound("Order not found.");

  // Order-state gate, written as an ALLOWLIST rather than a denylist.
  // A denylist has to be updated every time a status is added, and silently
  // starts permitting payment on the new one until someone remembers — which
  // is the wrong failure direction for a payments endpoint. Only an order
  // that is still awaiting fulfilment may be paid for; "shipped" and
  // "cancelled" both fall through to the rejection below.
  if (!PAYABLE_ORDER_STATUSES.includes(order.status)) {
    throw ApiError.conflict("This order can no longer be paid for.");
  }
  const existingPaid = await Payment.findOne({ order: order._id, status: { $in: ["paid", "refunded"] } });
  if (existingPaid) throw ApiError.conflict("This order has already been paid for.");

  // Resume an in-flight attempt rather than opening a second one. Cashfree
  // hands back a fresh payment_session_id for an ACTIVE order, so the session
  // token itself is never persisted — it is a bearer capability to pay, and
  // re-fetching it costs one API call.
  const existingAttempt = await Payment.findOne({ order: order._id, status: "created", expiresAt: { $gt: new Date() } });
  if (existingAttempt?.gatewayOrderId) {
    try {
      const remote = await getCashfreeOrder(existingAttempt.gatewayOrderId);
      if (remote?.order_status === ORDER_STATUS.ACTIVE && remote.payment_session_id) {
        return res.status(200).json({
          payment: publicPaymentView(existingAttempt),
          gatewayOrderId: existingAttempt.gatewayOrderId,
          paymentSessionId: remote.payment_session_id,
          amount: Number(existingAttempt.amount),
          currency: existingAttempt.currency || "INR",
          mode: env.cashfree.environment,
        });
      }
    } catch (_) {
      // Couldn't resume (expired, terminated, or gateway unreachable) —
      // fall through and open a fresh attempt below.
    }
  }

  // No arbitrary time cutoff for starting/resuming a payment attempt either —
  // only try to reclaim the stock if it was actually released back to the
  // pool. If someone else has since bought it, that's a real conflict.
  if (order.reservationStatus && order.reservationStatus !== "reserved") {
    const reclaimed = await reclaimExpiredReservation(order);
    if (!reclaimed) throw ApiError.conflict("An item in this order is no longer in stock. Please place the order again.");
  }

  // Amount is derived from stored order state and cross-checked against the
  // persisted total. Nothing in req.body contributes to it.
  const calculated = calculateStoredOrderPricing(order);
  if (!pricingMatchesOrder(order, calculated)) throw ApiError.conflict("This order price is no longer internally consistent. Please restart checkout.");

  const lockUntil = new Date(Date.now() + 30000);
  if (typeof Order.findOneAndUpdate === "function") {
    const locked = await Order.findOneAndUpdate(
      {
        _id: order._id,
        user: req.auth.userId,
        $or: [{ paymentCreationLockUntil: null }, { paymentCreationLockUntil: { $lte: new Date() } }],
      },
      { $set: { paymentCreationLockUntil: lockUntil } },
      { new: true }
    );
    if (locked === null) {
      const retry = await Payment.findOne({ order: order._id, status: "created", expiresAt: { $gt: new Date() } });
      if (retry) {
        return res.status(200).json({
          payment: publicPaymentView(retry),
          gatewayOrderId: retry.gatewayOrderId,
          paymentSessionId: null,
          amount: Number(retry.amount),
          currency: retry.currency,
          mode: env.cashfree.environment,
        });
      }
      throw ApiError.conflict("Another payment attempt is already being created. Please retry shortly.");
    }
    if (locked) order = locked;
  }

  try {
    const finalAmount = calculated.total;
    const gatewayOrderId = buildGatewayOrderId(order._id);

    const paymentTimeout = new Date(Date.now() + env.paymentTimeoutMinutes * 60 * 1000);
    const expiresAt = order.reservationExpiresAt && new Date(order.reservationExpiresAt) < paymentTimeout
      ? order.reservationExpiresAt
      : paymentTimeout;

    const customer = await User.findById(req.auth.userId).select("name email phone").lean();
    const cashfreeOrder = await createCashfreeOrder({
      orderId: gatewayOrderId,
      amountInRupees: finalAmount,
      currency: "INR",
      customer: {
        // Cashfree wants a stable customer identifier; the internal user id
        // is already opaque to the outside world.
        id: String(req.auth.userId),
        phone: customer?.phone || order.shippingAddress?.phone || "",
        email: customer?.email || "",
        name: customer?.name || order.shippingAddress?.name || "",
      },
      returnUrl: env.cashfree.returnUrl || undefined,
      notifyUrl: env.cashfree.notifyUrl || undefined,
      expiresAt,
      note: `Order ${order._id}`,
    });

    // Trust nothing, including the gateway: if what Cashfree echoes back
    // doesn't match what we asked for, the attempt is abandoned rather than
    // recorded.
    if (!amountsMatch(cashfreeOrder.order_amount, finalAmount) || cashfreeOrder.order_currency !== "INR") {
      throw ApiError.conflict("Cashfree amount does not match the server-calculated order total.");
    }
    if (cashfreeOrder.order_id !== gatewayOrderId) {
      throw ApiError.conflict("Cashfree returned a different order id than requested.");
    }
    if (!cashfreeOrder.payment_session_id) {
      throw ApiError.badGateway("Cashfree did not return a payment session.");
    }

    const payment = await Payment.findOneAndUpdate(
      { order: order._id, status: "created", activeAttemptKey: String(order._id) },
      {
        $set: {
          gateway: Payment.ACTIVE_GATEWAY || "cashfree",
          gatewayOrderId,
          gatewayStatus: cashfreeOrder.order_status || ORDER_STATUS.ACTIVE,
          amount: finalAmount,
          currency: cashfreeOrder.order_currency,
          expiresAt,
          creationLockExpiresAt: null,
          activeAttemptKey: null,
        },
        $setOnInsert: {
          order: order._id,
          user: req.auth.userId,
          status: "created",
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // If the deployment uses a schema without the new attempt fields during
    // a rolling upgrade, fall back to a normal create.
    const finalPayment = payment || await Payment.create({
      order: order._id,
      user: req.auth.userId,
      gateway: "cashfree",
      gatewayOrderId,
      gatewayStatus: cashfreeOrder.order_status || ORDER_STATUS.ACTIVE,
      amount: finalAmount,
      currency: cashfreeOrder.order_currency || "INR",
      status: "created",
      expiresAt,
    });

    // Response carries the payment session and nothing else the browser has
    // no use for. The Cashfree secret key and app id never leave the server;
    // unlike the previous integration, the v3 Web Checkout SDK needs only
    // the session id and the environment name.
    res.status(201).json({
      payment: publicPaymentView(finalPayment),
      gatewayOrderId,
      paymentSessionId: cashfreeOrder.payment_session_id,
      amount: Number(cashfreeOrder.order_amount),
      currency: cashfreeOrder.order_currency,
      mode: env.cashfree.environment,
    });
  } finally {
    Promise.resolve(Order.updateOne({ _id: order._id }, { $set: { paymentCreationLockUntil: null } })).catch(() => {});
  }
});

/**
 * POST /api/payments/verify
 *
 * The browser no longer supplies any evidence of payment. Cashfree's Web
 * Checkout does not hand the client a signed success payload, and that is an
 * improvement rather than a gap: this endpoint takes only a gateway order id
 * the caller must already own, then asks Cashfree directly what happened.
 * The client's role is reduced to "checkout closed, please look now".
 */
const verifyPayment = asyncHandler(async (req, res) => {
  const { gatewayOrderId } = req.body;

  // Ownership is enforced in the query. A gateway order id belonging to
  // another customer resolves to nothing and returns the same 404 as an id
  // that never existed, so this endpoint cannot be used to probe for the
  // existence of other people's payments.
  const payment = await Payment.findOne({ gatewayOrderId, user: req.auth.userId });
  if (!payment) throw ApiError.notFound("Payment not found.");

  // Idempotent: re-verifying a settled payment is a no-op success, not a
  // second settlement.
  if (isSettled(payment.status)) return res.json({ payment: publicPaymentView(payment) });

  const remoteOrder = await getCashfreeOrder(gatewayOrderId);
  const remotePayments = await listCashfreeOrderPayments(gatewayOrderId);
  const captured = findSuccessfulPayment(remotePayments);

  if (!captured) {
    // No successful payment at Cashfree. Distinguish "still in flight" from
    // "definitively over" — a pending payment must not be marked failed,
    // because it may yet succeed.
    const stillOpen = remoteOrder?.order_status === ORDER_STATUS.ACTIVE
      || (remotePayments || []).some((p) => p?.payment_status === PAYMENT_STATUS.PENDING);
    if (stillOpen) {
      return res.status(202).json({ payment: publicPaymentView(payment), status: "pending" });
    }
    await failPayment(payment, "Cashfree reports no successful payment for this order.");
    throw ApiError.badRequest("Payment verification failed.");
  }

  // Cross-checks before any money is considered received. Each of these is a
  // separate way a payment could be aimed at the wrong order or the wrong
  // amount, so each is rejected independently.
  if (captured.order_id && captured.order_id !== gatewayOrderId) {
    throw ApiError.conflict("This payment belongs to a different order.");
  }
  if (!amountsMatch(captured.payment_amount, payment.amount)) {
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { failureReason: "Amount mismatch between Cashfree payment and stored order total; flagged for investigation.", gatewayStatus: "AMOUNT_MISMATCH" } }
    );
    throw ApiError.conflict("Payment amount does not match this order. This payment has been flagged for review.");
  }
  if (captured.payment_currency && captured.payment_currency !== (payment.currency || "INR")) {
    throw ApiError.conflict("Payment currency does not match this order.");
  }

  const order = await Order.findById(payment.order);
  if (!order) {
    await failPayment(payment, "Order not found.", "expired");
    throw ApiError.conflict("Order not found.");
  }

  // Verification has no time limit — the customer can confirm whenever
  // they come back. If the reservation lapsed and stock was released back
  // to the pool in the meantime, try to reclaim the same quantities now.
  if (order.reservationStatus && !(await reclaimExpiredReservation(order))) {
    // Only a genuine stock-out (not elapsed time) reaches here. Cashfree
    // already collected the money at this point, so refund it automatically
    // and make sure the customer can see what happened to their order.
    await failPayment(payment, "Item went out of stock before payment could be confirmed; refund initiated.", "expired");
    await autoRefundOutOfStock(payment, {
      gatewayOrderId,
      gatewayPaymentId: captured.cf_payment_id,
      reason: "Out of stock after payment capture",
    });
    // The order is now paid-then-cancelled, not "never paid" — make sure it
    // shows up in the customer's order history (with paymentStatus: "refunded")
    // instead of silently disappearing.
    await Order.updateOne({ _id: order._id, paymentVerifiedAt: null }, { $set: { paymentVerifiedAt: new Date() } });
    throw ApiError.conflict("This item went out of stock before your payment could be confirmed. It has been refunded automatically — check your order history for details.");
  }

  const updated = await settlePaidPayment(payment, {
    gatewayPaymentId: captured.cf_payment_id,
    method: normalizePaymentMethod(captured),
    gatewayStatus: captured.payment_status,
  });
  res.json({ payment: publicPaymentView(updated) });
});

/**
 * POST /api/payments/webhook
 *
 * Mounted in app.js ahead of the JSON body parser with express.raw(), and
 * outside the authenticated router — Cashfree calls this with no session.
 * Everything below runs only after the signature over the raw bytes checks
 * out.
 */
const webhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-webhook-signature"];
  const timestamp = req.headers["x-webhook-timestamp"];
  const webhookVersion = req.headers["x-webhook-version"];

  // Signature covers `timestamp + rawBody`, so this simultaneously rejects
  // forged payloads and replays of a genuine one outside the freshness window.
  if (!verifyWebhookSignature({ rawBody: req.body, signature, timestamp, webhookVersion })) {
    throw ApiError.badRequest("Invalid webhook signature.");
  }

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body));
  } catch (_) {
    throw ApiError.badRequest("Malformed webhook payload.");
  }
  if (!event || typeof event !== "object" || !event.type) {
    throw ApiError.badRequest("Malformed webhook payload.");
  }

  const knownTypes = Object.values(WEBHOOK_TYPES);
  if (!knownTypes.includes(event.type)) {
    // Acknowledged so Cashfree stops retrying, but never acted on. Silently
    // 200-ing an unknown event without recording it would make a newly
    // enabled event type invisible.
    await recordWebhookEvent(event, { status: "ignored" });
    return res.json({ received: true, handled: false });
  }

  // Idempotency gate. Insert-then-process, so two concurrent deliveries of
  // the same event race on a unique index and exactly one proceeds.
  const claim = await claimWebhookEvent(event);
  if (!claim.claimed) return res.json({ received: true, duplicate: true });

  try {
    if (event.type === WEBHOOK_TYPES.REFUND_STATUS) {
      await handleRefundWebhook(event);
    } else {
      await handlePaymentWebhook(event);
    }
    await finishWebhookEvent(claim.record, "processed");
  } catch (err) {
    await finishWebhookEvent(claim.record, "failed", err?.message);
    throw err;
  }

  res.json({ received: true });
});

async function claimWebhookEvent(event) {
  const eventKey = webhookEventKey(event);
  try {
    const record = await WebhookEvent.create({
      gateway: "cashfree",
      eventKey,
      type: event.type,
      gatewayOrderId: event?.data?.order?.order_id || event?.data?.refund?.order_id || null,
      gatewayPaymentId: event?.data?.payment?.cf_payment_id || event?.data?.refund?.cf_payment_id || null,
      status: "processing",
    });
    return { claimed: true, record };
  } catch (err) {
    // 11000 is the unique index on eventKey doing its job: this exact event
    // has already been claimed by an earlier (or concurrent) delivery.
    if (err?.code === 11000) {
      // ...but "already claimed" is not the same as "already handled". If the
      // previous attempt FAILED (a transient database or downstream error),
      // the row is a tombstone that would make Cashfree's retry — the very
      // mechanism meant to recover from that failure — get skipped as a
      // duplicate, stranding the payment permanently. So a failed row is
      // re-claimable; a "processing" or "processed" one is not.
      const reclaimed = await WebhookEvent.findOneAndUpdate(
        { eventKey, status: "failed" },
        { $set: { status: "processing", error: null } },
        { new: true }
      );
      if (reclaimed) return { claimed: true, record: reclaimed };
      return { claimed: false, record: null };
    }
    // A model double without a working create() (unit tests) shouldn't
    // disable webhook handling; fall through and process.
    if (!WebhookEvent.create) return { claimed: true, record: null };
    throw err;
  }
}

async function recordWebhookEvent(event, { status }) {
  try {
    await WebhookEvent.create({
      gateway: "cashfree",
      eventKey: webhookEventKey(event),
      type: event.type || "UNKNOWN",
      status,
      processedAt: new Date(),
    });
  } catch (_) { /* duplicate or unavailable — nothing to do */ }
}

async function finishWebhookEvent(record, status, error = null) {
  if (!record) return;
  try {
    record.status = status;
    record.processedAt = new Date();
    // Truncated: a failure note is useful, an unbounded error body in the
    // database is not.
    if (error) record.error = String(error).slice(0, 300);
    if (typeof record.save === "function") await record.save();
  } catch (_) {}
}

async function handlePaymentWebhook(event) {
  const paymentEntity = event?.data?.payment;
  const orderEntity = event?.data?.order;
  if (!paymentEntity || !orderEntity?.order_id) return;

  const payment = await Payment.findOne({ gatewayOrderId: orderEntity.order_id });
  // Not ours (or not ours yet) — acknowledge without acting.
  if (!payment) return;

  if (event.type === WEBHOOK_TYPES.PAYMENT_SUCCESS && paymentEntity.payment_status === PAYMENT_STATUS.SUCCESS) {
    // Amount check applies to the webhook too — a signed webhook proves it
    // came from Cashfree, not that it is for the right amount.
    if (!amountsMatch(paymentEntity.payment_amount, payment.amount)) {
      await Payment.updateOne(
        { _id: payment._id },
        { $set: { failureReason: "Webhook amount mismatch; flagged for investigation.", gatewayStatus: "AMOUNT_MISMATCH" } }
      );
      return;
    }

    // Backfill a method onto an already-settled payment without re-running
    // settlement — the customer-return path often wins the race and may not
    // have captured it.
    if (payment.status === "paid" && !payment.method) {
      const method = normalizePaymentMethod(paymentEntity);
      if (method) {
        payment.method = method;
        if (typeof payment.save === "function") await payment.save();
      }
    }

    if (!isSettled(payment.status)) {
      const order = await Order.findById(payment.order);
      // Reclaim before attempting to settle, same as verifyPayment — no
      // time cutoff, only a real stock-out should fail this.
      if (order?.reservationStatus) await reclaimExpiredReservation(order);
      try {
        await settlePaidPayment(payment, {
          gatewayPaymentId: paymentEntity.cf_payment_id,
          method: normalizePaymentMethod(paymentEntity),
          gatewayStatus: paymentEntity.payment_status,
        });
      } catch (_) {
        await failPayment(payment, "Item was out of stock when the payment succeeded.", "expired");
        await autoRefundOutOfStock(payment, {
          gatewayOrderId: orderEntity.order_id,
          gatewayPaymentId: paymentEntity.cf_payment_id,
          reason: "Out of stock after payment capture",
        });
        // Make sure this shows up for the customer as a refunded order
        // instead of vanishing because paymentVerifiedAt was never set.
        await Order.updateOne({ _id: payment.order, paymentVerifiedAt: null }, { $set: { paymentVerifiedAt: new Date() } });
      }
    }
    return;
  }

  if (
    (event.type === WEBHOOK_TYPES.PAYMENT_FAILED || event.type === WEBHOOK_TYPES.PAYMENT_USER_DROPPED)
    && !isSettled(payment.status)
  ) {
    await failPayment(payment, paymentEntity.payment_message || "Payment failed.");
  }
}

async function handleRefundWebhook(event) {
  const refundEntity = event?.data?.refund;
  if (!refundEntity?.order_id) return;

  const payment = await Payment.findOne({ gatewayOrderId: refundEntity.order_id });
  if (!payment) return;

  if (refundEntity.refund_status === REFUND_STATUS.SUCCESS) {
    payment.refundStatus = "processed";
    payment.gatewayRefundId = refundEntity.refund_id || refundEntity.cf_refund_id || payment.gatewayRefundId;
    payment.refundedAmount = Number(refundEntity.refund_amount || 0);
    payment.refundedAt = payment.refundedAt || new Date();
    // Partial refunds keep the payment "paid" with a non-zero refundedAmount;
    // only a full refund moves the row to "refunded". Same convention the
    // admin refund service uses.
    payment.status = amountsMatch(payment.refundedAmount, payment.amount) || payment.refundedAmount >= Number(payment.amount)
      ? "refunded"
      : "paid";
    if (typeof payment.save === "function") await payment.save();
    // NOTE: the simplified 4-state order model (see
    // PROGRESS_ORDER_SIMPLIFICATION.md) has no "refunded" order status —
    // "refunded" only ever exists on Payment. A refund is only ever
    // initiated for an order that's already "cancelled" (see
    // cancelMyOrder / admin-backend's refund endpoint, which gates on
    // order.status === "cancelled"), so there is nothing to transition here.
    try {
      const user = await User.findById(payment.user).select("email").lean();
      if (user?.email) await sendTransactionalEmail("refund", user.email, {
        orderId: payment.order, amount: payment.refundedAmount, status: payment.refundStatus, refundId: payment.gatewayRefundId
      }, `refund:${payment._id}:${payment.gatewayRefundId}:processed`);
    } catch (_) {}
    return;
  }

  if ([REFUND_STATUS.FAILED, REFUND_STATUS.CANCELLED].includes(refundEntity.refund_status)) {
    payment.refundStatus = "failed";
    payment.status = "paid";
    payment.failureReason = "Cashfree refund failed.";
    if (typeof payment.save === "function") await payment.save();
  }
}

const listPaymentsForOrder = asyncHandler(async (req, res) => {
  // Same ownership pattern as everywhere else: scope the lookup by the
  // authenticated user so another customer's order id is indistinguishable
  // from a non-existent one.
  const order = await Order.findOne({ _id: req.params.orderId, user: req.auth.userId });
  if (!order) throw ApiError.notFound("Order not found.");
  const payments = await Payment.find({ order: order._id }).sort({ createdAt: -1 });
  res.json({ items: (payments || []).map(publicPaymentView) });
});

module.exports = {
  createPaymentOrder,
  verifyPayment,
  webhook,
  listPaymentsForOrder,
  settlePaidPayment,
  failPayment,
  autoRefundOutOfStock,
  buildRefundId,
  publicPaymentView,
};
