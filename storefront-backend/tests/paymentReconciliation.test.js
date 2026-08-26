jest.mock("../src/models/Order");
jest.mock("../src/models/Payment");
jest.mock("../src/services/cashfree.service", () => {
  const actual = jest.requireActual("../src/services/cashfree.service");
  return {
    ...actual,
    // Only the network calls are stubbed. The pure helpers and the status
    // vocabularies stay real, so the reconciler is exercised against the
    // actual matching logic rather than a mock of it. (The service
    // destructures its imports at require time, so a blanket automock would
    // freeze undefined into those bindings before a beforeEach could
    // restore them.)
    getCashfreeOrder: jest.fn(),
    listCashfreeOrderPayments: jest.fn(),
    listCashfreeOrderRefunds: jest.fn(),
    getCashfreeRefund: jest.fn(),
    createCashfreeRefund: jest.fn(),
  };
});
jest.mock("../src/services/stock.service");
jest.mock("../src/services/orderLifecycle.service");
jest.mock("../src/controllers/payment.controller");

const Order = require("../src/models/Order");
const Payment = require("../src/models/Payment");
const {
  getCashfreeOrder,
  listCashfreeOrderPayments,
  listCashfreeOrderRefunds,
} = require("../src/services/cashfree.service");
const { settlePaidPayment, failPayment, autoRefundOutOfStock } = require("../src/controllers/payment.controller");
const { reclaimExpiredReservation } = require("../src/services/stock.service");
const { reconcilePayment } = require("../src/services/paymentReconciliation.service");

const ORDER_ID = "507f1f77bcf86cd799439011";
const GATEWAY_ORDER_ID = `rns_${ORDER_ID}_a1b2c3d4`;

function payment(overrides = {}) {
  return {
    _id: "p1",
    order: ORDER_ID,
    gateway: "cashfree",
    gatewayOrderId: GATEWAY_ORDER_ID,
    amount: 3698,
    status: "created",
    refundStatus: "none",
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Payment.updateOne.mockResolvedValue({ acknowledged: true });
  Payment.findById.mockResolvedValue(null);
  Order.findById.mockResolvedValue({ _id: ORDER_ID, reservationStatus: "reserved", status: "pending" });
  Order.updateOne.mockResolvedValue({ acknowledged: true });
  listCashfreeOrderRefunds.mockResolvedValue([]);
});

describe("reconcilePayment", () => {
  // local PENDING / remote SUCCESS -> settle
  it("settles a locally-pending payment that Cashfree reports as successful", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", payment_status: "SUCCESS", payment_amount: 3698, payment_group: "upi" },
    ]);

    const result = await reconcilePayment(payment());

    expect(settlePaidPayment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ gatewayPaymentId: "cf_1", method: "upi" })
    );
    expect(result.changed).toBe(true);
  });

  // local PAID / remote SUCCESS -> consistent, no double settlement
  it("does not re-settle an already-paid payment", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", payment_status: "SUCCESS", payment_amount: 3698, payment_group: "upi" },
    ]);

    await reconcilePayment(payment({ status: "paid", method: "upi" }));

    expect(settlePaidPayment).not.toHaveBeenCalled();
  });

  /**
   * local PAID / remote NOT PAID.
   *
   * This is the case the spec is most emphatic about: do NOT blindly reverse.
   * A local "paid" row is what made the order visible to the customer and
   * possibly shipped it; a transient remote read is not grounds to undo that.
   * Record the discrepancy, change nothing.
   */
  it("never reverses a settled payment that Cashfree reports as unpaid", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "TERMINATED" });
    listCashfreeOrderPayments.mockResolvedValue([{ cf_payment_id: "cf_1", payment_status: "FAILED" }]);

    const result = await reconcilePayment(payment({ status: "paid" }));

    expect(result.discrepancy).toBe("local-settled-remote-unpaid");
    expect(failPayment).not.toHaveBeenCalled();
    expect(settlePaidPayment).not.toHaveBeenCalled();
  });

  it("flags an amount mismatch instead of settling it", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", payment_status: "SUCCESS", payment_amount: 9000 },
    ]);

    const result = await reconcilePayment(payment({ amount: 10000 }));

    expect(result.discrepancy).toBe("amount-mismatch");
    expect(settlePaidPayment).not.toHaveBeenCalled();
  });

  // A local clock running out is not evidence a payment failed. An ACTIVE
  // order at Cashfree may still be mid-flight on the customer's bank page.
  it("does not expire an attempt that Cashfree still reports as ACTIVE", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "ACTIVE" });
    listCashfreeOrderPayments.mockResolvedValue([]);

    await reconcilePayment(payment({ expiresAt: new Date(Date.now() - 60000) }));

    expect(failPayment).not.toHaveBeenCalled();
  });

  it("expires an attempt Cashfree reports as terminated", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "EXPIRED" });
    listCashfreeOrderPayments.mockResolvedValue([]);

    const result = await reconcilePayment(payment());

    expect(failPayment).toHaveBeenCalledWith(expect.anything(), "Payment attempt expired.", "expired");
    expect(result.changed).toBe(true);
  });

  // Money taken, stock genuinely gone -> refund, don't just fail silently.
  it("auto-refunds when the payment succeeded but stock is genuinely gone", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", payment_status: "SUCCESS", payment_amount: 3698 },
    ]);
    Order.findById.mockResolvedValue({ _id: ORDER_ID, reservationStatus: "released", status: "pending" });
    reclaimExpiredReservation.mockResolvedValue(false);
    autoRefundOutOfStock.mockResolvedValue(true);

    await reconcilePayment(payment());

    expect(settlePaidPayment).not.toHaveBeenCalled();
    expect(autoRefundOutOfStock).toHaveBeenCalled();
    // The order must still appear in the customer's history as
    // paid-then-refunded rather than silently vanishing.
    expect(Order.updateOne).toHaveBeenCalledWith(
      { _id: ORDER_ID, paymentVerifiedAt: null },
      { $set: { paymentVerifiedAt: expect.any(Date) } }
    );
  });

  it("resolves a pending refund once Cashfree confirms it", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", payment_status: "SUCCESS", payment_amount: 3698 },
    ]);
    const current = payment({ status: "paid", refundStatus: "pending" });
    Payment.findById.mockResolvedValue(current);
    listCashfreeOrderRefunds.mockResolvedValue([
      { refund_id: "rfnd_1", refund_status: "SUCCESS", refund_amount: 3698 },
    ]);

    await reconcilePayment(payment({ status: "paid", refundStatus: "pending" }));

    expect(current.refundStatus).toBe("processed");
    expect(current.status).toBe("refunded");
    expect(current.gatewayRefundId).toBe("rfnd_1");
  });

  it("returns a payment to paid when Cashfree reports the refund failed", async () => {
    getCashfreeOrder.mockResolvedValue({ order_id: GATEWAY_ORDER_ID, order_status: "PAID" });
    listCashfreeOrderPayments.mockResolvedValue([
      { cf_payment_id: "cf_1", payment_status: "SUCCESS", payment_amount: 3698 },
    ]);
    const current = payment({ status: "paid", refundStatus: "pending" });
    Payment.findById.mockResolvedValue(current);
    listCashfreeOrderRefunds.mockResolvedValue([{ refund_id: "rfnd_1", refund_status: "FAILED" }]);

    await reconcilePayment(payment({ status: "paid", refundStatus: "pending" }));

    expect(current.status).toBe("paid");
    expect(current.refundStatus).toBe("failed");
  });

  // Historical rows belong to a processor this application no longer talks
  // to — reconciling one against Cashfree would query an order it never had.
  it("skips historical rows from the previous processor", async () => {
    const result = await reconcilePayment(payment({ gateway: "legacy" }));

    expect(result.skipped).toBe("legacy-gateway");
    expect(getCashfreeOrder).not.toHaveBeenCalled();
  });

  it("does nothing for a payment with no gateway order reference", async () => {
    const result = await reconcilePayment(payment({ gatewayOrderId: null }));
    expect(result).toBeNull();
    expect(getCashfreeOrder).not.toHaveBeenCalled();
  });
});
