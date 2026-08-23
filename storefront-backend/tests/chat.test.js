const request = require("supertest");

jest.mock("../src/models/ChatThread");

const createApp = require("../src/app");
const ChatThread = require("../src/models/ChatThread");
const { signGuestChatToken } = require("../src/services/chatToken.service");
const { signAccessToken } = require("../src/services/token.service");

const app = createApp();
const authHeader = `Bearer ${signAccessToken("user123")}`;

describe("POST /api/chat/threads", () => {
  it("creates a new support thread for a guest customer", async () => {
    ChatThread.findOne.mockResolvedValue(null);
    ChatThread.create.mockResolvedValue({
      _id: "t1",
      threadId: "guest_abc",
      customerName: "Guest",
      customerEmail: "guest@example.com",
      status: "open",
      messages: [],
    });

    const res = await request(app)
      .post("/api/chat/threads")
      .send({ threadId: "guest_abc", customerName: "Guest", customerEmail: "guest@example.com" });

    expect(res.status).toBe(201);
    expect(ChatThread.create).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "guest_abc",
        customerName: "Guest",
        customerEmail: "guest@example.com",
      })
    );
  });
});

describe("POST /api/chat/threads (authenticated re-sync)", () => {
  it("updates a stale 'Guest' name on an existing thread once the real name is known", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const existing = {
      threadId: "user_user123",
      customerName: "Guest",
      customerEmail: "",
      status: "open",
      messages: [],
      save,
    };
    ChatThread.findOne.mockResolvedValue(existing);

    const res = await request(app)
      .post("/api/chat/threads")
      .set("Authorization", authHeader)
      .send({ threadId: "user_user123", customerName: "Prakhar Sharma", customerEmail: "prakhar@example.com" });

    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(existing.customerName).toBe("Prakhar Sharma");
    expect(existing.customerEmail).toBe("prakhar@example.com");
    expect(res.body.thread.customerName).toBe("Prakhar Sharma");
  });

  it("does not re-save when the stored name already matches", async () => {
    const save = jest.fn().mockResolvedValue(true);
    const existing = {
      threadId: "user_user123",
      customerName: "Prakhar Sharma",
      customerEmail: "prakhar@example.com",
      status: "open",
      messages: [],
      save,
    };
    ChatThread.findOne.mockResolvedValue(existing);

    const res = await request(app)
      .post("/api/chat/threads")
      .set("Authorization", authHeader)
      .send({ threadId: "user_user123", customerName: "Prakhar Sharma", customerEmail: "prakhar@example.com" });

    expect(res.status).toBe(200);
    expect(save).not.toHaveBeenCalled();
  });
});

describe("POST /api/chat/threads/:threadId/messages", () => {
  it("appends a customer message to an existing thread", async () => {
    ChatThread.findOne.mockResolvedValue({
      threadId: "guest_abc",
      customerName: "Guest",
      customerEmail: "guest@example.com",
      messages: [],
      save: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post("/api/chat/threads/guest_abc/messages")
      .set("x-chat-token", signGuestChatToken("guest_abc"))
      .send({ text: "Need help with delivery" });

    expect(res.status).toBe(201);
    expect(res.body.thread.messages).toHaveLength(1);
  });
});
