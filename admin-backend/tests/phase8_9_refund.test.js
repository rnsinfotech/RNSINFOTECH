jest.mock("../src/models/Payment");
jest.mock("../src/services/razorpay.service");

const Payment = require("../src/models/Payment");
const { createRazorpayRefund } = require("../src/services/razorpay.service");
const { initiateRefund } = require("../src/services/refund.service");

describe("Phase 9 refund initiation", () => {
  beforeEach(() => jest.clearAllMocks());

  test("requires a paid payment and a Razorpay payment id", async () => {
    await expect(initiateRefund({ status: "created" })).rejects.toMatchObject({ statusCode: 409 });
  });

  test("marks refund pending/processed only after Razorpay accepts the refund", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "p1", order: "o1", status: "paid", amount: 1000, refundedAmount: 0, razorpayPaymentId: "pay_1", save };
    Payment.findOneAndUpdate.mockResolvedValue(payment);
    createRazorpayRefund.mockResolvedValue({ id: "rfnd_1", amount: 100000, status: "processed" });

    const result = await initiateRefund(payment, { reason: "Returned" });

    expect(createRazorpayRefund).toHaveBeenCalledWith(expect.objectContaining({
      razorpayPaymentId: "pay_1",
      amountInRupees: 1000,
    }));
    expect(result.status).toBe("refunded");
    expect(result.refundStatus).toBe("processed");
    expect(result.razorpayRefundId).toBe("rfnd_1");
    expect(save).toHaveBeenCalled();
  });

  test("does not allow two concurrent refund claims", async () => {
    const payment = { _id: "p1", status: "paid", amount: 1000, refundedAmount: 0, razorpayPaymentId: "pay_1" };
    Payment.findOneAndUpdate.mockResolvedValue(null);
    await expect(initiateRefund(payment)).rejects.toMatchObject({ statusCode: 409 });
    expect(createRazorpayRefund).not.toHaveBeenCalled();
  });
});
