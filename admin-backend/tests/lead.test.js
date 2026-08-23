const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/Lead");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const Lead = require("../src/models/Lead");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin-123", "Owner")}`;

describe("GET /api/leads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AdminUser.findById.mockResolvedValue({ _id: "admin-123", isActive: true, role: "Owner" });
  });

  it("requires admin auth", async () => {
    const res = await request(app).get("/api/leads");
    expect(res.status).toBe(401);
  });

  it("lists leads with pagination", async () => {
    Lead.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([{ _id: "l1", type: "quote", status: "new" }]) });
    Lead.countDocuments.mockResolvedValue(1);

    const res = await request(app).get("/api/leads").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Lead.find).toHaveBeenCalled();
    expect(res.body.total).toBe(1);
  });

  it("filters by type, e.g. quote requests which also cover bulk pricing asks", async () => {
    Lead.find.mockReturnValue({ sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockResolvedValue([]) });
    Lead.countDocuments.mockResolvedValue(0);

    const res = await request(app).get("/api/leads?type=quote").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Lead.find).toHaveBeenCalledWith(expect.objectContaining({ type: "quote" }));
  });
});

describe("GET /api/leads/stats", () => {
  it("returns counts by status and type", async () => {
    Lead.countDocuments.mockResolvedValue(0);

    const res = await request(app).get("/api/leads/stats").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ total: 0, new: 0, contacted: 0, closed: 0, byType: expect.any(Object) }));
  });
});

describe("PATCH /api/leads/:id/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AdminUser.findById.mockResolvedValue({ _id: "admin-123", isActive: true, role: "Owner" });
  });

  it("updates a lead's status", async () => {
    const save = jest.fn().mockResolvedValue(true);
    Lead.findById.mockResolvedValue({ _id: "l1", status: "new", save });

    const res = await request(app)
      .patch("/api/leads/l1/status")
      .set("Authorization", authHeader)
      .send({ status: "contacted" });

    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
  });

  it("404s for a missing lead", async () => {
    Lead.findById.mockResolvedValue(null);

    const res = await request(app)
      .patch("/api/leads/missing/status")
      .set("Authorization", authHeader)
      .send({ status: "contacted" });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/leads/:id", () => {
  it("deletes a lead", async () => {
    const deleteOne = jest.fn().mockResolvedValue(true);
    Lead.findById.mockResolvedValue({ _id: "l1", deleteOne });

    const res = await request(app).delete("/api/leads/l1").set("Authorization", authHeader);

    expect(res.status).toBe(204);
    expect(deleteOne).toHaveBeenCalled();
  });
});
