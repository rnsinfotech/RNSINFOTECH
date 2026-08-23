const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Product");
jest.mock("../src/models/InventoryLog");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Product = require("../src/models/Product");
const InventoryLog = require("../src/models/InventoryLog");
const { signAccessToken } = require("../src/services/token.service");
jest.mock("../src/services/inventory.service");
const { adjustProductStock } = require("../src/services/inventory.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin123", "Owner")}`;

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
  AdminUser.ROLES = ["Owner", "Manager", "Staff"];
  adjustProductStock.mockResolvedValue({ _id: "p1", name: "Wave Pen Tablet", sku: "RNS-WAVE", stock: 8 });
  InventoryLog.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue({ _id: "adj1" }) });
});

describe("GET /api/inventory/stats", () => {
  it("returns in-stock / low-stock / out-of-stock totals", async () => {
    Product.find.mockResolvedValue([
      { stock: 10 },
      { stock: 4 },
      { stock: 0 },
      { stock: 8 },
    ]);

    const res = await request(app).get("/api/inventory/stats").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total: 4,
      inStock: 2,
      lowStock: 1,
      outOfStock: 1,
    });
  });
});

describe("POST /api/inventory/adjustments", () => {
  it("updates stock and creates an audit log entry", async () => {
    adjustProductStock.mockResolvedValue({ _id: "507f1f77bcf86cd799439011", name: "Wave Pen Tablet", sku: "RNS-WAVE", stock: 8 });

    const res = await request(app)
      .post("/api/inventory/adjustments")
      .set("Authorization", authHeader)
      .send({ productId: "507f1f77bcf86cd799439011", delta: 3, reason: "Restock" });

    expect(res.status).toBe(201);
    expect(adjustProductStock).toHaveBeenCalledWith("507f1f77bcf86cd799439011", 3, expect.objectContaining({ actorType: "admin", reason: "Restock" }));
  });

  it("clamps stock at zero and logs the actual delta", async () => {
    adjustProductStock.mockResolvedValue({ _id: "507f1f77bcf86cd799439012", name: "Mini Display", sku: "RNS-MINI", stock: 0 });

    const res = await request(app)
      .post("/api/inventory/adjustments")
      .set("Authorization", authHeader)
      .send({ productId: "507f1f77bcf86cd799439012", delta: -10, reason: "Damaged" });

    expect(res.status).toBe(201);
    expect(adjustProductStock).toHaveBeenCalledWith("507f1f77bcf86cd799439012", -10, expect.objectContaining({ actorType: "admin", reason: "Damaged" }));
  });
});

describe("GET /api/inventory/adjustments", () => {
  it("returns the recent inventory adjustment log", async () => {
    InventoryLog.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { _id: "adj1", productName: "Wave Pen Tablet", delta: 3 },
      ]),
    });
    InventoryLog.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/api/inventory/adjustments").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});
