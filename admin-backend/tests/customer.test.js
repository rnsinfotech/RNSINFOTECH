const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/User");
jest.mock("../src/models/Order");
jest.mock("../src/models/Address");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const User = require("../src/models/User");
const Order = require("../src/models/Order");
const Address = require("../src/models/Address");
const { signAccessToken } = require("../src/services/token.service");

AdminUser.ROLES = ["Owner", "Manager", "Staff"];

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin123", "Staff")}`;

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Staff" });
});

describe("customers router auth", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/customers", () => {
  it("lists customers with pagination and joined order stats", async () => {
    const userDoc = {
      _id: "u1",
      toJSON: () => ({ _id: "u1", name: "Prakhar", email: "prakhar@example.com" }),
    };
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([userDoc]);
    User.find.mockReturnValue({ sort, skip, limit });
    User.countDocuments.mockResolvedValue(1);
    Order.aggregate.mockResolvedValue([
      { _id: "u1", orderCount: 3, totalSpent: 1500, lastOrderAt: "2026-08-01T00:00:00.000Z" },
    ]);

    const res = await request(app).get("/api/customers").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].orderCount).toBe(3);
    expect(res.body.items[0].totalSpent).toBe(1500);
    expect(res.body.total).toBe(1);
  });

  it("defaults a customer with no orders yet to zeroed stats instead of omitting them", async () => {
    const userDoc = {
      _id: "u2",
      toJSON: () => ({ _id: "u2", name: "New Customer", email: "new@example.com" }),
    };
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([userDoc]);
    User.find.mockReturnValue({ sort, skip, limit });
    User.countDocuments.mockResolvedValue(1);
    Order.aggregate.mockResolvedValue([]);

    const res = await request(app).get("/api/customers").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.items[0].orderCount).toBe(0);
    expect(res.body.items[0].totalSpent).toBe(0);
    expect(res.body.items[0].lastOrderAt).toBeNull();
  });

  it("filters by a case-insensitive name/email search", async () => {
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([]);
    User.find.mockReturnValue({ sort, skip, limit });
    User.countDocuments.mockResolvedValue(0);
    Order.aggregate.mockResolvedValue([]);

    const res = await request(app).get("/api/customers?search=prakhar").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(User.find).toHaveBeenCalledWith({
      $or: [{ name: { $regex: "prakhar", $options: "i" } }, { email: { $regex: "prakhar", $options: "i" } }],
    });
  });
});

describe("GET /api/customers/:id", () => {
  it("returns 404 when the customer doesn't exist", async () => {
    User.findById.mockResolvedValue(null);

    const res = await request(app).get("/api/customers/u1").set("Authorization", authHeader);

    expect(res.status).toBe(404);
  });

  it("returns the customer joined with their orders and addresses", async () => {
    User.findById.mockResolvedValue({ _id: "u1", name: "Prakhar" });
    const orderSort = jest.fn().mockResolvedValue([{ _id: "o1", status: "shipped" }]);
    Order.find.mockReturnValue({ sort: orderSort });
    const addressSort = jest.fn().mockResolvedValue([{ _id: "a1", isDefault: true }]);
    Address.find.mockReturnValue({ sort: addressSort });

    const res = await request(app).get("/api/customers/u1").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.customer._id).toBe("u1");
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.addresses).toHaveLength(1);
    expect(Order.find).toHaveBeenCalledWith({ user: "u1" });
    expect(Address.find).toHaveBeenCalledWith({ user: "u1" });
  });
});
