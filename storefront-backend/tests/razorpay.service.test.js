const crypto = require("crypto");

jest.mock("../src/config/env", () => ({
  env: {
    razorpayKeyId: "rzp_test_key",
    razorpayKeySecret: "test_key_secret",
    razorpayWebhookSecret: "test_webhook_secret",
  },
}));

const { createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature } = require("../src/services/razorpay.service");

describe("verifyPaymentSignature", () => {
  it("accepts a correctly-computed signature", () => {
    const razorpayOrderId = "order_ABC123";
    const razorpayPaymentId = "pay_XYZ789";
    const razorpaySignature = crypto
      .createHmac("sha256", "test_key_secret")
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    expect(verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature })).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId: "order_ABC123",
        razorpayPaymentId: "pay_XYZ789",
        razorpaySignature: "0".repeat(64),
      })
    ).toBe(false);
  });

  it("rejects a malformed (non-hex) signature without throwing", () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId: "order_ABC123",
        razorpayPaymentId: "pay_XYZ789",
        razorpaySignature: "not-a-hex-signature",
      })
    ).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  it("accepts a correctly-computed signature over the raw body", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const signature = crypto.createHmac("sha256", "test_webhook_secret").update(rawBody).digest("hex");

    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects a signature computed over different bytes (proves raw-body sensitivity)", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured" }));
    const differentBody = Buffer.from(JSON.stringify({ event: "payment.failed" }));
    const signature = crypto.createHmac("sha256", "test_webhook_secret").update(differentBody).digest("hex");

    expect(verifyWebhookSignature(rawBody, signature)).toBe(false);
  });
});

describe("createRazorpayOrder", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("converts rupees to paise and sends Basic Auth", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_ABC123", amount: 349900, currency: "INR" }),
    });

    const result = await createRazorpayOrder({ amountInRupees: 3499, receipt: "r1", notes: {} });

    expect(result.id).toBe("order_ABC123");
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(JSON.parse(options.body).amount).toBe(349900);
    expect(options.headers.Authorization).toMatch(/^Basic /);
  });

  it("throws a descriptive error when Razorpay rejects the request", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { description: "Invalid amount" } }),
    });

    await expect(createRazorpayOrder({ amountInRupees: 0, receipt: "r1", notes: {} })).rejects.toThrow(
      "Invalid amount"
    );
  });
});
