const request = require("supertest");
const createApp = require("../src/app");

describe("GET /api/health", () => {
  const app = createApp();

  it("returns 200 with service status even without a DB connection", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", service: "admin-backend" });
    expect(["connected", "disconnected", "connecting", "disconnecting"]).toContain(res.body.database);
  });
});

describe("GET /api/unknown-route", () => {
  const app = createApp();

  it("returns a 404 in the standard error shape", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toMatch(/route not found/i);
  });
});
