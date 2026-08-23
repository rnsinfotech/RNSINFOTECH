const request = require("supertest");

jest.mock("../src/models/Coupon");

const createApp = require("../src/app");
const Coupon = require("../src/models/Coupon");

const app = createApp();

describe("POST /api/coupons/validate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 404 for an unknown coupon code", async () => {
    Coupon.findOne.mockResolvedValue(null);

    const res = await request(app).post("/api/coupons/validate").send({ code: "SAVE10", orderTotal: 1000 });

    expect(res.status).toBe(404);
  });

  it("accepts a valid active coupon for a large enough order", async () => {
    Coupon.findOne.mockResolvedValue({
      _id: "c1",
      code: "SAVE10",
      type: "percent",
      value: 10,
      minOrderValue: 500,
      usageLimit: 50,
      usageCount: 2,
      status: "active",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const res = await request(app).post("/api/coupons/validate").send({ code: "SAVE10", orderTotal: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.discount).toBe(100);
  });
});
