const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Payment");
jest.mock("../src/services/inventory.service");
jest.mock("../src/services/coupon.service");
jest.mock("../src/services/refund.service");
jest.mock("../src/services/razorpay.service");
jest.mock("../src/models/Order");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Payment = require("../src/models/Payment");
const Order = require("../src/models/Order");
const { signAccessToken } = require("../src/services/token.service");
const { restoreConsumedOrderStock } = require("../src/services/inventory.service");
const { rollbackConsumedCoupon } = require("../src/services/coupon.service");
const { initiateRefund } = require("../src/services/refund.service");

AdminUser.ROLES = ["Owner", "Manager", "Staff"];

const app = createApp();
const ownerAuthHeader = `Bearer ${signAccessToken("admin123", "Owner")}`;
const staffAuthHeader = `Bearer ${signAccessToken("admin456", "Staff")}`;

beforeEach(() => {
  jest.clearAllMocks();
  Order.findById.mockResolvedValue(null);
  restoreConsumedOrderStock.mockResolvedValue(false);
  rollbackConsumedCoupon.mockResolvedValue(false);
  initiateRefund.mockImplementation(async (payment, options = {}) => {
    payment.status = "refunded";
    payment.refundStatus = "processed";
    payment.refundReason = options.reason || null;
    payment.refundedAmount = payment.amount;
    payment.razorpayRefundId = "rfnd_test";
    payment.refundedAt = new Date();
    if (payment.save) await payment.save();
    return payment;
  });
});

describe("payments router auth", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/payments");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/payments", () => {
  it("lists payments with pagination and populated customer info", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
    const populate = jest.fn().mockReturnThis();
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([{ _id: "pay1", status: "paid" }]);
    Payment.find.mockReturnValue({ populate, sort, skip, limit });
    Payment.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/api/payments").set("Authorization", ownerAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(populate).toHaveBeenCalledWith("user", "name email");
  });
});

describe("POST /api/payments/:id/refund", () => {
  it("is forbidden for a Staff-role account", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin456", isActive: true, role: "Staff" });

    const res = await request(app).post("/api/payments/pay1/refund").set("Authorization", staffAuthHeader).send({});

    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown payment", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
    Payment.findById.mockResolvedValue(null);

    const res = await request(app).post("/api/payments/pay1/refund").set("Authorization", ownerAuthHeader).send({});

    expect(res.status).toBe(404);
  });

  it("rejects refunding a payment that isn't paid", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
    Payment.findById.mockResolvedValue({ _id: "pay1", status: "created", amount: 3499, save: jest.fn() });

    const res = await request(app).post("/api/payments/pay1/refund").set("Authorization", ownerAuthHeader).send({});

    expect(res.status).toBe(409);
  });

  it("rejects a refund amount greater than the original payment", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
    Payment.findById.mockResolvedValue({ _id: "pay1", status: "paid", amount: 3499, razorpayPaymentId: "pay_rp", refundStatus: "none", save: jest.fn() });
    Order.findById.mockResolvedValue({ _id: "o1", status: "cancelled" });

    const res = await request(app)
      .post("/api/payments/pay1/refund")
      .set("Authorization", ownerAuthHeader)
      .send({ amount: 5000 });

    expect(res.status).toBe(400);
  });

  // Refund only ever applies to a cancelled order — see
  // PROGRESS_ORDER_SIMPLIFICATION.md's Phase 1 simplification.
  it("rejects refunding a payment whose order isn't cancelled", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
    Payment.findById.mockResolvedValue({ _id: "pay1", status: "paid", amount: 3499, razorpayPaymentId: "pay_rp", refundStatus: "none", order: "o1", save: jest.fn() });
    Order.findById.mockResolvedValue({ _id: "o1", status: "shipped" });

    const res = await request(app).post("/api/payments/pay1/refund").set("Authorization", ownerAuthHeader).send({});

    expect(res.status).toBe(409);
    expect(initiateRefund).not.toHaveBeenCalled();
  });

  it("refunds the full amount by default and marks the payment refunded", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
    const save = jest.fn().mockResolvedValue(true);
    const payment = { _id: "pay1", status: "paid", amount: 3499, razorpayPaymentId: "pay_rp", refundStatus: "none", order: "o1", save };
    Payment.findById.mockResolvedValue(payment);
    Order.findById.mockResolvedValue({ _id: "o1", status: "cancelled" });

    const res = await request(app)
      .post("/api/payments/pay1/refund")
      .set("Authorization", ownerAuthHeader)
      .send({ reason: "Customer returned the item" });

    expect(res.status).toBe(200);
    expect(payment.status).toBe("refunded");
    expect(payment.refundedAmount).toBe(3499);
    expect(payment.refundReason).toBe("Customer returned the item");
    expect(payment.refundedAt).toBeInstanceOf(Date);
    expect(payment.razorpayRefundId).toBe("rfnd_test");
    expect(save).toHaveBeenCalled();
  });

  it("rejects refunding an already-refunded payment", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
    Payment.findById.mockResolvedValue({ _id: "pay1", status: "refunded", amount: 3499, save: jest.fn() });

    const res = await request(app).post("/api/payments/pay1/refund").set("Authorization", ownerAuthHeader).send({});

    expect(res.status).toBe(409);
  });
});
