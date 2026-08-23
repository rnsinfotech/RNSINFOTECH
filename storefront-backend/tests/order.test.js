const request = require("supertest");

jest.mock("../src/models/Order");
jest.mock("../src/models/Product");
jest.mock("../src/models/Payment");
jest.mock("../src/models/Coupon");
jest.mock("../src/models/CouponRedemption");
jest.mock("../src/models/SiteSettings");
jest.mock("../src/services/stock.service");

const createApp = require("../src/app");
const Order = require("../src/models/Order");
const Product = require("../src/models/Product");
const Payment = require("../src/models/Payment");
const Coupon = require("../src/models/Coupon");
const CouponRedemption = require("../src/models/CouponRedemption");
const SiteSettings = require("../src/models/SiteSettings");
const { decrementStock } = require("../src/services/stock.service");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("user123")}`;
const validProductId = "507f1f77bcf86cd799439011";

const validAddress = {
  fullName: "Prakhar Tagra",
  phone: "9876543210",
  line1: "221B Sample Street",
  city: "Delhi",
  state: "Delhi",
  pincode: "110001",
};

beforeEach(() => {
  jest.clearAllMocks();
  SiteSettings.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
  Order.updateOne.mockResolvedValue({});
  Order.findById.mockResolvedValue(null);
  Coupon.findOneAndUpdate.mockImplementation(async (filter, update) => ({ _id: filter._id || "c1", code: "SAVE10", type: "percent", value: 10, minOrderValue: 0, usageLimit: 0, usageCount: 0, reservedCount: 1, status: "active", expiresAt: null }));
  CouponRedemption.create.mockResolvedValue({ _id: "cr1" });
});

describe("POST /api/orders", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ items: [{ product: validProductId, quantity: 1 }], shippingAddress: validAddress });

    expect(res.status).toBe(401);
  });

  it("rejects an empty items array with 400", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({ items: [], shippingAddress: validAddress });

    expect(res.status).toBe(400);
  });

  it("rejects a product id that isn't active/found with 400", async () => {
    Product.find.mockResolvedValue([]);

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({ items: [{ product: validProductId, quantity: 1 }], shippingAddress: validAddress });

    expect(res.status).toBe(400);
    expect(decrementStock).not.toHaveBeenCalled();
  });

  it("rejects a quantity greater than available stock with 409", async () => {
    Product.find.mockResolvedValue([{ _id: validProductId, name: "Wave Tablet", price: 3499, stock: 1, images: [] }]);

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({ items: [{ product: validProductId, quantity: 5 }], shippingAddress: validAddress });

    expect(res.status).toBe(409);
    expect(decrementStock).not.toHaveBeenCalled();
  });

  it("re-prices from the current product doc, ignoring any client-supplied price, and places the order", async () => {
    Product.find.mockResolvedValue([
      { _id: validProductId, name: "Wave Tablet", price: 3499, stock: 10, images: [{ url: "img.jpg" }] },
    ]);
    decrementStock.mockResolvedValue();
    Order.create.mockResolvedValue({ _id: "o1", status: "pending" });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({
        // price/name here should be ignored entirely by the controller
        items: [{ product: validProductId, quantity: 2, price: 1 }],
        shippingAddress: validAddress,
      });

    expect(res.status).toBe(201);
    expect(decrementStock).toHaveBeenCalledWith(
      [expect.objectContaining({ product: validProductId, price: 3499, quantity: 2, image: "img.jpg" })],
      { orderId: "o1", actorUser: "user123" }
    );
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: "user123", itemsTotal: 6998, subtotal: 6998, shippingFee: 0, deliveryFee: 0, tax: 0, status: "pending" })
    );
  });

  it("applies a valid coupon: discounts itemsTotal, stores couponCode/discount, and records usage", async () => {
    Product.find.mockResolvedValue([
      { _id: validProductId, name: "Wave Tablet", price: 3499, stock: 10, images: [] },
    ]);
    Coupon.findOne.mockResolvedValue({
      _id: "c1",
      code: "SAVE10",
      type: "percent",
      value: 10,
      minOrderValue: 0,
      usageLimit: 0,
      usageCount: 0,
      status: "active",
      expiresAt: null,
    });
    Coupon.updateOne.mockResolvedValue({});
    decrementStock.mockResolvedValue();
    Order.create.mockResolvedValue({ _id: "o1", status: "pending" });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({
        items: [{ product: validProductId, quantity: 2 }],
        shippingAddress: validAddress,
        couponCode: "save10",
      });

    expect(res.status).toBe(201);
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ itemsTotal: 6298.2, subtotal: 6998, shippingFee: 0, couponCode: "SAVE10", discount: 699.8 })
    );
    expect(Coupon.findOneAndUpdate).toHaveBeenCalled();
    expect(CouponRedemption.create).toHaveBeenCalled();
    expect(CouponRedemption.create.mock.calls[0][0][0]).toEqual(expect.objectContaining({ order: "o1", user: "user123", status: "reserved" }));
  });

  it("rejects an order with an invalid coupon code and never touches stock", async () => {
    Product.find.mockResolvedValue([
      { _id: validProductId, name: "Wave Tablet", price: 3499, stock: 10, images: [] },
    ]);
    Coupon.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({
        items: [{ product: validProductId, quantity: 1 }],
        shippingAddress: validAddress,
        couponCode: "NOPE",
      });

    expect(res.status).toBe(404);
    expect(decrementStock).not.toHaveBeenCalled();
    expect(Order.create).not.toHaveBeenCalled();
  });

  it("does not record coupon usage if Order.create fails", async () => {
    Product.find.mockResolvedValue([
      { _id: validProductId, name: "Wave Tablet", price: 3499, stock: 10, images: [] },
    ]);
    Coupon.findOne.mockResolvedValue({
      _id: "c1",
      code: "SAVE10",
      type: "fixed",
      value: 100,
      minOrderValue: 0,
      usageLimit: 0,
      usageCount: 0,
      status: "active",
      expiresAt: null,
    });
    decrementStock.mockResolvedValue();
    Order.create.mockRejectedValue(new Error("db write failed"));

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({
        items: [{ product: validProductId, quantity: 1 }],
        shippingAddress: validAddress,
        couponCode: "SAVE10",
      });

    expect(res.status).toBe(500);
    expect(Coupon.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("restores stock if Order.create fails after stock was already decremented", async () => {
    Product.find.mockResolvedValue([
      { _id: validProductId, name: "Wave Tablet", price: 3499, stock: 10, images: [] },
    ]);
    decrementStock.mockResolvedValue();
    Order.create.mockRejectedValue(new Error("db write failed"));

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", authHeader)
      .send({ items: [{ product: validProductId, quantity: 1 }], shippingAddress: validAddress });

    expect(res.status).toBe(500);
  });
});

describe("GET /api/orders", () => {
  it("scopes results to the authenticated user only", async () => {
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([]);
    Order.find.mockReturnValue({ sort, skip, limit });
    Order.countDocuments.mockResolvedValue(0);

    const res = await request(app).get("/api/orders").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    // listMyOrders hard-filters on paymentVerifiedAt too — see
    // PROGRESS_ORDER_SIMPLIFICATION.md's Phase 1 order-visibility gate.
    expect(Order.find).toHaveBeenCalledWith({ user: "user123", paymentVerifiedAt: { $ne: null } });
  });

  it("ignores any attempt to filter by another user's id via query params", async () => {
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([]);
    Order.find.mockReturnValue({ sort, skip, limit });
    Order.countDocuments.mockResolvedValue(0);

    await request(app).get("/api/orders").query({ user: "someone-else" }).set("Authorization", authHeader);

    expect(Order.find).toHaveBeenCalledWith({ user: "user123", paymentVerifiedAt: { $ne: null } });
  });

  it("attaches a paymentStatus of \"paid\" when any payment attempt for the order succeeded", async () => {
    const orderDoc = { _id: "o1", user: "user123", toJSON: () => ({ _id: "o1", user: "user123" }) };
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([orderDoc]);
    Order.find.mockReturnValue({ sort, skip, limit });
    Order.countDocuments.mockResolvedValue(1);
    Payment.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { order: "o1", status: "failed" },
        { order: "o1", status: "paid" },
      ]),
    });

    const res = await request(app).get("/api/orders").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.items[0].paymentStatus).toBe("paid");
  });
});

describe("GET /api/orders/:id", () => {
  it("returns 404 when the order doesn't belong to the requesting user", async () => {
    Order.findOne.mockResolvedValue(null);

    const res = await request(app).get("/api/orders/o1").set("Authorization", authHeader);

    expect(res.status).toBe(404);
    // getMyOrderById hard-filters on paymentVerifiedAt too — see
    // PROGRESS_ORDER_SIMPLIFICATION.md's Phase 1 order-visibility gate.
    expect(Order.findOne).toHaveBeenCalledWith({ _id: "o1", user: "user123", paymentVerifiedAt: { $ne: null } });
  });

  it("returns the order with an \"unpaid\" paymentStatus when it has no Payment yet", async () => {
    Order.findOne.mockResolvedValue({
      _id: "o1",
      user: "user123",
      status: "pending",
      paymentVerifiedAt: new Date(),
      toJSON: () => ({ _id: "o1", user: "user123", status: "pending" }),
    });
    Payment.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });

    const res = await request(app).get("/api/orders/o1").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.order._id).toBe("o1");
    expect(res.body.order.paymentStatus).toBe("unpaid");
  });
});
