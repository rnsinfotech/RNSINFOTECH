const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Category");
jest.mock("../src/models/Product");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");
const { signAccessToken } = require("../src/services/token.service");

AdminUser.ROLES = ["Owner", "Manager", "Staff"];

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin123", "Owner")}`;

beforeEach(() => {
  jest.clearAllMocks();
  // Every route in this router calls requireAdmin first, which re-fetches
  // the admin from the DB — mock that lookup once here so every test below
  // only has to set up the Category/Product expectations it actually cares
  // about.
  AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
});

describe("categories router auth", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/categories", () => {
  it("lists categories with pagination", async () => {
    const items = [{ _id: "c1", name: "Pen Tablets" }];
    Category.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(items),
    });
    Category.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/api/categories").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(items);
    expect(res.body.total).toBe(1);
  });
});

describe("POST /api/categories", () => {
  it("rejects a missing name with 400", async () => {
    const res = await request(app).post("/api/categories").set("Authorization", authHeader).send({});
    expect(res.status).toBe(400);
  });

  it("creates a category with a generated slug", async () => {
    Category.exists.mockResolvedValue(false);
    Category.create.mockResolvedValue({ _id: "c1", name: "Pen Tablets", slug: "pen-tablets" });

    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", authHeader)
      .send({ name: "Pen Tablets" });

    expect(res.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Pen Tablets", slug: "pen-tablets" }));
  });

  it("appends a numeric suffix when the slug is already taken", async () => {
    Category.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    Category.create.mockResolvedValue({ _id: "c2", name: "Pen Tablets", slug: "pen-tablets-2" });

    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", authHeader)
      .send({ name: "Pen Tablets" });

    expect(res.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith(expect.objectContaining({ slug: "pen-tablets-2" }));
  });
});

describe("DELETE /api/categories/:id", () => {
  it("returns 404 for an unknown category", async () => {
    Category.findById.mockResolvedValue(null);

    const res = await request(app).delete("/api/categories/c404").set("Authorization", authHeader);

    expect(res.status).toBe(404);
  });

  it("refuses to delete a category that still has products", async () => {
    Category.findById.mockResolvedValue({ _id: "c1", image: {} });
    Product.exists.mockResolvedValue(true);

    const res = await request(app).delete("/api/categories/c1").set("Authorization", authHeader);

    expect(res.status).toBe(409);
  });

  it("deletes a category with no products assigned", async () => {
    const deleteOne = jest.fn().mockResolvedValue(true);
    Category.findById.mockResolvedValue({ _id: "c1", image: {}, deleteOne });
    Product.exists.mockResolvedValue(false);

    const res = await request(app).delete("/api/categories/c1").set("Authorization", authHeader);

    expect(res.status).toBe(204);
    expect(deleteOne).toHaveBeenCalled();
  });
});
