const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Product");
jest.mock("../src/models/Review");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Product = require("../src/models/Product");
const Review = require("../src/models/Review");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin-123", "Owner")}`;

describe("GET /api/reviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AdminUser.findById.mockResolvedValue({ _id: "admin-123", isActive: true, role: "Owner" });
  });

  it("requires admin auth", async () => {
    const res = await request(app).get("/api/reviews");
    expect(res.status).toBe(401);
  });

  it("lists reviews with pagination", async () => {
    Review.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([{ _id: "r1", status: "pending" }]) });
    Review.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/api/reviews").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Review.find).toHaveBeenCalled();
    expect(res.body.total).toBe(1);
  });
});

describe("DELETE /api/reviews/:id", () => {
  it("deletes a review and updates the product aggregate", async () => {
    const deleteOne = jest.fn().mockResolvedValue(true);
    Review.findById.mockResolvedValue({ _id: "r1", product: "p1", deleteOne });
    Review.find.mockResolvedValue([]);
    Product.findByIdAndUpdate.mockResolvedValue({ _id: "p1" });

    const res = await request(app).delete("/api/reviews/r1").set("Authorization", authHeader);

    expect(res.status).toBe(204);
    expect(deleteOne).toHaveBeenCalled();
    expect(Product.findByIdAndUpdate).toHaveBeenCalledWith("p1", expect.objectContaining({ rating: expect.any(Number), reviewCount: expect.any(Number) }));
  });
});
