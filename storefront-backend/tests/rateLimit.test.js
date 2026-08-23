process.env.RATE_LIMIT_IN_TESTS = "true";

jest.mock("../src/models/RateLimit", () => ({ findOneAndUpdate: jest.fn() }));

const RateLimit = require("../src/models/RateLimit");
const { createRateLimiter } = require("../src/middleware/rateLimit");

function response() { const headers = {}; return { headers, setHeader(name, value) { headers[name] = value; } }; }

function request() { return { ip: "203.0.113.10", socket: { remoteAddress: "203.0.113.10" }, body: {} }; }

describe("rate limiting", () => {
  beforeEach(() => jest.clearAllMocks());

  it("enforces an atomic window limit and returns Retry-After", async () => {
    let count = 0;
    RateLimit.findOneAndUpdate.mockImplementation(() => ({ lean: async () => ({ count: ++count }) }));
    const limiter = createRateLimiter({ name: "test", limit: 2, windowMs: 60_000 });
    for (let i = 0; i < 2; i++) { const res = response(); let error; await limiter(request(), res, (err) => { error = err; }); expect(error).toBeUndefined(); }
    const res = response(); let error; await limiter(request(), res, (err) => { error = err; });
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("RATE_LIMITED");
    expect(res.headers["Retry-After"]).toBeTruthy();
  });

  it("fails closed when a sensitive limiter cannot reach MongoDB", async () => {
    RateLimit.findOneAndUpdate.mockImplementation(() => ({ lean: async () => { throw new Error("db unavailable"); } }));
    const limiter = createRateLimiter({ name: "sensitive", limit: 10, windowMs: 60_000, failClosed: true });
    const res = response(); let error; await limiter(request(), res, (err) => { error = err; });
    expect(error.statusCode).toBe(503);
    expect(error.code).toBe("RATE_LIMIT_STORE_UNAVAILABLE");
  });

  it("supports a custom error code, distinct from the generic RATE_LIMITED", async () => {
    let count = 0;
    RateLimit.findOneAndUpdate.mockImplementation(() => ({ lean: async () => ({ count: ++count }) }));
    const limiter = createRateLimiter({ name: "otp-daily", limit: 1, windowMs: 24 * 60 * 60 * 1000, code: "OTP_DAILY_LIMIT" });
    { const res = response(); let error; await limiter(request(), res, (err) => { error = err; }); expect(error).toBeUndefined(); }
    const res = response(); let error; await limiter(request(), res, (err) => { error = err; });
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("OTP_DAILY_LIMIT");
  });

  it("enforces a daily OTP-send cap of 5 per email, independent of the burst window", async () => {
    let count = 0;
    RateLimit.findOneAndUpdate.mockImplementation(() => ({ lean: async () => ({ count: ++count }) }));
    const limiter = createRateLimiter({
      name: "otp-daily",
      limit: 5,
      windowMs: 24 * 60 * 60 * 1000,
      key: (req) => String(req.body?.email || "").trim().toLowerCase(),
      code: "OTP_DAILY_LIMIT",
    });
    const req = () => ({ ip: "203.0.113.10", socket: { remoteAddress: "203.0.113.10" }, body: { email: "shopper@example.com" } });
    for (let i = 0; i < 5; i++) {
      const res = response(); let error;
      await limiter(req(), res, (err) => { error = err; });
      expect(error).toBeUndefined();
    }
    const res = response(); let error;
    await limiter(req(), res, (err) => { error = err; });
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe("OTP_DAILY_LIMIT");
  });
});
