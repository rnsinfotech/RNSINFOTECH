const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Product");
jest.mock("../src/models/Category");
jest.mock("../src/services/upload.service");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Product = require("../src/models/Product");
const Category = require("../src/models/Category");
const { uploadBuffer, destroyImage } = require("../src/services/upload.service");
const { signAccessToken } = require("../src/services/token.service");

AdminUser.ROLES = ["Owner", "Manager", "Staff"];
Product.PRODUCT_TYPES = ["Pen Tablet", "Pen Display", "Stylus", "Accessory"];

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin123", "Owner")}`;
const validCategoryId = "507f1f77bcf86cd799439011";
const validImageBuffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAA/UlEQVR4nO3RMQ0AMAzAsPIn3d5DsBw2gkiZJWV+B/AyJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQGENiDIkxJMaQmAP4K6zWNUjE4wAAAABJRU5ErkJggg==", "base64");

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Owner" });
});

describe("POST /api/products", () => {
  const basePayload = {
    name: "Wave Pen Tablet",
    category: validCategoryId,
    price: 3499,
    mrp: 3999,
  };

  it("rejects a missing category with 400", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader)
      .send({ name: "Wave Pen Tablet", price: 100, mrp: 100 });

    expect(res.status).toBe(400);
  });

  it("rejects price greater than mrp with 400", async () => {
    const res = await request(app)
      .post("/api/products")
      .set("Authorization", authHeader)
      .send({ ...basePayload, price: 5000, mrp: 3999 });

    expect(res.status).toBe(400);
  });

  it("rejects a category id that doesn't exist with 400", async () => {
    Category.exists.mockResolvedValue(false);

    const res = await request(app).post("/api/products").set("Authorization", authHeader).send(basePayload);

    expect(res.status).toBe(400);
  });

  it("creates a product with a generated slug and sku", async () => {
    Category.exists.mockResolvedValue(true);
    Product.exists.mockResolvedValue(false);
    Product.create.mockResolvedValue({ _id: "p1", ...basePayload, slug: "wave-pen-tablet" });

    const res = await request(app).post("/api/products").set("Authorization", authHeader).send(basePayload);

    expect(res.status).toBe(201);
    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Wave Pen Tablet", slug: "wave-pen-tablet", sku: expect.any(String) })
    );
  });

  it("uppercases an explicitly provided sku", async () => {
    Category.exists.mockResolvedValue(true);
    Product.exists.mockResolvedValue(false);
    Product.create.mockResolvedValue({ _id: "p1" });

    await request(app)
      .post("/api/products")
      .set("Authorization", authHeader)
      .send({ ...basePayload, sku: "wave-01" });

    expect(Product.create).toHaveBeenCalledWith(expect.objectContaining({ sku: "WAVE-01" }));
  });
});

describe("GET /api/products", () => {
  it("lists products with pagination and populated category", async () => {
    const populate = jest.fn().mockReturnThis();
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([{ _id: "p1", name: "Wave Pen Tablet" }]);
    Product.find.mockReturnValue({ populate, sort, skip, limit });
    Product.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/api/products").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(populate).toHaveBeenCalledWith("category", "name slug");
  });

  it("filters by isBestSeller", async () => {
    const populate = jest.fn().mockReturnThis();
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockResolvedValue([]);
    Product.find.mockReturnValue({ populate, sort, skip, limit });
    Product.countDocuments.mockResolvedValue(0);

    const res = await request(app).get("/api/products?isBestSeller=true").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ isBestSeller: true }));
  });
});

describe("POST /api/products — homepage curation on create", () => {
  const basePayload = {
    name: "Wave Pen Tablet",
    category: validCategoryId,
    price: 3499,
    mrp: 3999,
  };

  beforeEach(() => {
    Category.exists.mockResolvedValue(true);
    Product.exists.mockResolvedValue(false);
    Product.create.mockResolvedValue({ _id: "p1" });
  });

  it("leaves isFeatured/isBestSeller unset (false, null order) when not provided", async () => {
    await request(app).post("/api/products").set("Authorization", authHeader).send(basePayload);

    expect(Product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isFeatured: false,
        homepageFeaturedOrder: null,
        isBestSeller: false,
        homepageBestSellerOrder: null,
      })
    );
  });

  it("auto-assigns the next order slot when marked featured with no explicit order", async () => {
    Product.findOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ homepageFeaturedOrder: 2 }),
    });

    await request(app)
      .post("/api/products")
      .set("Authorization", authHeader)
      .send({ ...basePayload, isFeatured: true });

    expect(Product.create).toHaveBeenCalledWith(expect.objectContaining({ isFeatured: true, homepageFeaturedOrder: 3 }));
  });

  it("assigns order 0 for the first featured product", async () => {
    Product.findOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });

    await request(app)
      .post("/api/products")
      .set("Authorization", authHeader)
      .send({ ...basePayload, isBestSeller: true });

    expect(Product.create).toHaveBeenCalledWith(expect.objectContaining({ isBestSeller: true, homepageBestSellerOrder: 0 }));
  });

  it("respects an explicit order when provided alongside the flag", async () => {
    await request(app)
      .post("/api/products")
      .set("Authorization", authHeader)
      .send({ ...basePayload, isFeatured: true, homepageFeaturedOrder: 5 });

    expect(Product.create).toHaveBeenCalledWith(expect.objectContaining({ isFeatured: true, homepageFeaturedOrder: 5 }));
    expect(Product.findOne).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/products/:id — homepage curation on update", () => {
  function mockExistingProduct(overrides = {}) {
    const product = {
      _id: "p1",
      name: "Wave Pen Tablet",
      slug: "wave-pen-tablet",
      isFeatured: false,
      homepageFeaturedOrder: null,
      isBestSeller: false,
      homepageBestSellerOrder: null,
      save: jest.fn().mockResolvedValue(true),
      ...overrides,
    };
    Product.findById.mockResolvedValue(product);
    return product;
  }

  it("leaves curation fields untouched when not present in the request", async () => {
    const product = mockExistingProduct({ isFeatured: true, homepageFeaturedOrder: 1 });

    const res = await request(app).patch("/api/products/p1").set("Authorization", authHeader).send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(product.isFeatured).toBe(true);
    expect(product.homepageFeaturedOrder).toBe(1);
    expect(Product.findOne).not.toHaveBeenCalled();
  });

  it("nulls the order out when unmarking best-seller", async () => {
    const product = mockExistingProduct({ isBestSeller: true, homepageBestSellerOrder: 4 });

    await request(app).patch("/api/products/p1").set("Authorization", authHeader).send({ isBestSeller: false });

    expect(product.isBestSeller).toBe(false);
    expect(product.homepageBestSellerOrder).toBeNull();
  });

  it("nulls the order out when isBestSeller:false is sent alongside an order value", async () => {
    const product = mockExistingProduct({ isBestSeller: true, homepageBestSellerOrder: 4 });

    await request(app)
      .patch("/api/products/p1")
      .set("Authorization", authHeader)
      .send({ isBestSeller: false, homepageBestSellerOrder: 9 });

    expect(product.isBestSeller).toBe(false);
    expect(product.homepageBestSellerOrder).toBeNull();
  });

  it("auto-assigns the next order slot when newly marked featured with no explicit order", async () => {
    const product = mockExistingProduct();
    Product.findOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ homepageFeaturedOrder: 0 }),
    });

    await request(app).patch("/api/products/p1").set("Authorization", authHeader).send({ isFeatured: true });

    expect(product.isFeatured).toBe(true);
    expect(product.homepageFeaturedOrder).toBe(1);
  });

  it("keeps the existing order when the flag is re-sent unchanged with no order given", async () => {
    const product = mockExistingProduct({ isFeatured: true, homepageFeaturedOrder: 3 });

    await request(app).patch("/api/products/p1").set("Authorization", authHeader).send({ isFeatured: true });

    expect(product.homepageFeaturedOrder).toBe(3);
    expect(Product.findOne).not.toHaveBeenCalled();
  });

  it("reorders an already-curated product when only the order field is sent", async () => {
    const product = mockExistingProduct({ isFeatured: true, homepageFeaturedOrder: 3 });

    await request(app).patch("/api/products/p1").set("Authorization", authHeader).send({ homepageFeaturedOrder: 7 });

    expect(product.isFeatured).toBe(true);
    expect(product.homepageFeaturedOrder).toBe(7);
  });
});

describe("POST /api/products/:id/images", () => {
  it("rejects with no files attached", async () => {
    Product.findById.mockResolvedValue({ _id: "p1", images: [] });

    const res = await request(app).post("/api/products/p1/images").set("Authorization", authHeader);

    expect(res.status).toBe(400);
  });

  it("uploads and appends images to the product", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const images = [];
    images.push = Array.prototype.push.bind(images);
    Product.findById.mockResolvedValue({ _id: "p1", images, save });
    uploadBuffer.mockResolvedValue({ url: "https://cloudinary.test/img.jpg", publicId: "rns/products/img" });

    const res = await request(app)
      .post("/api/products/p1/images")
      .set("Authorization", authHeader)
      .attach("images", validImageBuffer, { filename: "tablet.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(uploadBuffer).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });

  it("rejects a spoofed image MIME type when the file signature is not an image", async () => {
    Product.findById.mockResolvedValue({ _id: "p1", images: [] });

    const res = await request(app)
      .post("/api/products/p1/images")
      .set("Authorization", authHeader)
      .attach("images", Buffer.from("plain text pretending to be a png"), { filename: "fake.png", contentType: "image/png" });

    expect(res.status).toBe(400);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });

  it("rejects a disallowed file type with 400", async () => {
    Product.findById.mockResolvedValue({ _id: "p1", images: [] });

    const res = await request(app)
      .post("/api/products/p1/images")
      .set("Authorization", authHeader)
      .attach("images", Buffer.from("not-an-image"), { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(uploadBuffer).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/products/:id/images/:imageId", () => {
  it("replaces an existing image and destroys the old Cloudinary asset", async () => {
    const image = { publicId: "rns/products/old", url: "https://old.test/img.png" };
    const save = jest.fn().mockResolvedValue(true);
    Product.findById.mockResolvedValue({ _id: "p1", images: { id: jest.fn().mockReturnValue(image) }, save });
    uploadBuffer.mockResolvedValue({ url: "https://cloudinary.test/new.png", publicId: "rns/products/new" });

    const res = await request(app)
      .patch("/api/products/p1/images/img1")
      .set("Authorization", authHeader)
      .attach("image", validImageBuffer, { filename: "tablet.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(image.url).toBe("https://cloudinary.test/new.png");
    expect(image.publicId).toBe("rns/products/new");
    expect(destroyImage).toHaveBeenCalledWith("rns/products/old");
    expect(save).toHaveBeenCalled();
  });
});

describe("POST /api/products/bulk", () => {
  it("activates selected products", async () => {
    Product.updateMany.mockResolvedValue({ matchedCount: 2, modifiedCount: 2 });
    const res = await request(app)
      .post("/api/products/bulk")
      .set("Authorization", authHeader)
      .send({ ids: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"], action: "activate" });

    expect(res.status).toBe(200);
    expect(Product.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"] } },
      { $set: { isActive: true } }
    );
  });

  it("requires manager or owner for bulk category changes", async () => {
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: true, role: "Staff" });
    const res = await request(app)
      .post("/api/products/bulk")
      .set("Authorization", authHeader)
      .send({ ids: ["507f1f77bcf86cd799439011"], action: "change-category", categoryId: validCategoryId });

    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/products/:id/images/:imageId", () => {
  it("returns 404 when the image id isn't on the product", async () => {
    Product.findById.mockResolvedValue({ _id: "p1", images: { id: jest.fn().mockReturnValue(null) } });

    const res = await request(app).delete("/api/products/p1/images/img1").set("Authorization", authHeader);

    expect(res.status).toBe(404);
  });

  it("removes the image and destroys the Cloudinary asset", async () => {
    const deleteOne = jest.fn();
    const image = { publicId: "rns/products/img", deleteOne };
    const save = jest.fn().mockResolvedValue(true);
    Product.findById.mockResolvedValue({ _id: "p1", images: { id: jest.fn().mockReturnValue(image) }, save });

    const res = await request(app).delete("/api/products/p1/images/img1").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(destroyImage).toHaveBeenCalledWith("rns/products/img");
    expect(deleteOne).toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });
});
