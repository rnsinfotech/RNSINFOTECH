jest.mock("../src/models/Payment");
jest.mock("../src/models/Order");
jest.mock("../src/models/User");
jest.mock("../src/services/email.service");
jest.mock("../src/services/cashfree.service", () => {
  const actual = jest.requireActual("../src/services/cashfree.service");
  return { ...actual, createCashfreeRefund: jest.fn() };
});

const Payment = require("../src/models/Payment");
const Order = require("../src/models/Order");
const User = require("../src/models/User");
const { createCashfreeRefund } = require("../src/services/cashfree.service");
const { initiateRefund, buildRefundId } = require("../src/services/refund.service");

const GATEWAY_ORDER_ID = "rns_507f1f77bcf86cd799439011_a1b2c3d4";

function paidPayment(overrides = {}) {
  return {
    _id: "p1",
    order: "o1",
    user: "u1",
    gateway: "cashfree",
    gatewayOrderId: GATEWAY_ORDER_ID,
    status: "paid",
    amount: 1000,
    refundedAmount: 0,
    refundStatus: "none",
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Payment.ACTIVE_GATEWAY = "cashfree";
  Order.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "o1" }) });
  User.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
});

describe("refund eligibility", () => {
  it("refuses to refund a payment that isn't paid", async () => {
    await expect(initiateRefund(paidPayment({ status: "created" }))).rejects.toMatchObject({ statusCode: 409 });
    expect(createCashfreeRefund).not.toHaveBeenCalled();
  });

  it("refuses to refund a payment with no gateway order reference", async () => {
    await expect(initiateRefund(paidPayment({ gatewayOrderId: null }))).rejects.toMatchObject({ statusCode: 409 });
    expect(createCashfreeRefund).not.toHaveBeenCalled();
  });

  // Historical rows belong to a processor this application no longer talks
  // to. Routing one to Cashfree would attempt a refund against an order
  // Cashfree has never heard of, so this fails loudly instead.
  it("refuses to refund a historical row from the previous processor", async () => {
    await expect(initiateRefund(paidPayment({ gateway: "legacy" }))).rejects.toMatchObject({ statusCode: 409 });
    expect(createCashfreeRefund).not.toHaveBeenCalled();
  });

  it("refuses to over-refund beyond the paid amount", async () => {
    await expect(initiateRefund(paidPayment(), { amount: 5000 })).rejects.toMatchObject({ statusCode: 400 });
    expect(createCashfreeRefund).not.toHaveBeenCalled();
  });

  it("refuses to refund more than the outstanding balance after a partial refund", async () => {
    await expect(
      initiateRefund(paidPayment({ refundedAmount: 800 }), { amount: 500 })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(createCashfreeRefund).not.toHaveBeenCalled();
  });

  it("refuses a zero or negative refund amount", async () => {
    await expect(initiateRefund(paidPayment(), { amount: 0 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(initiateRefund(paidPayment(), { amount: -100 })).rejects.toMatchObject({ statusCode: 400 });
    expect(createCashfreeRefund).not.toHaveBeenCalled();
  });
});

describe("refund execution", () => {
  it("marks the refund processed only after Cashfree accepts it", async () => {
    const payment = paidPayment();
    Payment.findOneAndUpdate.mockResolvedValue(payment);
    createCashfreeRefund.mockResolvedValue({ refund_id: "rfnd_1", refund_status: "SUCCESS", refund_amount: 1000 });

    const result = await initiateRefund(payment, { reason: "Returned" });

    expect(createCashfreeRefund).toHaveBeenCalledWith(expect.objectContaining({
      orderId: GATEWAY_ORDER_ID,
      amountInRupees: 1000,
    }));
    expect(result.status).toBe("refunded");
    expect(result.refundStatus).toBe("processed");
    expect(result.gatewayRefundId).toBe("rfnd_1");
  });

  // Cashfree treats refund_id as the idempotency key, so a deterministic id
  // is what makes a retried refund resolve to the same refund rather than a
  // second one.
  it("sends a deterministic refund id derived from local state", async () => {
    const payment = paidPayment();
    Payment.findOneAndUpdate.mockResolvedValue(payment);
    createCashfreeRefund.mockResolvedValue({ refund_id: "rfnd_1", refund_status: "SUCCESS", refund_amount: 1000 });

    await initiateRefund(payment);
    const first = createCashfreeRefund.mock.calls[0][0].refundId;

    jest.clearAllMocks();
    Payment.findOneAndUpdate.mockResolvedValue(paidPayment());
    createCashfreeRefund.mockResolvedValue({ refund_id: "rfnd_1", refund_status: "SUCCESS", refund_amount: 1000 });
    await initiateRefund(paidPayment());
    const second = createCashfreeRefund.mock.calls[0][0].refundId;

    expect(first).toBe(second);
    expect(first).toBe(buildRefundId({ _id: "p1" }, 0));
  });

  it("gives successive partial refunds distinct ids", () => {
    expect(buildRefundId({ _id: "p1" }, 0)).not.toBe(buildRefundId({ _id: "p1" }, 400));
  });

  // The atomic claim: whoever flips refundStatus to "pending" first is the
  // only caller that reaches the gateway.
  it("does not allow two concurrent refund claims", async () => {
    Payment.findOneAndUpdate.mockResolvedValue(null);
    await expect(initiateRefund(paidPayment())).rejects.toMatchObject({ statusCode: 409 });
    expect(createCashfreeRefund).not.toHaveBeenCalled();
  });

  it("keeps a partial refund in paid status with a running refunded total", async () => {
    const payment = paidPayment();
    Payment.findOneAndUpdate.mockResolvedValue(payment);
    createCashfreeRefund.mockResolvedValue({ refund_id: "rfnd_1", refund_status: "SUCCESS", refund_amount: 400 });

    const result = await initiateRefund(payment, { amount: 400 });

    expect(result.status).toBe("paid");
    expect(result.refundedAmount).toBe(400);
  });

  it("marks the refund failed on a non-retryable gateway rejection", async () => {
    const payment = paidPayment();
    Payment.findOneAndUpdate.mockResolvedValue(payment);
    Payment.updateOne.mockResolvedValue({ acknowledged: true });
    createCashfreeRefund.mockRejectedValue(Object.assign(new Error("refund not allowed"), { retryable: false }));

    await expect(initiateRefund(payment)).rejects.toMatchObject({ statusCode: 502 });
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { _id: "p1", refundStatus: "pending" },
      expect.objectContaining({ $set: expect.objectContaining({ refundStatus: "failed" }) })
    );
  });

  /**
   * A transport failure is not proof the refund did not happen — Cashfree may
   * have accepted it and the response been lost. Marking it "failed" would
   * unlock the row for a second refund attempt against money that is already
   * on its way back. It stays "pending" for reconciliation to resolve.
   */
  it("leaves a refund pending after a transport failure rather than failing it", async () => {
    const payment = paidPayment();
    Payment.findOneAndUpdate.mockResolvedValue(payment);
    Payment.updateOne.mockResolvedValue({ acknowledged: true });
    createCashfreeRefund.mockRejectedValue(Object.assign(new Error("ECONNRESET"), { retryable: true }));

    await expect(initiateRefund(payment)).rejects.toMatchObject({ statusCode: 502 });
    expect(Payment.updateOne).not.toHaveBeenCalled();
  });
});
