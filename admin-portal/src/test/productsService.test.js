import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the Phase 1–4 homepage-curation build: before
// this build, a product's homepage placement was driven by a single
// `tag` string ("featured" | "new" | "best-seller" | "discounted" |
// "none"), which is why Featured/New Arrivals/Best Sellers on the
// storefront homepage always showed the same products — a product could
// only ever match one rail. These tests guard the fix at the
// admin-portal boundary: `tags[]` must stay a real freeform array
// (decoupled from curation), and `isFeatured`/`isBestSeller` must be
// independent booleans a product can hold at the same time.

vi.mock("../lib/adminApi", () => ({
  adminApiRequest: vi.fn(),
  adminApiUpload: vi.fn(),
}));

vi.mock("../services/settingsService", () => ({
  getLowStockThresholdSync: vi.fn(() => 5),
}));

import { adminApiRequest } from "../lib/adminApi";
import { getProduct, createProduct, updateProductCuration } from "../services/productsService";

describe("productsService — homepage curation fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizeProduct keeps the full tags[] array instead of truncating to the first tag", async () => {
    adminApiRequest.mockResolvedValue({
      product: {
        _id: "p1",
        name: "Pen Tablet Pro",
        tags: ["bundle", "limited", "trending"],
        isFeatured: false,
        isBestSeller: false,
        price: 1000,
        mrp: 1200,
        stock: 10,
      },
    });

    const product = await getProduct("p1");
    expect(product.tags).toEqual(["bundle", "limited", "trending"]);
    // read-only convenience field for any caller not yet moved to `tags`
    expect(product.tag).toBe("bundle");
  });

  it("a product can be both Featured and Best Seller at once (the bug this build fixes)", async () => {
    adminApiRequest.mockResolvedValue({
      product: {
        _id: "p2",
        name: "Pen Display 22",
        tags: [],
        isFeatured: true,
        homepageFeaturedOrder: 0,
        isBestSeller: true,
        homepageBestSellerOrder: 2,
        price: 5000,
        mrp: 5000,
        stock: 3,
      },
    });

    const product = await getProduct("p2");
    // Before this build, a product's single `tag` value meant it could
    // only ever be featured OR best-seller OR new — never more than one
    // rail at a time. These must now be fully independent.
    expect(product.isFeatured).toBe(true);
    expect(product.isBestSeller).toBe(true);
    expect(product.homepageFeaturedOrder).toBe(0);
    expect(product.homepageBestSellerOrder).toBe(2);
  });

  it("normalizeProduct defaults homepage order fields to null when absent", async () => {
    adminApiRequest.mockResolvedValue({
      product: { _id: "p3", name: "Stylus", price: 500, mrp: 500 },
    });

    const product = await getProduct("p3");
    expect(product.isFeatured).toBe(false);
    expect(product.isBestSeller).toBe(false);
    expect(product.homepageFeaturedOrder).toBeNull();
    expect(product.homepageBestSellerOrder).toBeNull();
  });

  it("createProduct sends tags[] as-is and isFeatured/isBestSeller as real booleans, not derived from a tag", async () => {
    adminApiRequest.mockResolvedValue({ product: { _id: "new1" } });

    await createProduct({
      name: "New Item",
      categoryId: "cat1",
      brand: "RNS",
      sku: "SKU1",
      price: "100",
      mrp: "100",
      stockQty: "5",
      status: "active",
      tags: ["Sale", "  bundle "],
      isFeatured: true,
      isBestSeller: false,
      shortDescription: "",
      description: "",
      highlights: [],
      specs: [],
    });

    const [, options] = adminApiRequest.mock.calls[0];
    expect(options.body.tags).toEqual(["sale", "bundle"]);
    expect(options.body.isFeatured).toBe(true);
    expect(options.body.isBestSeller).toBe(false);
    // no old single "tag" field should ever be sent again
    expect(options.body.tag).toBeUndefined();
  });

  it("createProduct omits homepage order fields when left blank, so the backend auto-assigns", async () => {
    adminApiRequest.mockResolvedValue({ product: { _id: "new2" } });

    await createProduct({
      name: "New Item",
      categoryId: "cat1",
      brand: "RNS",
      sku: "SKU2",
      price: "100",
      mrp: "100",
      stockQty: "5",
      status: "active",
      tags: [],
      isFeatured: true,
      homepageFeaturedOrder: "",
      isBestSeller: false,
      homepageBestSellerOrder: "",
      shortDescription: "",
      description: "",
      highlights: [],
      specs: [],
    });

    const [, options] = adminApiRequest.mock.calls[0];
    expect(options.body).not.toHaveProperty("homepageFeaturedOrder");
    expect(options.body).not.toHaveProperty("homepageBestSellerOrder");
  });

  it("createProduct includes an explicit homepage order when the admin set one", async () => {
    adminApiRequest.mockResolvedValue({ product: { _id: "new3" } });

    await createProduct({
      name: "New Item",
      categoryId: "cat1",
      brand: "RNS",
      sku: "SKU3",
      price: "100",
      mrp: "100",
      stockQty: "5",
      status: "active",
      tags: [],
      isFeatured: true,
      homepageFeaturedOrder: "3",
      isBestSeller: false,
      shortDescription: "",
      description: "",
      highlights: [],
      specs: [],
    });

    const [, options] = adminApiRequest.mock.calls[0];
    expect(options.body.homepageFeaturedOrder).toBe(3);
  });

  it("updateProductCuration sends only the changed field(s) — a minimal PATCH, not a full product payload", async () => {
    adminApiRequest.mockResolvedValue({ product: { _id: "p4", isBestSeller: true } });

    await updateProductCuration("p4", { isBestSeller: true });

    const [path, options] = adminApiRequest.mock.calls[0];
    expect(path).toBe("/products/p4");
    expect(options.method).toBe("PATCH");
    // Must NOT include highlights/specifications/etc — the list page's
    // row data doesn't carry them, so a full-payload PATCH from a row
    // would silently wipe those fields on save.
    expect(options.body).toEqual({ isBestSeller: true });
  });
});
