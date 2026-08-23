const request = require("supertest");

jest.mock("../src/models/User");
jest.mock("../src/models/Otp");
jest.mock("../src/services/email.service");

const createApp = require("../src/app");
const User = require("../src/models/User");
const Otp = require("../src/models/Otp");
const otpService = require("../src/services/otp.service");
const { signAccessToken } = require("../src/services/token.service");
const { sendOtpEmail } = require("../src/services/email.service");

const app = createApp();

// Auto-mocked sendOtpEmail returns undefined by default, but the controller
// chains .catch() onto its result — give it a resolved promise so that
// doesn't blow up before each test gets to set its own expectations.
beforeEach(() => {
  sendOtpEmail.mockResolvedValue(undefined);
});

describe("POST /api/auth/request-otp", () => {
  it("rejects an invalid email with 400", async () => {
    const res = await request(app).post("/api/auth/request-otp").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/validation failed/i);
  });

  it("creates an OTP and echoes the dev code outside production", async () => {
    Otp.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });
    Otp.create.mockResolvedValue({});

    const res = await request(app).post("/api/auth/request-otp").send({ email: "shopper@example.com" });

    expect(res.status).toBe(200);
    expect(Otp.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: "shopper@example.com" })
    );
    expect(res.body.devCode).toMatch(/^\d{6}$/);
  });

  it("blocks a resend within the cooldown window with 409", async () => {
    Otp.findOne.mockReturnValue({
      sort: jest.fn().mockResolvedValue({ createdAt: new Date() }),
    });

    const res = await request(app).post("/api/auth/request-otp").send({ email: "shopper@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OTP_COOLDOWN");
  });
});

describe("POST /api/auth/verify-otp", () => {
  it("rejects a malformed code with 400", async () => {
    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "shopper@example.com", code: "abc" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when there's no live OTP for that email", async () => {
    Otp.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "shopper@example.com", code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("OTP_NOT_FOUND");
  });

  it("issues tokens and creates a user on a correct code with signup intent", async () => {
    const codeHash = await otpService.hashCode("123456");
    const otpDoc = {
      email: "shopper@example.com",
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Otp.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(otpDoc) });

    User.findOne.mockResolvedValue(null);
    const savedUser = {
      _id: "user123",
      email: "shopper@example.com",
      name: "",
      isVerified: true,
      save: jest.fn().mockResolvedValue(true),
    };
    User.create.mockResolvedValue(savedUser);

    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "shopper@example.com", code: "123456", intent: "signup" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(otpDoc.consumedAt).not.toBeNull();
    expect(savedUser.save).toHaveBeenCalled();
  });

  it("rejects a login attempt for an email with no existing account, and does not create one", async () => {
    const codeHash = await otpService.hashCode("123456");
    const otpDoc = {
      email: "stranger@example.com",
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Otp.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(otpDoc) });
    User.findOne.mockResolvedValue(null);
    User.create.mockClear();
    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "stranger@example.com", code: "123456" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_FOUND");
    expect(User.create).not.toHaveBeenCalled();
    // The code is still burned even though login was refused — otherwise
    // the same code could be replayed against a real signup afterwards.
    expect(otpDoc.consumedAt).not.toBeNull();
  });

  it("logs in an existing user without requiring signup intent", async () => {
    const codeHash = await otpService.hashCode("123456");
    const otpDoc = {
      email: "regular@example.com",
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Otp.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(otpDoc) });

    const existingUser = {
      _id: "user456",
      email: "regular@example.com",
      name: "Returning Shopper",
      isVerified: true,
      save: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(existingUser);
    User.create.mockClear();

    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "regular@example.com", code: "123456" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(User.create).not.toHaveBeenCalled();
    expect(existingUser.save).toHaveBeenCalled();
  });

  it("increments attempts and returns 401 on an incorrect code", async () => {
    const codeHash = await otpService.hashCode("111111");
    const otpDoc = {
      email: "shopper@example.com",
      codeHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Otp.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(otpDoc) });

    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "shopper@example.com", code: "222222" });

    expect(res.status).toBe(401);
    expect(otpDoc.attempts).toBe(1);
    // A wrong digit must be distinguishable from every other 401/400 path
    // (expired, locked out, already consumed) so the frontend can tell the
    // user "try again" instead of "get a new code".
    expect(res.body.error.code).toBe("OTP_INVALID");
    expect(res.body.error.message).not.toMatch(/session/i);
  });

  it("locks out after the max number of incorrect attempts, distinct from a plain wrong code", async () => {
    const codeHash = await otpService.hashCode("111111");
    const otpDoc = {
      email: "shopper@example.com",
      codeHash,
      attempts: 4, // one below OTP_MAX_ATTEMPTS=5 from .env.test
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      save: jest.fn().mockResolvedValue(true),
    };
    Otp.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(otpDoc) });

    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "shopper@example.com", code: "222222" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("OTP_LOCKED");
  });
});

describe("GET /api/auth/me", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed/invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns the user for a valid access token", async () => {
    const token = signAccessToken("user123");
    User.findById.mockResolvedValue({ _id: "user123", email: "shopper@example.com" });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("shopper@example.com");
  });
});
