const request = require("supertest");

jest.mock("../src/models/Address");

const createApp = require("../src/app");
const Address = require("../src/models/Address");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("user123")}`;

const validAddress = {
  fullName: "Prakhar Tagra",
  phone: "9876543210",
  line1: "221B Sample Street",
  city: "Delhi",
  state: "Delhi",
  pincode: "110001",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("addresses router auth", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/addresses");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/addresses", () => {
  it("lists only the current customer's addresses, default first", async () => {
    const sort = jest.fn().mockResolvedValue([{ _id: "a1", isDefault: true }]);
    Address.find.mockReturnValue({ sort });

    const res = await request(app).get("/api/addresses").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(Address.find).toHaveBeenCalledWith({ user: "user123" });
    expect(sort).toHaveBeenCalledWith({ isDefault: -1, createdAt: -1 });
    expect(res.body.items).toHaveLength(1);
  });
});

describe("GET /api/addresses/:id", () => {
  it("returns 404 for an address that isn't the customer's own", async () => {
    Address.findOne.mockResolvedValue(null);

    const res = await request(app).get("/api/addresses/a1").set("Authorization", authHeader);

    expect(res.status).toBe(404);
    expect(Address.findOne).toHaveBeenCalledWith({ _id: "a1", user: "user123" });
  });

  it("returns the address when it belongs to the customer", async () => {
    Address.findOne.mockResolvedValue({ _id: "a1", user: "user123" });

    const res = await request(app).get("/api/addresses/a1").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.address._id).toBe("a1");
  });
});

describe("POST /api/addresses", () => {
  it("rejects an incomplete address with 400", async () => {
    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", authHeader)
      .send({ fullName: "Prakhar" });

    expect(res.status).toBe(400);
    expect(Address.create).not.toHaveBeenCalled();
  });

  it("forces isDefault true on the first address regardless of the request body", async () => {
    Address.countDocuments.mockResolvedValue(0);
    Address.updateMany.mockResolvedValue({});
    Address.create.mockResolvedValue({ _id: "a1", isDefault: true });

    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", authHeader)
      .send({ ...validAddress, isDefault: false });

    expect(res.status).toBe(201);
    expect(Address.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: "user123", isDefault: true })
    );
  });

  it("clears other defaults when a later address is saved as default", async () => {
    Address.countDocuments.mockResolvedValue(2);
    Address.updateMany.mockResolvedValue({});
    Address.create.mockResolvedValue({ _id: "a3", isDefault: true });

    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", authHeader)
      .send({ ...validAddress, isDefault: true });

    expect(res.status).toBe(201);
    expect(Address.updateMany).toHaveBeenCalledWith(
      { user: "user123", isDefault: true },
      { $set: { isDefault: false } }
    );
  });

  it("does not touch other defaults when the new address isn't default", async () => {
    Address.countDocuments.mockResolvedValue(1);
    Address.create.mockResolvedValue({ _id: "a2", isDefault: false });

    const res = await request(app)
      .post("/api/addresses")
      .set("Authorization", authHeader)
      .send(validAddress);

    expect(res.status).toBe(201);
    expect(Address.updateMany).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/addresses/:id", () => {
  it("returns 404 for an address that isn't the customer's own", async () => {
    Address.findOne.mockResolvedValue(null);

    const res = await request(app)
      .patch("/api/addresses/a1")
      .set("Authorization", authHeader)
      .send({ city: "Mumbai" });

    expect(res.status).toBe(404);
  });

  it("clears other defaults when this address is promoted to default", async () => {
    const save = jest.fn().mockResolvedValue();
    Address.findOne.mockResolvedValue({ _id: "a1", user: "user123", save });
    Address.updateMany.mockResolvedValue({});

    const res = await request(app)
      .patch("/api/addresses/a1")
      .set("Authorization", authHeader)
      .send({ isDefault: true });

    expect(res.status).toBe(200);
    expect(Address.updateMany).toHaveBeenCalledWith(
      { user: "user123", isDefault: true, _id: { $ne: "a1" } },
      { $set: { isDefault: false } }
    );
    expect(save).toHaveBeenCalled();
  });
});

describe("DELETE /api/addresses/:id", () => {
  it("returns 404 for an address that isn't the customer's own", async () => {
    Address.findOne.mockResolvedValue(null);

    const res = await request(app).delete("/api/addresses/a1").set("Authorization", authHeader);

    expect(res.status).toBe(404);
  });

  it("promotes the newest remaining address to default when the default is deleted", async () => {
    const deleteOne = jest.fn().mockResolvedValue();
    Address.findOne.mockResolvedValueOnce({ _id: "a1", user: "user123", isDefault: true, deleteOne });

    const nextSave = jest.fn().mockResolvedValue();
    const sort = jest.fn().mockResolvedValue({ _id: "a2", isDefault: false, save: nextSave });
    Address.findOne.mockReturnValueOnce({ sort });

    const res = await request(app).delete("/api/addresses/a1").set("Authorization", authHeader);

    expect(res.status).toBe(204);
    expect(deleteOne).toHaveBeenCalled();
    expect(nextSave).toHaveBeenCalled();
  });

  it("does not try to promote anything when the deleted address wasn't the default", async () => {
    const deleteOne = jest.fn().mockResolvedValue();
    Address.findOne.mockResolvedValueOnce({ _id: "a1", user: "user123", isDefault: false, deleteOne });

    const res = await request(app).delete("/api/addresses/a1").set("Authorization", authHeader);

    expect(res.status).toBe(204);
    expect(Address.findOne).toHaveBeenCalledTimes(1);
  });
});
