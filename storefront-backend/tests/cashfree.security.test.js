const crypto = require("crypto");

jest.mock("../src/config/env", () => ({
  env: { cashfree: { appId: "APP", secretKey: "SECRET", environment: "sandbox", apiVersion: "2025-01-01" } },
}));

const { createCashfreeOrder, createCashfreeRefund, verifyWebhookSignature, deterministicUuid, CASHFREE_WEBHOOK_VERSION } = require("../src/services/cashfree.service");

const sign = (body, timestamp) => crypto.createHmac("sha256", "SECRET")
  .update(Buffer.concat([Buffer.from(String(timestamp)), Buffer.from(body)]))
  .digest("base64");

describe("Cashfree security contract", () => {
  afterEach(() => jest.restoreAllMocks());

  test("uses the current API version, request id, and deterministic UUID idempotency key for order creation", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ order_id: "rns_1", order_amount: 10, order_currency: "INR", payment_session_id: "s" }) });
    await createCashfreeOrder({ orderId: "rns_1", amountInRupees: 10, customer: { id: "u", phone: "9999999999" } });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers["x-api-version"]).toBe("2025-01-01");
    expect(opts.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(opts.headers["x-idempotency-key"]).toBe(deterministicUuid("cashfree-order:rns_1"));
  });

  test("uses a stable idempotency key for refunds", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ refund_id: "r1", refund_status: "SUCCESS" }) });
    await createCashfreeRefund({ orderId: "o1", refundId: "r1", amountInRupees: 5 });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers["x-idempotency-key"]).toBe(deterministicUuid("cashfree-refund:o1:r1"));
  });

  test("verifies Cashfree's millisecond webhook timestamp and required version", () => {
    const body = Buffer.from('{"data":{"payment":{"payment_amount":10.00}}}');
    const timestamp = String(Date.now());
    const signature = sign(body, timestamp);
    expect(verifyWebhookSignature({ rawBody: body, signature, timestamp, webhookVersion: CASHFREE_WEBHOOK_VERSION })).toBe(true);
    expect(verifyWebhookSignature({ rawBody: body, signature, timestamp, webhookVersion: "2023-08-01" })).toBe(false);
  });

  test("rejects stale webhook timestamps", () => {
    const body = Buffer.from("{}");
    const timestamp = String(Date.now() - 10 * 60 * 1000);
    const signature = sign(body, timestamp);
    expect(verifyWebhookSignature({ rawBody: body, signature, timestamp, webhookVersion: CASHFREE_WEBHOOK_VERSION })).toBe(false);
  });
});
