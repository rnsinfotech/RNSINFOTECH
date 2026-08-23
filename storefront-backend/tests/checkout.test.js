const request = require("supertest");

jest.mock("../src/models/Product");
jest.mock("../src/models/Coupon");
jest.mock("../src/models/SiteSettings");

const createApp = require("../src/app");
const Product = require("../src/models/Product");
const Coupon = require("../src/models/Coupon");
const SiteSettings = require("../src/models/SiteSettings");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("user123")}`;
const productId = "507f1f77bcf86cd799439011";

beforeEach(() => {
  jest.clearAllMocks();
  SiteSettings.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({
    commerce: {
      freeShippingThreshold: 5000,
      flatShippingFee: 199,
      taxRate: 18,
      standardDeliveryFee: 149,
    },
  })});
});

describe("POST /api/checkout/quote", () => {
  it("rejects unauthenticated quote requests", async () => {
    const res = await request(app).post("/api/checkout/quote").send({
      items: [{ product: productId, quantity: 1 }],
    });
    expect(res.status).toBe(401);
  });

  it("returns the server-generated exact quote and ignores client prices", async () => {
    Product.find.mockResolvedValue([{
      _id: productId,
      name: "Wave Tablet",
      price: 3499,
      stock: 10,
      images: [{ url: "img.jpg" }],
    }]);

    const res = await request(app)
      .post("/api/checkout/quote")
      .set("Authorization", authHeader)
      .send({
        items: [{ product: productId, quantity: 2, price: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.quote).toMatchObject({
      subtotal: 6998,
      shippingFee: 0,
      deliveryFee: 149,
      tax: 1286.46,
      total: 8433.46,
    });
  });

  it("applies a coupon using the same pricing engine", async () => {
    Product.find.mockResolvedValue([{
      _id: productId,
      name: "Wave Tablet",
      price: 3499,
      stock: 10,
      images: [],
    }]);
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

    const res = await request(app)
      .post("/api/checkout/quote")
      .set("Authorization", authHeader)
      .send({
        items: [{ product: productId, quantity: 1 }],
        couponCode: "save10",
      });

    expect(res.status).toBe(200);
    expect(res.body.quote).toMatchObject({
      couponCode: "SAVE10",
      subtotal: 3499,
      discount: 349.9,
      shippingFee: 199,
      deliveryFee: 149,
      tax: 629.48,
      total: 4126.58,
    });
  });
});
