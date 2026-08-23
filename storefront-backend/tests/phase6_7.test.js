jest.mock("../src/models/Coupon");
jest.mock("../src/models/CouponRedemption");
jest.mock("../src/models/Order");
jest.mock("../src/models/Product");
jest.mock("../src/models/InventoryLog");

const Coupon = require("../src/models/Coupon");
const CouponRedemption = require("../src/models/CouponRedemption");
const Order = require("../src/models/Order");
const Product = require("../src/models/Product");
const InventoryLog = require("../src/models/InventoryLog");
const { reserveCoupon, consumeCoupon, releaseCoupon, findValidCoupon } = require("../src/services/coupon.service");
const { reserveStock, releaseOrderReservation, consumeOrderReservation } = require("../src/services/stock.service");

beforeEach(() => {
  jest.clearAllMocks();
  InventoryLog.create.mockResolvedValue({});
  CouponRedemption.create.mockResolvedValue({ _id: "r1", coupon: "c1", status: "reserved" });
});

describe("Phase 7 coupon safety", () => {
  it("enforces usage limits atomically under concurrent reservations", async () => {
    let reserved = 0;
    Coupon.findOneAndUpdate.mockImplementation(async () => {
      if (reserved >= 2) return null;
      reserved += 1;
      return { _id: "c1", code: "SAVE", usageLimit: 2, reservedCount: reserved, status: "active" };
    });
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => reserveCoupon({ _id: "c1" }, { orderId: `o${i}`, userId: "u1", expiresAt: new Date(Date.now() + 60000) })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
  });

  it("releases a reserved coupon exactly once", async () => {
    CouponRedemption.findOneAndUpdate.mockResolvedValue({ coupon: "c1" });
    Coupon.findOneAndUpdate.mockResolvedValue({});
    expect(await releaseCoupon("r1", "payment failed")).toBe(true);
    expect(await releaseCoupon("r1", "payment failed")).toBe(true);
    expect(CouponRedemption.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it("converts reservation into one consumed usage", async () => {
    CouponRedemption.findOneAndUpdate.mockResolvedValue({ coupon: "c1" });
    Coupon.findOneAndUpdate.mockResolvedValue({});
    expect(await consumeCoupon("r1")).toBe(true);
    expect(Coupon.findOneAndUpdate).toHaveBeenCalledWith({ _id: "c1", reservedCount: { $gt: 0 } }, { $inc: { reservedCount: -1, usageCount: 1 } });
  });

  it("rejects expired coupons", async () => {
    Coupon.findOne.mockResolvedValue({ status: "active", expiresAt: new Date(Date.now() - 1000) });
    await expect(findValidCoupon("SAVE", 1000, "u1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects coupons below minimum cart value", async () => {
    Coupon.findOne.mockResolvedValue({ status: "active", expiresAt: null, minOrderValue: 5000, usageLimit: 0, usageCount: 0, reservedCount: 0 });
    await expect(findValidCoupon("SAVE", 1000, "u1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("enforces allowed users and per-user limits", async () => {
    Coupon.findOne.mockResolvedValue({ _id: "c1", status: "active", expiresAt: null, minOrderValue: 0, usageLimit: 0, usageCount: 0, reservedCount: 0, allowedUsers: ["u2"], maxUsesPerUser: 1 });
    await expect(findValidCoupon("SAVE", 1000, "u1")).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("Phase 6 stock reservation safety", () => {
  it("cannot reserve more inventory than exists under concurrent attempts", async () => {
    let stock = 2;
    const session = { withTransaction: jest.fn(async (fn) => fn()), endSession: jest.fn().mockResolvedValue() };
    const mongoose = require("mongoose");
    jest.spyOn(mongoose, "startSession").mockRejectedValue(new Error("standalone"));
    Product.findOneAndUpdate.mockImplementation(async (filter) => {
      if (stock < filter.stock.$gte) return null;
      stock -= filter.stock.$gte;
      return { _id: filter._id, stock };
    });
    const results = await Promise.allSettled([
      reserveStock([{ product: "507f1f77bcf86cd799439011", name: "Tablet", quantity: 2 }]),
      reserveStock([{ product: "507f1f77bcf86cd799439011", name: "Tablet", quantity: 2 }]),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(stock).toBe(0);
    mongoose.startSession.mockRestore();
  });

  it("releases an active reservation once and restores stock", async () => {
    const order = { _id: "o1", user: "u1", reservationStatus: "reserved", items: [{ product: "p1", name: "Tablet", quantity: 2 }] };
    Order.findOneAndUpdate.mockResolvedValue(order);
    Product.findByIdAndUpdate.mockResolvedValue({ _id: "p1", name: "Tablet", sku: "T1", stock: 7 });
    expect(await releaseOrderReservation(order, "Payment failed")).toBe(true);
    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith("p1", { $inc: { stock: 2 } }, { new: true });
  });

  it("marks a paid reservation consumed without adding stock", async () => {
    Order.findOneAndUpdate.mockResolvedValue({ _id: "o1" });
    expect(await consumeOrderReservation({ _id: "o1", reservationStatus: "reserved" })).toBe(true);
    expect(Product.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
