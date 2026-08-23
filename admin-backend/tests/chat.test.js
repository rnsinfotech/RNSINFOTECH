const request = require("supertest");

jest.mock("../src/models/AdminUser");
jest.mock("../src/models/ChatThread");

const createApp = require("../src/app");
const AdminUser = require("../src/models/AdminUser");
const ChatThread = require("../src/models/ChatThread");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("admin-123", "Owner")}`;

describe("GET /api/chat/threads", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AdminUser.findById.mockResolvedValue({ _id: "admin-123", isActive: true, role: "Owner" });
  });

  it("lists chat threads for the admin console", async () => {
    // listThreads uses an aggregation pipeline (match/sort/limit/project)
    // rather than find().sort().limit(), so ChatThread.aggregate is what
    // needs mocking here.
    ChatThread.aggregate.mockResolvedValue([
      {
        _id: "t1",
        threadId: "user_42",
        customerName: "Jane",
        customerEmail: "jane@test.com",
        last: { from: "customer", text: "Hello", ts: Date.now() },
        unread: 1,
        updatedAt: new Date(),
      },
    ]);

    const res = await request(app).get("/api/chat/threads").set("Authorization", authHeader);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});

describe("POST /api/chat/threads/:threadId/messages", () => {
  beforeEach(() => {
    AdminUser.findById.mockResolvedValue({ _id: "admin-123", isActive: true, role: "Owner" });
  });

  it("allows an admin reply to a thread", async () => {
    ChatThread.findOne.mockResolvedValue({
      threadId: "user_42",
      customerName: "Jane",
      customerEmail: "jane@test.com",
      messages: [],
      save: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post("/api/chat/threads/user_42/messages")
      .set("Authorization", authHeader)
      .send({ from: "admin", text: "We can help with that." });

    expect(res.status).toBe(201);
    expect(res.body.thread.messages).toHaveLength(1);
  });
});
