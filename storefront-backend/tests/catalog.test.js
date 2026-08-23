const request = require("supertest");

jest.mock("../src/models/Category");
jest.mock("../src/models/Product");

const createApp = require("../src/app");
const Category = require("../src/models/Category");
const Product = require("../src/models/Product");

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/categories", () => {
  it("is public — no Authorization header required", async () => {
    Category.find.mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) });

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
  });

  it("only queries active categories", async () => {
    const lean = jest.fn().mockResolvedValue([{ _id: "c1", name: "Pen Tablets" }]);
    const sort = jest.fn().mockReturnValue({ lean });
    Category.find.mockReturnValue({ sort });

    const res = await request(app).get("/api/categories");

    expect(res.status).toBe(200);
    expect(Category.find).toHaveBeenCalledWith({ isActive: true });
    expect(res.body.items).toHaveLength(1);
  });
});

describe("GET /api/categories/:slug", () => {
  it("returns 404 for an inactive or unknown category", async () => {
    Category.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const res = await request(app).get("/api/categories/discontinued-line");

    expect(res.status).toBe(404);
  });

  it("returns the category by slug", async () => {
    Category.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "c1", slug: "pen-tablets", name: "Pen Tablets" }) });

    const res = await request(app).get("/api/categories/pen-tablets");

    expect(res.status).toBe(200);
    expect(Category.findOne).toHaveBeenCalledWith({ slug: "pen-tablets", isActive: true });
    expect(res.body.category.slug).toBe("pen-tablets");
  });
});

describe("GET /api/products", () => {
  it("always forces isActive: true regardless of query params", async () => {
    const populate = jest.fn().mockReturnThis();
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockReturnThis();
    const lean = jest.fn().mockResolvedValue([]);
    Product.find.mockReturnValue({ populate, sort, skip, limit, lean });
    Product.countDocuments.mockResolvedValue(0);

    const res = await request(app).get("/api/products").query({ isActive: "false" });

    expect(res.status).toBe(200);
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
  });

  it("resolves a category slug filter to an id before querying products", async () => {
    Category.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue({ _id: "c1" }) });
    const populate = jest.fn().mockReturnThis();
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockReturnThis();
    const lean = jest.fn().mockResolvedValue([]);
    Product.find.mockReturnValue({ populate, sort, skip, limit, lean });
    Product.countDocuments.mockResolvedValue(0);

    const res = await request(app).get("/api/products").query({ category: "pen-tablets" });

    expect(res.status).toBe(200);
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ category: "c1" }));
  });

  it("returns an empty result set for an unknown category filter instead of an error", async () => {
    Category.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    const populate = jest.fn().mockReturnThis();
    const sort = jest.fn().mockReturnThis();
    const skip = jest.fn().mockReturnThis();
    const limit = jest.fn().mockReturnThis();
    const lean = jest.fn().mockResolvedValue([]);
    Product.find.mockReturnValue({ populate, sort, skip, limit, lean });
    Product.countDocuments.mockResolvedValue(0);

    const res = await request(app).get("/api/products").query({ category: "does-not-exist" });

    expect(res.status).toBe(200);
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ category: null }));
  });

  it("rejects an invalid sort value with 400", async () => {
    const res = await request(app).get("/api/products").query({ sort: "cheapest-first" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/homepage-products", () => {
  function mockFindChain(result) {
    return {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(result),
    };
  }

  it("is public — no Authorization header required", async () => {
    Product.find.mockReturnValue(mockFindChain([]));
    Product.aggregate.mockResolvedValue([]);

    const res = await request(app).get("/api/homepage-products");

    expect(res.status).toBe(200);
  });

  it("returns all four rails in one response", async () => {
    Product.find.mockReturnValue(mockFindChain([]));
    Product.aggregate.mockResolvedValue([]);

    const res = await request(app).get("/api/homepage-products");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        featured: expect.any(Array),
        bestSellers: expect.any(Array),
        newArrivals: expect.any(Array),
        discounted: expect.any(Array),
      })
    );
  });

  it("filters featured/bestSellers/newArrivals rails to isActive: true only", async () => {
    Product.find.mockReturnValue(mockFindChain([]));
    Product.aggregate.mockResolvedValue([]);

    await request(app).get("/api/homepage-products");

    const calledFilters = Product.find.mock.calls.map(([filter]) => filter);
    calledFilters.forEach((filter) => expect(filter).toEqual(expect.objectContaining({ isActive: true })));
    expect(calledFilters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isFeatured: true }),
        expect.objectContaining({ isBestSeller: true }),
      ])
    );
  });

  it("sorts featured by homepageFeaturedOrder and bestSellers by homepageBestSellerOrder", async () => {
    const featuredChain = mockFindChain([]);
    const bestSellerChain = mockFindChain([]);
    const newArrivalsChain = mockFindChain([]);
    Product.find
      .mockReturnValueOnce(featuredChain)
      .mockReturnValueOnce(bestSellerChain)
      .mockReturnValueOnce(newArrivalsChain);
    Product.aggregate.mockResolvedValue([]);

    await request(app).get("/api/homepage-products");

    expect(featuredChain.sort).toHaveBeenCalledWith({ homepageFeaturedOrder: 1 });
    expect(bestSellerChain.sort).toHaveBeenCalledWith({ homepageBestSellerOrder: 1 });
    expect(newArrivalsChain.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it("caps every rail at 8 via limit()", async () => {
    const chain = mockFindChain([]);
    Product.find.mockReturnValue(chain);
    Product.aggregate.mockResolvedValue([]);

    await request(app).get("/api/homepage-products");

    expect(chain.limit).toHaveBeenCalledWith(8);
  });

  it("computes the discounted rail via aggregation on mrp vs price, capped at 8", async () => {
    Product.find.mockReturnValue(mockFindChain([]));
    Product.aggregate.mockResolvedValue([{ _id: "p1", name: "Wave Pen Tablet", price: 4000, mrp: 5000, discountPercent: 20 }]);

    const res = await request(app).get("/api/homepage-products");

    expect(res.status).toBe(200);
    expect(res.body.discounted).toEqual([expect.objectContaining({ discountPercent: 20 })]);
    const pipeline = Product.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual(expect.objectContaining({ $match: expect.objectContaining({ isActive: true }) }));
    expect(pipeline.some((stage) => stage.$limit === 8)).toBe(true);
  });

  it("applies discountPercent to featured/bestSellers/newArrivals rails same as /api/products", async () => {
    const featuredChain = mockFindChain([{ _id: "p1", price: 8000, mrp: 10000 }]);
    Product.find.mockReturnValueOnce(featuredChain).mockReturnValue(mockFindChain([]));
    Product.aggregate.mockResolvedValue([]);

    const res = await request(app).get("/api/homepage-products");

    expect(res.body.featured[0].discountPercent).toBe(20);
  });
});

describe("GET /api/products/:slug", () => {
  it("returns 404 for an inactive or unknown product", async () => {
    Product.findOne.mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) });

    const res = await request(app).get("/api/products/discontinued-tablet");

    expect(res.status).toBe(404);
  });

  it("returns the product by slug", async () => {
    Product.findOne.mockReturnValue({
      populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "p1", slug: "wave-pen-tablet", name: "Wave Pen Tablet", price: 8000, mrp: 10000 }) }),
    });

    const res = await request(app).get("/api/products/wave-pen-tablet");

    expect(res.status).toBe(200);
    expect(res.body.product.slug).toBe("wave-pen-tablet");
    expect(res.body.product.discountPercent).toBe(20);
  });
});
