const http = require("http");
const { io } = require("socket.io-client");

jest.mock("../src/models/ChatThread");
jest.mock("../src/models/AdminUser");

const createApp = require("../src/app");
const { attachSocket } = require("../src/socket");
const { signAccessToken } = require("../src/services/token.service");
const ChatThread = require("../src/models/ChatThread");
const AdminUser = require("../src/models/AdminUser");

describe("B9 Socket.IO admin chat support", () => {
  let server;
  let client;

  beforeEach(async () => {
    jest.clearAllMocks();
    AdminUser.findById.mockResolvedValue({ _id: "admin-123", isActive: true, role: "Owner", sessionVersion: 0 });
    const app = createApp();
    server = http.createServer(app);
    attachSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));

    const { port } = server.address();
    client = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      auth: { accessToken: signAccessToken("admin-123", "Owner") },
    });

    await new Promise((resolve, reject) => {
      client.on("connect", resolve);
      client.on("connect_error", reject);
    });
  });

  afterEach(async () => {
    if (client) client.close();
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it("broadcasts admin replies to the mapped chat thread", async () => {
    const save = jest.fn().mockResolvedValue(true);
    ChatThread.findOne.mockResolvedValue({
      threadId: "user_42",
      customerName: "Jane",
      customerEmail: "jane@test.com",
      messages: [],
      save,
    });

    const message = await new Promise((resolve) => {
      client.on("chat:message", (payload) => resolve(payload));
      client.emit("chat:join", { threadId: "user_42", role: "admin" });
      client.emit("chat:message", { threadId: "user_42", from: "admin", text: "We can help" });
    });

    expect(message).toEqual(expect.objectContaining({ threadId: "user_42", from: "admin" }));
    expect(save).toHaveBeenCalled();
  });
});
