const crypto = require("crypto");

jest.mock("../src/config/env", () => ({
  env: {
    cashfree: {
      appId: "TEST_APP_ID",
      secretKey: "test_secret_key",
      environment: "sandbox",
      apiVersion: "2025-01-01",
      returnUrl: "",
      notifyUrl: "",
    },
  },
}));

const {
  createCashfreeOrder,
  createCashfreeRefund,
  verifyWebhookSignature,
  webhookEventKey,
  findSuccessfulPayment,
  normalizePaymentMethod,
} = require("../src/services/cashfree.service");

function signWebhook(rawBody, timestamp, secret = "test_secret_key") {
  return crypto
    .createHmac("sha256", secret)
    .update(Buffer.concat([Buffer.from(String(timestamp), "utf8"), Buffer.from(rawBody)]))
    .digest("base64");
}

describe("verifyWebhookSignature", () => {
  const rawBody = Buffer.from(JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK" }));

  it("accepts a correctly-computed signature over timestamp + raw body", () => {
    const timestamp = String(Date.now());
    const signature = signWebhook(rawBody, timestamp);
    expect(verifyWebhookSignature({ rawBody, signature, timestamp })).toBe(true);
  });

  it("rejects a signature computed over different bytes (proves raw-body sensitivity)", () => {
    const timestamp = String(Date.now());
    const signature = signWebhook(Buffer.from(JSON.stringify({ type: "PAYMENT_FAILED_WEBHOOK" })), timestamp);
    expect(verifyWebhookSignature({ rawBody, signature, timestamp })).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const timestamp = String(Date.now());
    const signature = signWebhook(rawBody, timestamp, "attacker_secret");
    expect(verifyWebhookSignature({ rawBody, signature, timestamp })).toBe(false);
  });

  // Replay protection. The timestamp is inside the signed payload, so an
  // attacker cannot move it forward without invalidating the signature —
  // which means an age check is sufficient to expire a captured delivery.
  it("rejects a valid signature whose timestamp is outside the freshness window", () => {
    const staleTimestamp = String(Date.now() - 3600);
    const signature = signWebhook(rawBody, staleTimestamp);
    expect(verifyWebhookSignature({ rawBody, signature, timestamp: staleTimestamp })).toBe(false);
  });

  it("rejects a request with a missing signature or timestamp", () => {
    const timestamp = String(Date.now());
    expect(verifyWebhookSignature({ rawBody, signature: undefined, timestamp })).toBe(false);
    expect(verifyWebhookSignature({ rawBody, signature: signWebhook(rawBody, timestamp), timestamp: undefined })).toBe(false);
  });

  it("rejects a malformed (non-base64-length) signature without throwing", () => {
    const timestamp = String(Date.now());
    expect(verifyWebhookSignature({ rawBody, signature: "not-a-real-signature", timestamp })).toBe(false);
  });
});

describe("webhookEventKey", () => {
  it("produces the same key for a redelivery of the same event", () => {
    const event = {
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: { payment: { cf_payment_id: "cf_1", payment_status: "SUCCESS" } },
    };
    expect(webhookEventKey(event)).toBe(webhookEventKey({ ...event }));
  });

  it("produces different keys for different events on the same payment", () => {
    const success = { type: "PAYMENT_SUCCESS_WEBHOOK", data: { payment: { cf_payment_id: "cf_1", payment_status: "SUCCESS" } } };
    const refund = { type: "REFUND_STATUS_WEBHOOK", data: { refund: { refund_id: "rf_1", refund_status: "SUCCESS" } } };
    expect(webhookEventKey(success)).not.toBe(webhookEventKey(refund));
  });
});

describe("findSuccessfulPayment", () => {
  // Cashfree returns every attempt against an order, so picking the first
  // one would settle an order on the back of a dropped attempt.
  it("picks the successful attempt, not the first one", () => {
    const payments = [
      { cf_payment_id: "cf_1", payment_status: "USER_DROPPED" },
      { cf_payment_id: "cf_2", payment_status: "FAILED" },
      { cf_payment_id: "cf_3", payment_status: "SUCCESS" },
    ];
    expect(findSuccessfulPayment(payments).cf_payment_id).toBe("cf_3");
  });

  it("returns null when nothing succeeded", () => {
    expect(findSuccessfulPayment([{ payment_status: "PENDING" }])).toBeNull();
    expect(findSuccessfulPayment([])).toBeNull();
  });
});

describe("normalizePaymentMethod", () => {
  it("prefers payment_group", () => {
    expect(normalizePaymentMethod({ payment_group: "upi", payment_method: { upi: {} } })).toBe("upi");
  });

  it("falls back to the payment_method key", () => {
    expect(normalizePaymentMethod({ payment_method: { netbanking: {} } })).toBe("netbanking");
  });

  it("returns null rather than guessing when nothing is present", () => {
    expect(normalizePaymentMethod({})).toBeNull();
    expect(normalizePaymentMethod(null)).toBeNull();
  });
});

describe("createCashfreeOrder", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it("sends the amount in rupees (not the minor unit) with credential headers", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order_id: "rns_x", order_amount: 3499, order_currency: "INR", payment_session_id: "session_abc", order_status: "ACTIVE" }),
    });

    const result = await createCashfreeOrder({
      orderId: "rns_x",
      amountInRupees: 3499,
      customer: { id: "u1", phone: "9999999999", email: "a@b.com", name: "A" },
    });

    expect(result.payment_session_id).toBe("session_abc");
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://sandbox.cashfree.com/pg/orders");
    expect(JSON.parse(options.body).order_amount).toBe(3499);
    expect(options.headers["x-client-id"]).toBe("TEST_APP_ID");
    expect(options.headers["x-client-secret"]).toBe("test_secret_key");
    expect(options.headers["x-api-version"]).toBe("2025-01-01");
  });

  it("throws a descriptive error when Cashfree rejects the request", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "order_amount is invalid", code: "order_amount_invalid", type: "invalid_request_error" }),
    });

    await expect(
      createCashfreeOrder({ orderId: "rns_x", amountInRupees: 0, customer: { id: "u1", phone: "1" } })
    ).rejects.toThrow("order_amount is invalid");
  });

  // A thrown error routinely ends up in a log sink, so it must not carry the
  // credentials or the echoed request context.
  it("never attaches credentials to a thrown error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "authentication failed", code: "auth_error", request_headers: { "x-client-secret": "test_secret_key" } }),
    });

    let caught;
    try {
      await createCashfreeOrder({ orderId: "rns_x", amountInRupees: 10, customer: { id: "u1", phone: "1" } });
    } catch (err) { caught = err; }

    expect(JSON.stringify(caught.cashfree)).not.toContain("test_secret_key");
    expect(Object.keys(caught.cashfree).sort()).toEqual(["code", "httpStatus", "message", "type"]);
  });

  // "Could not reach the gateway" is emphatically not "the payment failed" —
  // the request may have landed. Callers key off `retryable` to decide
  // whether re-reading state is required before concluding anything.
  it("marks a network failure retryable rather than terminal", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNRESET"));
    let caught;
    try {
      await createCashfreeOrder({ orderId: "rns_x", amountInRupees: 10, customer: { id: "u1", phone: "1" } });
    } catch (err) { caught = err; }
    expect(caught.retryable).toBe(true);
    expect(caught.statusCode).toBe(502);
  });
});

describe("createCashfreeRefund", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it("posts the caller-supplied refund id, which is the gateway idempotency key", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ refund_id: "rfnd_1", cf_refund_id: 99, refund_status: "SUCCESS", refund_amount: 3499 }),
    });

    await createCashfreeRefund({ orderId: "rns_x", refundId: "rfnd_1", amountInRupees: 3499, note: "test" });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://sandbox.cashfree.com/pg/orders/rns_x/refunds");
    expect(JSON.parse(options.body).refund_id).toBe("rfnd_1");
    expect(JSON.parse(options.body).refund_amount).toBe(3499);
  });
});
