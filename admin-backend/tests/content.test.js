const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Faq");
jest.mock("../src/models/BlogPost");
jest.mock("../src/models/Policy");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Faq = require("../src/models/Faq");
const BlogPost = require("../src/models/BlogPost");
const Policy = require("../src/models/Policy");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin-content", "Owner")}`;

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockResolvedValue({ _id: "admin-content", isActive: true, role: "Owner" });
});

describe("content CMS", () => {
  it("creates a persistent FAQ with ordering and publication state", async () => {
    Faq.create.mockResolvedValue({ _id: "faq1", question: "Shipping?", answer: "2 days", isPublished: false, sortOrder: 3 });
    const res = await request(app).post("/api/faqs").set("Authorization", authHeader).send({ question: "Shipping?", answer: "2 days", isPublished: false, sortOrder: 3 });
    expect(res.status).toBe(201);
    expect(Faq.create).toHaveBeenCalledWith(expect.objectContaining({ isPublished: false, sortOrder: 3 }));
    expect(res.body.faq.id).toBe("faq1");
  });

  it("lists blog posts for admins including drafts", async () => {
    BlogPost.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([{ _id: "b1", title: "Draft", slug: "draft", status: "draft" }]) });
    BlogPost.countDocuments.mockResolvedValue(1);
    const res = await request(app).get("/api/blog?page=1&limit=20").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(res.body.items[0].status).toBe("draft");
  });

  it("updates policies as draft content and keeps published snapshot separate", async () => {
    Policy.findOneAndUpdate.mockResolvedValue({ _id: "pol1", key: "privacy", status: "draft", draft: { intro: "Draft intro", sections: [] }, published: { intro: "Live intro", sections: [] } });
    const res = await request(app).patch("/api/policies/privacy").set("Authorization", authHeader).send({ intro: "Draft intro", sections: [] });
    expect(res.status).toBe(200);
    expect(Policy.findOneAndUpdate).toHaveBeenCalledWith({ key: "privacy" }, expect.objectContaining({ $set: expect.objectContaining({ status: "draft" }) }), expect.anything());
    expect(res.body.policy.status).toBe("draft");
  });

  it("publishes a policy snapshot", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const policy = { key: "privacy", draft: { updated: "August 2026", intro: "New", sections: [] }, status: "draft", save };
    Policy.findOne.mockResolvedValue(policy);
    const res = await request(app).post("/api/policies/privacy/publish").set("Authorization", authHeader);
    expect(res.status).toBe(200);
    expect(policy.published.intro).toBe("New");
    expect(policy.status).toBe("published");
    expect(save).toHaveBeenCalled();
  });

  it("requires admin authentication for previews", async () => {
    const res = await request(app).get("/api/preview/blog/b1");
    expect(res.status).toBe(401);
  });
});
