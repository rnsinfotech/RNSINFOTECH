const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/SiteSettings");

const createApp = require("../src/app");
const { signAccessToken } = require("../src/services/token.service");
const AdminUser = require("../src/models/AdminUser");
const SiteSettings = require("../src/models/SiteSettings");

const app = createApp();
const token = signAccessToken("admin123", "Owner");

beforeEach(() => {
  jest.clearAllMocks();
  AdminUser.findById.mockResolvedValue({ _id: "admin123", email: "owner@rns.com", role: "Owner", isActive: true, save: jest.fn().mockResolvedValue(true) });
  const settings = {
    storeProfile: { name: "RNS INFOTECH", email: "support@rnsinfotech.in", phone: "+91 98765 43210" },
    commerce: { freeShippingThreshold: 5000, flatShippingFee: 199, lowStockThreshold: 8 },
    save: jest.fn().mockResolvedValue(true),
  };
  SiteSettings.DEFAULT_STORE_PROFILE = { name: "RNS INFOTECH", email: "support@rnsinfotech.in", phone: "+91 98765 43210" };
  SiteSettings.DEFAULT_COMMERCE = { freeShippingThreshold: 5000, flatShippingFee: 199, lowStockThreshold: 8 };
  SiteSettings.findOneAndUpdate.mockResolvedValue(settings);
});

describe("B12 admin settings", () => {
  it("returns the default store profile", async () => {
    const res = await request(app).get("/api/settings/store-profile").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.storeProfile).toMatchObject({
      name: "RNS INFOTECH",
      email: "support@rnsinfotech.in",
    });
  });

  it("updates the store profile", async () => {
    const res = await request(app)
      .patch("/api/settings/store-profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "RNS INFOTECH Pvt Ltd", phone: "+91 90000 00000" });

    expect(res.status).toBe(200);
    expect(res.body.storeProfile.name).toBe("RNS INFOTECH Pvt Ltd");
    expect(res.body.storeProfile.phone).toBe("+91 90000 00000");
  });

  it("returns and updates commerce settings", async () => {
    const getRes = await request(app).get("/api/settings/commerce").set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.commerce.freeShippingThreshold).toBe(5000);

    const patchRes = await request(app)
      .patch("/api/settings/commerce")
      .set("Authorization", `Bearer ${token}`)
      .send({ lowStockThreshold: 12, flatShippingFee: 250 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.commerce.lowStockThreshold).toBe(12);
    expect(patchRes.body.commerce.flatShippingFee).toBe(250);
  });

  it("returns and updates the admin account profile", async () => {
    const res = await request(app)
      .patch("/api/settings/account")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "RNS Admin 2", role: "Manager" });

    expect(res.status).toBe(200);
    expect(res.body.account.name).toBe("RNS Admin 2");
    expect(res.body.account.role).toBe("Owner");
  });
});
