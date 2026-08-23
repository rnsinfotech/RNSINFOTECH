const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Brand");
jest.mock("../src/models/Product");
jest.mock("../src/models/FlashMessage");
jest.mock("../src/models/SiteSettings");
jest.mock("../src/models/Coupon");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Brand = require("../src/models/Brand");
const Product = require("../src/models/Product");
const FlashMessage = require("../src/models/FlashMessage");
const SiteSettings = require("../src/models/SiteSettings");
const Coupon = require("../src/models/Coupon");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const auth = `Bearer ${signAccessToken("admin123", "Owner")}`;

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
});

describe("Brands", () => {
  it("lists brands with product counts", async () => {
    Brand.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([{ _id: "b1", name: "Wacom", toJSON: () => ({ _id: "b1", name: "Wacom" }) }]) });
    Brand.countDocuments.mockResolvedValue(1);
    Product.countDocuments.mockResolvedValue(3);
    const res = await request(app).get("/api/brands").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ name: "Wacom", count: 3 });
  });

  it("rejects deleting a brand still assigned to products", async () => {
    Brand.findById.mockResolvedValue({ _id: "b1", name: "Wacom" });
    Product.countDocuments.mockResolvedValue(2);
    const res = await request(app).delete("/api/brands/b1").set("Authorization", auth);
    expect(res.status).toBe(409);
  });
});

describe("Website settings", () => {
  const settings = {
    homepage: { hero: { title: "Old" }, promo: {}, whyChooseUs: [], solutions: [], testimonials: [] },
    save: jest.fn().mockResolvedValue(true),
  };
  beforeEach(() => {
    SiteSettings.DEFAULT_STORE_PROFILE = {};
    SiteSettings.DEFAULT_COMMERCE = {};
    SiteSettings.DEFAULT_HOMEPAGE = settings.homepage;
    SiteSettings.findOneAndUpdate.mockResolvedValue(settings);
  });

  it("persists homepage section changes through Mongo model", async () => {
    const res = await request(app).patch("/api/website/hero").set("Authorization", auth).send({ title: "New", subtitle: "Updated" });
    expect(res.status).toBe(200);
    expect(settings.save).toHaveBeenCalled();
    expect(settings.homepage.hero).toEqual({ title: "New", subtitle: "Updated" });
  });

  it("creates and deletes homepage list items", async () => {
    const created = await request(app).post("/api/website/whyChooseUs/items").set("Authorization", auth).send({ icon: "truck", title: "Fast", body: "Quick delivery" });
    expect(created.status).toBe(201);
    const id = created.body.item.id;
    expect(settings.homepage.whyChooseUs).toHaveLength(1);
    const removed = await request(app).delete(`/api/website/whyChooseUs/items/${id}`).set("Authorization", auth);
    expect(removed.status).toBe(204);
    expect(settings.homepage.whyChooseUs).toHaveLength(0);
  });
});

describe("Flash messages", () => {
  it("creates, updates and reorders persisted flash messages", async () => {
    FlashMessage.findOne.mockReturnValue({ sort: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue({ sortOrder: 1 }) });
    FlashMessage.create.mockResolvedValue({ _id: "f1", message: "Sale", sortOrder: 2 });
    const created = await request(app).post("/api/flash-messages").set("Authorization", auth).send({ message: "Sale" });
    expect(created.status).toBe(201);
    expect(FlashMessage.create).toHaveBeenCalledWith(expect.objectContaining({ message: "Sale", sortOrder: 2 }));
  });
});

describe("Coupons", () => {
  it("returns usage statistics from MongoDB", async () => {
    Coupon.countDocuments.mockResolvedValueOnce(4).mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    Coupon.aggregate.mockResolvedValue([{ totalRedemptions: 128 }]);
    const res = await request(app).get("/api/coupons/stats").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 4, active: 3, expired: 1, totalRedemptions: 128 });
  });
});
