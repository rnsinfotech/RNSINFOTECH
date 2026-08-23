const request = require("supertest");

jest.mock("../src/models/FlashMessage");
jest.mock("../src/models/Faq");
jest.mock("../src/models/SiteSettings");
jest.mock("../src/models/BlogPost");
jest.mock("../src/models/Policy");

const createApp = require("../src/app");
const FlashMessage = require("../src/models/FlashMessage");
const Faq = require("../src/models/Faq");
const SiteSettings = require("../src/models/SiteSettings");
const BlogPost = require("../src/models/BlogPost");
const Policy = require("../src/models/Policy");

const app = createApp();

describe("GET /api/flash-messages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only active public flash messages", async () => {
    FlashMessage.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        { _id: "m1", message: "Sale now live", active: true },
      ]),
    });

    const res = await request(app).get("/api/flash-messages");

    expect(FlashMessage.find).toHaveBeenCalledWith({ active: true });
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].message).toBe("Sale now live");
  });
});

describe("GET /api/faqs", () => {
  it("lists published faq entries", async () => {
    Faq.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { _id: "f1", question: "How long does shipping take?", answer: "2-3 days", isPublished: true },
        ]),
      }),
    });

    const res = await request(app).get("/api/faqs");

    expect(res.status).toBe(200);
    expect(res.body.items[0].question).toBe("How long does shipping take?");
  });
});


describe("GET /api/website", () => {
  it("returns persisted homepage website settings", async () => {
    SiteSettings.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ key: "global", homepage: { hero: { title: "Live hero" }, promo: {}, whyChooseUs: [], solutions: [], testimonials: [] } }) });
    const res = await request(app).get("/api/website");
    expect(res.status).toBe(200);
    expect(res.body.website.hero.title).toBe("Live hero");
  });
});


describe("GET /api/store-profile", () => {
  it("returns only the public subset of the admin-saved store profile", async () => {
    SiteSettings.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        key: "global",
        storeProfile: {
          name: "RNS INFOTECH",
          legalName: "RNS INFOTECH Pvt. Ltd.",
          email: "support@rnsinfotech.in",
          phone: "+91 98765 43210",
          whatsapp: "919876543210",
          hours: "Mon–Sat, 10:00 AM – 7:00 PM IST",
          address: "MG Road, Bengaluru",
          gstin: "29ABCDE1234F1Z5",
        },
      }),
    });

    const res = await request(app).get("/api/store-profile");

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.storeProfile.name).toBe("RNS INFOTECH");
    expect(res.body.storeProfile.email).toBe("support@rnsinfotech.in");
    expect(res.body.storeProfile.gstin).toBeUndefined();
    expect(res.body.storeProfile.legalName).toBeUndefined();
  });

  it("falls back to empty strings when no storeProfile has been saved yet", async () => {
    SiteSettings.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ key: "global" }) });

    const res = await request(app).get("/api/store-profile");

    expect(res.status).toBe(200);
    expect(res.body.storeProfile.name).toBe("");
  });
});

describe("GET /api/blog", () => {
  it("returns published posts only", async () => {
    BlogPost.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue([{ _id: "b1", title: "Live", slug: "live", status: "published", publishedAt: new Date() }]) });
    const res = await request(app).get("/api/blog");
    expect(res.status).toBe(200);
    expect(res.body.items[0].title).toBe("Live");
    expect(BlogPost.find).toHaveBeenCalledWith(expect.objectContaining({ status: "published", $or: expect.any(Array) }));
  });
});

describe("GET /api/policies/:key", () => {
  it("returns the published snapshot, never draft content", async () => {
    Policy.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ key: "privacy", status: "published", draft: { intro: "Draft" }, published: { intro: "Live", sections: [] } }) });
    const res = await request(app).get("/api/policies/privacy");
    expect(res.status).toBe(200);
    expect(res.body.policy.intro).toBe("Live");
  });
});
