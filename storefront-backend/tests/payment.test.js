const request = require("supertest");
const crypto = require("crypto");

jest.mock("../src/models/Order");
jest.mock("../src/models/Payment");
jest.mock("../src/models/User");
jest.mock("../src/models/WebhookEvent");
jest.mock("../src/services/cashfree.service", () => {
  const actual = jest.requireActual("../src/services/cashfree.service");
  return {
    ...actual,
    // Only the network-touching calls are stubbed. The pure helpers
    // (signature verification, event keying, method normalisation) run for
    // real, so the tests below exercise the actual verification logic rather
    // than a mock of it.
    createCashfreeOrder: jest.fn(),
    getCashfreeOrder: jest.fn(),
    listCashfreeOrderPayments: jest.fn(),
    createCashfreeRefund: jest.fn(),
    getCashfreeRefund: jest.fn(),
    listCashfreeOrderRefunds: jest.fn(),
  };
});
jest.mock("../src/services/email.service");
jest.mock("../src/config/env", () => {
  const actual = jest.requireActual("../src/config/env");
  return {
    ...actual,
    env: {
      ...actual.env,
      cashfree: {
        appId: "TEST_APP_ID",
        secretKey: "test_secret_key",
        environment: "sandbox",
        apiVersion: "2025-01-01",
        returnUrl: "",
        notifyUrl: "https://example.test/api/payments/webhook",
      },
    },
  };
});

const createApp = require("../src/app");
const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const User = require("../src/models/User");
const WebhookEvent = require("../src/models/WebhookEvent");
const {
  createCashfreeOrder,
  getCashfreeOrder,
  listCashfreeOrderPayments,
  createCashfreeRefund,
} = require("../src/services/cashfree.service");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("user123")}`;
const validOrderId = "507f1f77bcf86cd799439011";
const gatewayOrderId = `rns_${validOrderId}_a1b2c3d4`;

const PRICED_ORDER = {
  _id: validOrderId,
  itemsTotal: 3698,
  status: "pending",
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
};

beforeEach(() => {
  jest.clearAllMocks();
  Order.findById.mockResolvedValue({ _id: validOrderId, reservationStatus: "reserved", reservationExpiresAt: new Date(Date.now() + 60000), couponReservationId: null });
  // The payment-confirmation/refund emails look up the order/payment owner's
  // email via User.findById(...).select(...).lean() — mocked here (not just
  // the transactional email service) so that code path never touches a real
  // Mongoose connection during tests.
  User.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
  Payment.ACTIVE_GATEWAY = "cashfree";
  WebhookEvent.create.mockResolvedValue({ save: jest.fn().mockResolvedValue(true) });
});

// ---------------------------------------------------------------------------
// AUTHENTICATION
// ---------------------------------------------------------------------------
describe("payment endpoints require authentication", () => {
  it("rejects an unauthenticated create-order with 401", async () => {
    const res = await request(app).post("/api/payments/create-order").send({ orderId: validOrderId });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated verify with 401", async () => {
    const res = await request(app).post("/api/payments/verify").send({ gatewayOrderId });
    expect(res.status).toBe(401);
  });

  it("rejects an invalid token with 401", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", "Bearer not.a.real.token")
      .send({ orderId: validOrderId });
    expect(res.status).toBe(401);
  });

  it("rejects an expired token with 401", async () => {
    const jwt = require("jsonwebtoken");
    const { env } = require("../src/config/env");
    const expired = jwt.sign({}, env.jwtAccessSecret, { subject: "user123", audience: "storefront-access", expiresIn: -60 });
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${expired}`)
      .send({ orderId: validOrderId });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// AUTHORIZATION / IDOR
// ---------------------------------------------------------------------------
describe("payment authorization", () => {
  it("returns 404 when the order doesn't belong to the requesting user", async () => {
    Order.findOne.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });
    expect(res.status).toBe(404);
    expect(createCashfreeOrder).not.toHaveBeenCalled();
  });

  // The ownership filter must be part of the query itself, not a check after
  // the fact — otherwise a non-existent id and someone else's id become
  // distinguishable, which is an enumeration oracle.
  it("scopes the create-order lookup by the authenticated user id", async () => {
    Order.findOne.mockResolvedValue(null);
    await request(app).post("/api/payments/create-order").set("Authorization", authHeader).send({ orderId: validOrderId });
    expect(Order.findOne).toHaveBeenCalledWith(expect.objectContaining({ user: "user123" }));
  });

  it("ignores a userId supplied in the request body", async () => {
    Order.findOne.mockResolvedValue(null);
    await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId, userId: "someoneelse" });
    expect(Order.findOne).toHaveBeenCalledWith(expect.objectContaining({ user: "user123" }));
  });

  it("returns 404 for another user's payment on verify, leaking nothing", async () => {
    Payment.findOne.mockResolvedValue(null);
    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });
    expect(res.status).toBe(404);
    expect(Payment.findOne).toHaveBeenCalledWith(expect.objectContaining({ user: "user123" }));
  });

  it("returns 404 for another user's order on the payment list endpoint", async () => {
    Order.findOne.mockResolvedValue(null);
    const res = await request(app).get(`/api/payments/order/${validOrderId}`).set("Authorization", authHeader);
    expect(res.status).toBe(404);
    expect(Order.findOne).toHaveBeenCalledWith(expect.objectContaining({ user: "user123" }));
  });
});

// ---------------------------------------------------------------------------
// PAYMENT CREATION
// ---------------------------------------------------------------------------
describe("POST /api/payments/create-order", () => {
  it("creates a Cashfree order and returns a payment session without any credential", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER });
    Payment.findOne.mockResolvedValue(null);
    createCashfreeOrder.mockResolvedValue({
      order_id: expect.anything(), order_amount: 3698, order_currency: "INR",
      payment_session_id: "session_abc", order_status: "ACTIVE",
    });
    // Echo back whatever order id the controller generated.
    createCashfreeOrder.mockImplementation(async ({ orderId }) => ({
      order_id: orderId, order_amount: 3698, order_currency: "INR",
      payment_session_id: "session_abc", order_status: "ACTIVE",
    }));
    Payment.create.mockResolvedValue({ _id: "p1", gatewayOrderId, status: "created", amount: 3698 });

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(201);
    expect(res.body.paymentSessionId).toBe("session_abc");
    expect(res.body.amount).toBe(3698);
    expect(res.body.mode).toBe("sandbox");
    // The whole point of the response shape: no secret, no app id.
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("test_secret_key");
    expect(serialized).not.toContain("TEST_APP_ID");
  });

  it("generates the gateway order id server-side, embedding the local order id", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER });
    Payment.findOne.mockResolvedValue(null);
    createCashfreeOrder.mockImplementation(async ({ orderId }) => ({
      order_id: orderId, order_amount: 3698, order_currency: "INR",
      payment_session_id: "s", order_status: "ACTIVE",
    }));
    Payment.create.mockResolvedValue({ _id: "p1", status: "created" });

    await request(app).post("/api/payments/create-order").set("Authorization", authHeader).send({ orderId: validOrderId });

    const sent = createCashfreeOrder.mock.calls[0][0].orderId;
    expect(sent).toMatch(new RegExp(`^rns_${validOrderId}_[a-f0-9]{8}$`));
  });

  it("blocks starting a new payment attempt once the order is already paid", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER });
    Payment.findOne.mockResolvedValue({ _id: "p1", status: "paid" });

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(409);
    expect(createCashfreeOrder).not.toHaveBeenCalled();
  });

  // Regression: the status gate is an allowlist, so a status that isn't
  // explicitly payable is rejected rather than permitted by omission.
  it("blocks payment creation for a shipped order", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER, status: "shipped" });
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });
    expect(res.status).toBe(409);
    expect(createCashfreeOrder).not.toHaveBeenCalled();
  });

  it("blocks payment creation for a cancelled order", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER, status: "cancelled" });
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });
    expect(res.status).toBe(409);
    expect(createCashfreeOrder).not.toHaveBeenCalled();
  });

  it("rejects a malformed order id before any gateway call", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: "not-an-object-id" });
    expect(res.status).toBe(400);
    expect(createCashfreeOrder).not.toHaveBeenCalled();
  });

  // Amount manipulation: even the gateway's own echo is cross-checked
  // against the server-calculated total.
  it("rejects a Cashfree response whose amount differs from the server total", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER });
    Payment.findOne.mockResolvedValue(null);
    createCashfreeOrder.mockImplementation(async ({ orderId }) => ({
      order_id: orderId, order_amount: 1, order_currency: "INR",
      payment_session_id: "s", order_status: "ACTIVE",
    }));

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(409);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  it("rejects a currency that isn't the server-defined one", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER });
    Payment.findOne.mockResolvedValue(null);
    createCashfreeOrder.mockImplementation(async ({ orderId }) => ({
      order_id: orderId, order_amount: 3698, order_currency: "USD",
      payment_session_id: "s", order_status: "ACTIVE",
    }));

    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId });

    expect(res.status).toBe(409);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  it("never sends a client-supplied amount to the gateway", async () => {
    Order.findOne.mockResolvedValue({ ...PRICED_ORDER });
    Payment.findOne.mockResolvedValue(null);
    createCashfreeOrder.mockImplementation(async ({ orderId }) => ({
      order_id: orderId, order_amount: 3698, order_currency: "INR",
      payment_session_id: "s", order_status: "ACTIVE",
    }));
    Payment.create.mockResolvedValue({ _id: "p1", status: "created" });

    await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", authHeader)
      .send({ orderId: validOrderId, amount: 1, total: 1, currency: "USD" });

    expect(createCashfreeOrder.mock.calls[0][0].amountInRupees).toBe(3698);
    expect(createCashfreeOrder.mock.calls[0][0].currency).toBe("INR");
  });
});

// ---------------------------------------------------------------------------
// PAYMENT VERIFICATION
// ---------------------------------------------------------------------------
describe("POST /api/payments/verify", () => {
  it("rejects a gatewayOrderId that this server could not have generated", async () => {
    const res = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", authHeader)
      .send({ gatewayOrderId: "../../etc/passwd" });
    expect(res.status).toBe(400);
    expect(getCashfreeOrder).not.toHaveBeenCalled();
  });

  it("is idempotent when the payment is already marked paid", async () => {
    Payment.findOne.mockResolvedValue({ _id: "p1", status: "paid", amount: 3698 });
    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });
    expect(res.status).toBe(200);
    // Critically: no second settlement, and no gateway round-trip at all.
    expect(getCashfreeOrder).not.toHaveBeenCalled();
  });

  it("settles a payment when Cashfree confirms a successful payment", async () => {
    const save = jest.fn().mockResolvedValue(true);
    Payment.findOne.mockResolvedValue({ _id: "p1", status: "created", amount: 3698, currency: "INR", order: validOrderId, save });
    getCashfreeOrder.mockResolvedValue({ order_id: gatewayOrderId, order_status: "PAID", order_amount: 3698 });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", order_id: gatewayOrderId, payment_status: "SUCCESS", payment_amount: 3698, payment_currency: "INR", payment_group: "upi" },
    ]);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe("paid");
    expect(res.body.payment.method).toBe("upi");
  });

  // The client asserts nothing, so the only way to fake a payment is to fake
  // Cashfree's own answer.
  it("does not settle when Cashfree reports no successful payment", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "created", amount: 3698, order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);
    getCashfreeOrder.mockResolvedValue({ order_id: gatewayOrderId, order_status: "TERMINATED" });
    listCashfreeOrderPayments.mockResolvedValue([{ cf_payment_id: "cf_1", payment_status: "FAILED" }]);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });

    expect(res.status).toBe(400);
    expect(payment.status).toBe("failed");
  });

  // A pending payment may still succeed. Marking it failed would strand
  // money that is genuinely in flight.
  it("leaves a pending payment pending instead of failing it", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "created", amount: 3698, order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);
    getCashfreeOrder.mockResolvedValue({ order_id: gatewayOrderId, order_status: "ACTIVE" });
    listCashfreeOrderPayments.mockResolvedValue([{ cf_payment_id: "cf_1", payment_status: "PENDING" }]);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });

    expect(res.status).toBe(202);
    expect(payment.status).toBe("created");
  });

  it("refuses to settle when the paid amount doesn't match the order total", async () => {
    const save = jest.fn().mockResolvedValue(true);
    Payment.findOne.mockResolvedValue({ _id: "p1", status: "created", amount: 10000, currency: "INR", order: validOrderId, save });
    getCashfreeOrder.mockResolvedValue({ order_id: gatewayOrderId, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", order_id: gatewayOrderId, payment_status: "SUCCESS", payment_amount: 9000, payment_currency: "INR" },
    ]);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });

    expect(res.status).toBe(409);
    // Flagged for investigation rather than silently dropped.
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { _id: "p1" },
      expect.objectContaining({ $set: expect.objectContaining({ gatewayStatus: "AMOUNT_MISMATCH" }) })
    );
  });

  it("refuses to settle a payment that belongs to a different gateway order", async () => {
    const save = jest.fn().mockResolvedValue(true);
    Payment.findOne.mockResolvedValue({ _id: "p1", status: "created", amount: 3698, currency: "INR", order: validOrderId, save });
    getCashfreeOrder.mockResolvedValue({ order_id: gatewayOrderId, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", order_id: `rns_${validOrderId}_deadbeef`, payment_status: "SUCCESS", payment_amount: 3698 },
    ]);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });
    expect(res.status).toBe(409);
  });

  it("refuses to settle on a currency mismatch", async () => {
    const save = jest.fn().mockResolvedValue(true);
    Payment.findOne.mockResolvedValue({ _id: "p1", status: "created", amount: 3698, currency: "INR", order: validOrderId, save });
    getCashfreeOrder.mockResolvedValue({ order_id: gatewayOrderId, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", order_id: gatewayOrderId, payment_status: "SUCCESS", payment_amount: 3698, payment_currency: "USD" },
    ]);

    const res = await request(app).post("/api/payments/verify").set("Authorization", authHeader).send({ gatewayOrderId });
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// WEBHOOKS
// ---------------------------------------------------------------------------
describe("POST /api/payments/webhook", () => {
  function signedWebhookRequest(payload, { badSignature = false, staleTimestamp = false } = {}) {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const timestamp = String(Date.now() - (staleTimestamp ? 3600 * 1000 : 0));
    const signature = badSignature
      ? Buffer.from("wrong-signature-value-padding-here").toString("base64")
      : crypto.createHmac("sha256", "test_secret_key")
          .update(Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]))
          .digest("base64");
    // Sent as a string (not the Buffer itself) — superagent JSON-encodes a
    // Buffer object when the content-type is application/json, which is not
    // what express.raw() on the other end expects.
    return request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-webhook-signature", signature)
      .set("x-webhook-timestamp", timestamp)
      .set("x-webhook-version", "2025-01-01")
      .send(rawBody.toString("utf8"));
  }

  const successPayload = {
    type: "PAYMENT_SUCCESS_WEBHOOK",
    data: {
      order: { order_id: gatewayOrderId, order_amount: 3698, order_currency: "INR" },
      payment: { cf_payment_id: "cf_1", payment_status: "SUCCESS", payment_amount: 3698, payment_group: "upi" },
    },
  };

  it("rejects a request with an invalid signature", async () => {
    const res = await signedWebhookRequest(successPayload, { badSignature: true });
    expect(res.status).toBe(400);
    expect(Payment.findOne).not.toHaveBeenCalled();
  });

  it("rejects a request with no signature headers at all", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(successPayload));
    expect(res.status).toBe(400);
  });

  // Replay: a genuine, correctly-signed delivery captured and re-sent later.
  it("rejects a correctly-signed delivery whose timestamp is stale", async () => {
    const res = await signedWebhookRequest(successPayload, { staleTimestamp: true });
    expect(res.status).toBe(400);
    expect(Payment.findOne).not.toHaveBeenCalled();
  });

  it("rejects a payload modified after signing", async () => {
    const rawBody = Buffer.from(JSON.stringify(successPayload));
    const timestamp = String(Date.now());
    const signature = crypto.createHmac("sha256", "test_secret_key")
      .update(Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]))
      .digest("base64");

    const tampered = { ...successPayload, data: { ...successPayload.data, order: { ...successPayload.data.order, order_amount: 1 } } };

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-webhook-signature", signature)
      .set("x-webhook-timestamp", timestamp)
      .set("x-webhook-version", "2025-01-01")
      .send(JSON.stringify(tampered));

    expect(res.status).toBe(400);
  });

  it("rejects a malformed payload behind a valid signature", async () => {
    const rawBody = Buffer.from("not json at all");
    const timestamp = String(Date.now());
    const signature = crypto.createHmac("sha256", "test_secret_key")
      .update(Buffer.concat([Buffer.from(timestamp, "utf8"), rawBody]))
      .digest("base64");

    const res = await request(app)
      .post("/api/payments/webhook")
      .set("Content-Type", "application/json")
      .set("x-webhook-signature", signature)
      .set("x-webhook-timestamp", timestamp)
      .set("x-webhook-version", "2025-01-01")
      .send(rawBody.toString("utf8"));

    expect(res.status).toBe(400);
  });

  it("acknowledges an unknown event type without acting on it", async () => {
    const res = await signedWebhookRequest({ type: "SOME_FUTURE_WEBHOOK", data: {} });
    expect(res.status).toBe(200);
    expect(res.body.handled).toBe(false);
    expect(Payment.findOne).not.toHaveBeenCalled();
  });

  it("settles a payment on PAYMENT_SUCCESS_WEBHOOK", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "created", amount: 3698, order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    const res = await signedWebhookRequest(successPayload);

    expect(res.status).toBe(200);
    expect(payment.status).toBe("paid");
    expect(payment.method).toBe("upi");
  });

  // The idempotency gate: the unique index on eventKey rejects the second
  // delivery, so the handler never reaches settlement a second time.
  it("skips a duplicate delivery of the same event", async () => {
    const duplicateKeyError = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    WebhookEvent.create.mockRejectedValueOnce(duplicateKeyError);

    const res = await signedWebhookRequest(successPayload);

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    // Never even looked the payment up, let alone settled it twice.
    expect(Payment.findOne).not.toHaveBeenCalled();
  });

  /**
   * Regression: a webhook whose processing FAILED must stay retryable.
   *
   * The idempotency row is written before processing, so a transient failure
   * leaves a tombstone. If that tombstone were treated as "already handled",
   * Cashfree's retry — the exact mechanism meant to recover from the failure
   * — would be skipped as a duplicate and the payment stranded forever.
   */
  it("re-claims a previously-failed event so the gateway retry is processed", async () => {
    const duplicateKeyError = Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
    WebhookEvent.create.mockRejectedValueOnce(duplicateKeyError);
    WebhookEvent.findOneAndUpdate.mockResolvedValueOnce({ status: "processing", save: jest.fn().mockResolvedValue(true) });

    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "created", amount: 3698, order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    const res = await signedWebhookRequest(successPayload);

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBeUndefined();
    // Only a FAILED row is re-claimable — a processed or in-flight one is not.
    expect(WebhookEvent.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
      expect.anything(),
      expect.anything()
    );
    expect(payment.status).toBe("paid");
  });

  it("does not settle when the webhook amount disagrees with the stored order", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "created", amount: 10000, order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    const res = await signedWebhookRequest(successPayload);

    expect(res.status).toBe(200);
    expect(payment.status).toBe("created");
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { _id: "p1" },
      expect.objectContaining({ $set: expect.objectContaining({ gatewayStatus: "AMOUNT_MISMATCH" }) })
    );
  });

  it("acks a webhook for an order it has no Payment record for", async () => {
    Payment.findOne.mockResolvedValue(null);
    const res = await signedWebhookRequest(successPayload);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("marks a payment failed on PAYMENT_FAILED_WEBHOOK", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "created", amount: 3698, order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    const res = await signedWebhookRequest({
      type: "PAYMENT_FAILED_WEBHOOK",
      data: {
        order: { order_id: gatewayOrderId },
        payment: { cf_payment_id: "cf_1", payment_status: "FAILED", payment_message: "Insufficient funds" },
      },
    });

    expect(res.status).toBe(200);
    expect(payment.status).toBe("failed");
    expect(payment.failureReason).toBe("Insufficient funds");
  });

  // A late failure webhook must never undo a settled payment.
  it("does not fail an already-paid payment on a late failure webhook", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "paid", amount: 3698, order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    const res = await signedWebhookRequest({
      type: "PAYMENT_USER_DROPPED_WEBHOOK",
      data: { order: { order_id: gatewayOrderId }, payment: { cf_payment_id: "cf_1", payment_status: "USER_DROPPED" } },
    });

    expect(res.status).toBe(200);
    expect(payment.status).toBe("paid");
  });

  it("marks a payment refunded on REFUND_STATUS_WEBHOOK success", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "paid", amount: 3698, refundStatus: "pending", order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    const res = await signedWebhookRequest({
      type: "REFUND_STATUS_WEBHOOK",
      data: { refund: { order_id: gatewayOrderId, refund_id: "rfnd_1", cf_refund_id: 9, refund_status: "SUCCESS", refund_amount: 3698 } },
    });

    expect(res.status).toBe(200);
    expect(payment.status).toBe("refunded");
    expect(payment.refundStatus).toBe("processed");
    expect(payment.gatewayRefundId).toBe("rfnd_1");
  });

  // Partial refunds keep the row "paid" with a non-zero refundedAmount —
  // the existing convention the admin UI already renders.
  it("keeps a partially-refunded payment in paid status", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "paid", amount: 3698, refundStatus: "pending", order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    await signedWebhookRequest({
      type: "REFUND_STATUS_WEBHOOK",
      data: { refund: { order_id: gatewayOrderId, refund_id: "rfnd_1", refund_status: "SUCCESS", refund_amount: 1000 } },
    });

    expect(payment.status).toBe("paid");
    expect(payment.refundedAmount).toBe(1000);
  });

  it("returns a payment to paid when a refund fails", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", status: "paid", amount: 3698, refundStatus: "pending", order: validOrderId, save };
    Payment.findOne.mockResolvedValue(payment);

    await signedWebhookRequest({
      type: "REFUND_STATUS_WEBHOOK",
      data: { refund: { order_id: gatewayOrderId, refund_id: "rfnd_1", refund_status: "FAILED" } },
    });

    expect(payment.status).toBe("paid");
    expect(payment.refundStatus).toBe("failed");
  });
});
