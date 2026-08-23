const request = require("supertest");

jest.mock("../src/models/AdminUser");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const { signAccessToken } = require("../src/services/token.service");

// jest.mock() auto-mocks the module but drops static properties that
// aren't functions (like AdminUser.ROLES, a plain array) — restore it so
// the seed-script-style validation elsewhere and any future role checks
// that reference AdminUser.ROLES still work against the mock.
AdminUser.ROLES = ["Owner", "Manager", "Staff"];

const app = createApp();

describe("POST /api/auth/login", () => {
  it("rejects a missing password with 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "owner@rns.com" });
    expect(res.status).toBe(400);
  });

  it("returns 401 for an unknown email", async () => {
    AdminUser.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@rns.com", password: "whatever123" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for a deactivated account even with the right password", async () => {
    AdminUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ isActive: false, passwordHash: "irrelevant" }),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@rns.com", password: "whatever123" });

    expect(res.status).toBe(401);
  });

  it("issues tokens on a correct email/password", async () => {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash("correct-horse-battery", 10);
    const adminDoc = {
      _id: "admin123",
      email: "owner@rns.com",
      role: "Owner",
      isActive: true,
      passwordHash,
      save: jest.fn().mockResolvedValue(true),
    };
    AdminUser.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(adminDoc) });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@rns.com", password: "correct-horse-battery" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(res.headers["set-cookie"]?.[0]).toContain("rns_admin_refresh=");
    expect(adminDoc.save).toHaveBeenCalled();
  });

  it("returns 401 on a wrong password", async () => {
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash("correct-horse-battery", 10);
    AdminUser.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ isActive: true, passwordHash, save: jest.fn() }),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "owner@rns.com", password: "wrong-password" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a valid token for a deactivated account", async () => {
    const token = signAccessToken("admin123", "Staff");
    AdminUser.findById.mockResolvedValue({ _id: "admin123", isActive: false });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("returns the admin for a valid token and active account", async () => {
    const token = signAccessToken("admin123", "Owner");
    AdminUser.findById.mockResolvedValue({ _id: "admin123", email: "owner@rns.com", role: "Owner", isActive: true });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe("owner@rns.com");
  });
});
