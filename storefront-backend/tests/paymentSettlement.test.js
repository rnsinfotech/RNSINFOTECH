const { canTransition, assertTransition, isSettled, SETTLEABLE_FROM } = require("../src/services/paymentState");

jest.mock("../src/models/Order");
jest.mock("../src/models/Payment");
jest.mock("../src/models/User");
jest.mock("../src/services/email.service");
jest.mock("../src/services/stock.service");
jest.mock("../src/services/coupon.service");
jest.mock("../src/services/orderLifecycle.service");
jest.mock("../src/services/cashfree.service");

const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const User = require("../src/models/User");
const { consumeOrderReservation } = require("../src/services/stock.service");
const { consumeCoupon } = require("../src/services/coupon.service");
const { sendTransactionalEmail } = require("../src/services/email.service");
const { settlePaidPayment } = require("../src/controllers/payment.controller");

const ORDER_ID = "507f1f77bcf86cd799439011";

describe("payment state machine", () => {
  it("allows the forward path created -> paid -> refunded", () => {
    expect(canTransition("created", "paid")).toBe(true);
    expect(canTransition("paid", "refunded")).toBe(true);
  });

  // The properties that stop a customer-reachable endpoint from talking a
  // payment back out of a settled state.
  it("forbids reversing a settled payment", () => {
    expect(canTransition("paid", "created")).toBe(false);
    expect(canTransition("paid", "failed")).toBe(false);
    expect(canTransition("paid", "expired")).toBe(false);
    expect(canTransition("refunded", "paid")).toBe(false);
    expect(canTransition("refunded", "created")).toBe(false);
  });

  // A payment can genuinely fail on one attempt and succeed on a retry, and
  // a late webhook can arrive after a timeout already marked it failed.
  // Refusing this edge would strand real money.
  it("allows failed -> paid, which only settlement can reach", () => {
    expect(canTransition("failed", "paid")).toBe(true);
    expect(canTransition("expired", "paid")).toBe(true);
  });

  it("throws a conflict on an illegal transition", () => {
    expect(() => assertTransition("paid", "created")).toThrow(/cannot become/i);
    expect(() => assertTransition("created", "paid")).not.toThrow();
  });

  it("treats paid and refunded as settled", () => {
    expect(isSettled("paid")).toBe(true);
    expect(isSettled("refunded")).toBe(true);
    expect(isSettled("created")).toBe(false);
    expect(isSettled("failed")).toBe(false);
  });

  it("never lists a settled status as settleable", () => {
    expect(SETTLEABLE_FROM).not.toContain("paid");
    expect(SETTLEABLE_FROM).not.toContain("refunded");
  });
});

describe("settlement concurrency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Order.findById.mockResolvedValue({ _id: ORDER_ID, reservationStatus: "reserved", couponReservationId: "coupon1", paymentVerifiedAt: null });
    Order.updateOne.mockResolvedValue({ acknowledged: true });
    User.findById.mockReturnValue({ select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ email: "a@b.com" }) });
    consumeOrderReservation.mockResolvedValue(true);
    consumeCoupon.mockResolvedValue(true);
    sendTransactionalEmail.mockResolvedValue(true);
  });

  /**
   * The scenario the spec calls out: customer-return verification, the
   * Cashfree webhook and the reconciliation sweep all arriving at once.
   *
   * The claiming update is `status: { $in: SETTLEABLE_FROM }`, so the
   * database itself elects a single winner. This test simulates that by
   * having findOneAndUpdate succeed once and return null thereafter, which is
   * exactly what Mongo does when the filter no longer matches.
   */
  it("performs the side effects exactly once when three callers race", async () => {
    let claimed = false;
    Payment.findOneAndUpdate.mockImplementation(async () => {
      if (claimed) return null;
      claimed = true;
      return { _id: "p1", order: ORDER_ID, amount: 3698, status: "paid" };
    });
    Payment.findById.mockResolvedValue({ _id: "p1", order: ORDER_ID, amount: 3698, status: "paid" });

    const payment = { _id: "p1", order: ORDER_ID, amount: 3698, status: "created" };

    await Promise.all([
      settlePaidPayment(payment, { gatewayPaymentId: "cf_1", method: "upi" }),
      settlePaidPayment(payment, { gatewayPaymentId: "cf_1", method: "upi" }),
      settlePaidPayment(payment, { gatewayPaymentId: "cf_1", method: "upi" }),
    ]);

    // Inventory consumed once, coupon consumed once, one confirmation email.
    expect(consumeOrderReservation).toHaveBeenCalledTimes(1);
    expect(consumeCoupon).toHaveBeenCalledTimes(1);
    expect(sendTransactionalEmail).toHaveBeenCalledTimes(1);
  });

  it("claims only from a non-settled status", async () => {
    Payment.findOneAndUpdate.mockResolvedValue({ _id: "p1", order: ORDER_ID, amount: 3698, status: "paid" });
    await settlePaidPayment({ _id: "p1", order: ORDER_ID, amount: 3698, status: "created" }, { gatewayPaymentId: "cf_1" });

    const filter = Payment.findOneAndUpdate.mock.calls[0][0];
    expect(filter.status).toEqual({ $in: SETTLEABLE_FROM });
  });

  it("refuses to settle a payment that is already refunded", async () => {
    await expect(
      settlePaidPayment({ _id: "p1", order: ORDER_ID, amount: 3698, status: "refunded" }, { gatewayPaymentId: "cf_1" })
    ).rejects.toThrow(/cannot become/i);
    expect(consumeOrderReservation).not.toHaveBeenCalled();
  });

  it("refuses to settle when the reservation was genuinely released", async () => {
    Order.findById.mockResolvedValue({ _id: ORDER_ID, reservationStatus: "released" });
    await expect(
      settlePaidPayment({ _id: "p1", order: ORDER_ID, amount: 3698, status: "created" }, { gatewayPaymentId: "cf_1" })
    ).rejects.toThrow(/no longer in stock/i);
    expect(consumeOrderReservation).not.toHaveBeenCalled();
  });

  it("uses a per-payment idempotency key on the confirmation email", async () => {
    Payment.findOneAndUpdate.mockResolvedValue({ _id: "p1", order: ORDER_ID, amount: 3698, status: "paid" });
    await settlePaidPayment({ _id: "p1", order: ORDER_ID, amount: 3698, status: "created" }, { gatewayPaymentId: "cf_1" });

    // EmailLog has a unique index on eventKey, so this string is what makes a
    // duplicate send impossible even across processes.
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      "payment-confirmation", "a@b.com", expect.anything(), "payment:p1:confirmed"
    );
  });

  it("sets paymentVerifiedAt only when it is not already set", async () => {
    Payment.findOneAndUpdate.mockResolvedValue({ _id: "p1", order: ORDER_ID, amount: 3698, status: "paid" });
    await settlePaidPayment({ _id: "p1", order: ORDER_ID, amount: 3698, status: "created" }, { gatewayPaymentId: "cf_1" });

    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: ORDER_ID, paymentVerifiedAt: null },
      { $set: { paymentVerifiedAt: expect.any(Date) } }
    );
  });
});
