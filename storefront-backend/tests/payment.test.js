const request = require("supertest");
const crypto = require("crypto");

jest.mock("../src/models/Order");
jest.mock("../src/models/Payment");
jest.mock("../src/models/User");
jest.mock("../src/services/razorpay.service");
jest.mock("../src/services/email.service");
jest.mock("../src/config/env", () => {
  const actual = jest.requireActual("../src/config/env");
  return {
    ...actual,
    env: {
      ...actual.env,
      razorpayKeyId: "rzp_test_key",
      razorpayKeySecret: "test_key_secret",
      razorpayWebhookSecret: "test_webhook_secret",
    },
  };
});

const createApp = require("../src/app");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const User = require("../src/models/User");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} = require("../src/services/razorpay.service");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("user123")}`;
const validOrderId = "507f1f77bcf86cd799439011";

beforeEach(() => {
  jest.clearAllMocks();
  Order.findById.mockResolvedValue({ _id: validOrderId, reservationStatus: "reserved", reservationExpiresAt: new Date(Date.now() + 60000), couponReservationId: null });
  // The payment-confirmation/refund emails look up the order/payment owner's
  // email via User.findById(...).select(...).lean() — mocked here (not just
  // the transactional email service) so that code path never touches a real
  // Mongoose connection during tests. See PROGRESS_ORDER_SIMPLIFICATION.md's
  // Phase 4 test-suite fixes: without this, these tests hang until Jest's
  // timeout since mongoose buffers commands waiting for a DB that isn't there.
  User.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
});

describe("POST /api/payments/create-order", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app).post("/api/payments/create-order").send({ orderId: validOrderId });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the order doesn't belong to the requesting user", async () => {
    Order.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(404);
  });

  it("blocks starting a new payment attempt once the order is already paid", async () => {
    Order.findOne.mockResolvedValue({ _id: validOrderId, itemsTotal: 3499 });
    Payment.findOne.mockResolvedValue({ _id: "p1", status: "paid" });

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(409);
    expect(createRazorpayOrder).not.toHaveBeenCalled();
  });

  it("creates a Razorpay order and a local Payment record, returning the public key id", async () => {
    Order.findOne.mockResolvedValue({
      _id: validOrderId,
      itemsTotal: 3698,
      reservationStatus: "reserved",
      reservationExpiresAt: new Date(Date.now() + 60000),
      items: [{ price: 3499, quantity: 1 }],
      subtotal: 3499,
      shippingFee: 199,
      deliveryFee: 0,
      tax: 0,
      discount: 0,
      couponSnapshot: null,
      pricing: {
        subtotal: 3499, discount: 0, shippingFee: 199, deliveryFee: 0,
        tax: 0, taxRate: 0, taxableAmount: 3698, total: 3698,
        commerce: { freeShippingThreshold: 5000, flatShippingFee: 199, taxRate: 0, standardDeliveryFee: 0 },
      },
    });
    Payment.findOne.mockResolvedValue(null);
    createRazorpayOrder.mockResolvedValue({ id: "order_ABC123", amount: 369800, currency: "INR" });
    Payment.create.mockResolvedValue({ _id: "p1", razorpayOrderId: "order_ABC123", status: "created" });

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(201);
    expect(res.body.keyId).toBe("rzp_test_key");
    expect(res.body.razorpayOrderId).toBe("order_ABC123");
    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ order: validOrderId, user: "user123", razorpayOrderId: "order_ABC123", amount: 3698 })
    );
    expect(res.body.amount).toBe(369800);
  });
});

  it("rejects a Razorpay response whose amount differs from the server final total", async () => {
    Order.findOne.mockResolvedValue({
      _id: validOrderId,
      itemsTotal: 3698,
      reservationStatus: "reserved",
      reservationExpiresAt: new Date(Date.now() + 60000),
      items: [{ price: 3499, quantity: 1 }],
      subtotal: 3499,
      shippingFee: 199,
      deliveryFee: 0,
      tax: 0,
      discount: 0,
      couponSnapshot: null,
      pricing: {
        subtotal: 3499, discount: 0, shippingFee: 199, deliveryFee: 0,
        tax: 0, taxRate: 0, taxableAmount: 3698, total: 3698,
        commerce: { freeShippingThreshold: 5000, flatShippingFee: 199, taxRate: 0, standardDeliveryFee: 0 },
      },
    });
    Payment.findOne.mockResolvedValue(null);
    createRazorpayOrder.mockResolvedValue({ id: "order_BAD", amount: 349900, currency: "INR" });

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(409);
    expect(Payment.create).not.toHaveBeenCalled();
  });

describe("POST /api/payments/verify", () => {
  const verifyBody = {
    razorpayOrderId: "order_ABC123",
    razorpayPaymentId: "pay_XYZ789",
    razorpaySignature: "a".repeat(64),
  };

  it("returns 404 when no matching Payment exists for this user", async () => {
    Payment.findOne.mockResolvedValue(null);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send(verifyBody);

    expect(res.status).toBe(404);
  });

  it("is idempotent when the payment is already marked paid", async () => {
    Payment.findOne.mockResolvedValue({ status: "paid" });

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send(verifyBody);

    expect(res.status).toBe(200);
    expect(verifyPaymentSignature).not.toHaveBeenCalled();
  });

  it("marks the payment failed (not silently dropped) on an invalid signature", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { status: "created", save };
    Payment.findOne.mockResolvedValue(payment);
    verifyPaymentSignature.mockReturnValue(false);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send(verifyBody);

    expect(res.status).toBe(400);
    expect(payment.status).toBe("failed");
    expect(save).toHaveBeenCalled();
  });

  it("marks the payment paid on a valid signature", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { status: "created", save };
    Payment.findOne.mockResolvedValue(payment);
    verifyPaymentSignature.mockReturnValue(true);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send(verifyBody);

    expect(res.status).toBe(200);
    expect(payment.status).toBe("paid");
    expect(payment.razorpayPaymentId).toBe(verifyBody.razorpayPaymentId);
    expect(payment.verifiedAt).toBeInstanceOf(Date);
  });
});

describe("POST /api/payments/webhook", () => {
  function signedWebhookRequest(payload, { badSignature = false } = {}) {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = badSignature
      ? "0".repeat(64)
      : crypto.createHmac("sha256", "test_webhook_secret").update(rawBody).digest("hex");
    verifyWebhookSignature.mockImplementation((body, sig) => !badSignature && sig === signature);
    // Sent as a string (not the Buffer itself) — superagent JSON-encodes a
    // Buffer object (`{"type":"Buffer","data":[...]}`) when the
    // content-type is application/json, which is emphatically NOT what
    // express.raw() on the other end is expecting. A UTF-8 string with
    // the same bytes is passed through as-is instead.
    return request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", signature)
      .send(rawBody.toString("utf8"));
  }

  it("rejects a request with an invalid signature", async () => {
    verifyWebhookSignature.mockReturnValue(false);

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("X-Razorpay-Signature", "bad")
      .send(JSON.stringify({ event: "payment.captured" }));

    expect(res.status).toBe(400);
  });

  it("marks a payment paid on payment.captured and is idempotent on replay", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { status: "created", save };
    Payment.findOne.mockResolvedValue(payment);

    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_XYZ789", order_id: "order_ABC123", method: "upi" } } },
    };

    const res = await signedWebhookRequest(payload);

    expect(res.status).toBe(200);
    expect(payment.status).toBe("paid");
    expect(payment.method).toBe("upi");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("acks (200) a webhook for an order it has no Payment record for", async () => {
    Payment.findOne.mockResolvedValue(null);

    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_X", order_id: "order_unknown" } } },
    };

    const res = await signedWebhookRequest(payload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  // Regression test for the dead transitionOrder(order, "refunded", ...)
  // call removed in PROGRESS_ORDER_SIMPLIFICATION.md's Phase 1 gap fix —
  // "refunded" was never a valid order status, so it always threw and was
  // silently swallowed. The payment doc alone should end up "refunded";
  // nothing here should ever touch Order.
  it("marks a payment refunded on refund.processed without touching Order", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { status: "paid", refundStatus: "pending", save };
    Payment.findOne.mockResolvedValue(payment);

    const payload = {
      event: "refund.processed",
      payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_XYZ789", amount: 349900 } } },
    };

    const res = await signedWebhookRequest(payload);

    expect(res.status).toBe(200);
    expect(payment.status).toBe("refunded");
    expect(payment.refundStatus).toBe("processed");
    expect(payment.razorpayRefundId).toBe("rfnd_1");
    expect(Order.findById).not.toHaveBeenCalled();
    expect(Order.findOne).not.toHaveBeenCalled();
  });
});
