const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Order");
jest.mock("../src/models/Product");
jest.mock("../src/models/InventoryLog");
jest.mock("../src/models/User");
jest.mock("../src/models/SiteSettings");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Order = require("../src/models/Order");
const Product = require("../src/models/Product");
const InventoryLog = require("../src/models/InventoryLog");
const User = require("../src/models/User");
const SiteSettings = require("../src/models/SiteSettings");
const { signAccessToken } = require("../src/services/token.service");

AdminUser.ROLES = ["Owner", "Manager", "Staff"];

const app = createApp();
const ownerAuthHeader = `Bearer ${signAccessToken("admin123", "Owner")}`;
const staffAuthHeader = `Bearer ${signAccessToken("admin456", "Staff")}`;

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
});

describe("GET /api/dashboard/summary", () => {
  it("returns the dashboard metrics and recent activity", async () => {
    // Small helper for mocking Mongoose query chains: every intermediate
    // method (select/sort/limit/populate) returns the same chainable
    // object, and .lean() resolves with the given data — matching how
    // the controller actually chains these calls.
    const chainable = (data) => {
      const chain = {};
      ["select", "sort", "limit", "populate"].forEach((method) => {
        chain[method] = jest.fn().mockReturnValue(chain);
      });
      chain.lean = jest.fn().mockResolvedValue(data);
      return chain;
    };

    SiteSettings.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ commerce: { lowStockThreshold: 8 } }),
    });
    // The controller calls Order.find({}) exactly once, for recentOrders.
    Order.find.mockReturnValue(
      chainable([
        { _id: "ord1", status: "confirmed", itemsTotal: 1200, createdAt: new Date(), user: { name: "Asha" } },
      ])
    );
    Order.countDocuments.mockResolvedValue(12);
    Order.aggregate.mockResolvedValue([
      { _id: "2026-08-08", sales: 42000 },
      { _id: "2026-08-09", sales: 58000 },
    ]);
    User.countDocuments.mockResolvedValue(2148);
    Product.find.mockReturnValue(
      chainable([{ name: "Stylus Pro", sku: "RNS-SP", stock: 2 }])
    );
    InventoryLog.find.mockReturnValue(
      chainable([{ _id: "adj1", productName: "Stylus Pro", reason: "Damaged", createdAt: new Date() }])
    );

    const res = await request(app).get("/api/dashboard/summary").set("Authorization", ownerAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.stats).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Sales (30d)" }),
      expect.objectContaining({ label: "Orders (30d)" }),
      expect.objectContaining({ label: "Customers" }),
      expect.objectContaining({ label: "Pending orders" }),
      expect.objectContaining({ label: "Low-stock products" }),
    ]));
    // The controller always returns a fixed 7-day trend (zero-filling days
    // with no sales) so the dashboard chart has a consistent x-axis —
    // it doesn't just echo back the aggregation's result count.
    expect(res.body.salesTrend).toHaveLength(7);
    expect(res.body.lowStock).toHaveLength(1);
    expect(res.body.recentOrders).toHaveLength(1);
    expect(res.body.recentActivity.length).toBeGreaterThan(0);
  });
});

describe("GET /api/staff", () => {
  it("lists admin staff accounts", async () => {
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([
      { _id: "a1", name: "Jane Doe", email: "jane@rns.com", role: "Owner", isActive: true },
    ]);
    AdminUser.find.mockReturnValue({ sort, skip, limit });
    AdminUser.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/api/staff").set("Authorization", ownerAuthHeader);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});

describe("POST /api/staff", () => {
  it("creates a staff account for an owner or manager", async () => {
    AdminUser.exists.mockResolvedValue(false);
    AdminUser.create.mockResolvedValue({ _id: "a2", name: "John Smith", email: "john@rns.com", role: "Manager" });

    const res = await request(app)
      .post("/api/staff")
      .set("Authorization", ownerAuthHeader)
      .send({ name: "John Smith", email: "john@rns.com", password: "welcome123", role: "Manager" });

    expect(res.status).toBe(201);
    expect(AdminUser.create).toHaveBeenCalled();
  });

  it("forbids staff-role staff from creating another account", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin456", isActive: true, role: "Staff" });

    const res = await request(app)
      .post("/api/staff")
      .set("Authorization", staffAuthHeader)
      .send({ name: "John Smith", email: "john@rns.com", password: "welcome123", role: "Manager" });

    expect(res.status).toBe(403);
  });
});
