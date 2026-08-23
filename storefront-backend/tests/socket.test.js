const http = require("http");
const { io } = require("socket.io-client");

jest.mock("../src/models/ChatThread");

const createApp = require("../src/app");
const { attachSocket } = require("../src/socket");
const ChatThread = require("../src/models/ChatThread");
const { signGuestChatToken } = require("../src/services/chatToken.service");

describe("B9 Socket.IO chat support", () => {
  let server;
  let client;

  beforeEach(async () => {
    jest.clearAllMocks();
    const app = createApp();
    server = http.createServer(app);
    attachSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));

    const { port } = server.address();
    client = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
      auth: { chatToken: signGuestChatToken("guest_abc") },
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

  it("broadcasts a chat message to clients joined to the thread", async () => {
    const save = jest.fn().mockResolvedValue(true);
    ChatThread.findOne.mockResolvedValue({
      threadId: "guest_abc",
      customerName: "Guest",
      customerEmail: "guest@example.com",
      messages: [],
      save,
    });

    const message = await new Promise((resolve) => {
      client.on("chat:message", (payload) => resolve(payload));
      client.emit("chat:join", { threadId: "guest_abc", role: "customer" });
      client.emit("chat:message", { threadId: "guest_abc", text: "Need help" });
    });

    expect(message).toEqual(expect.objectContaining({ threadId: "guest_abc", from: "customer" }));
    expect(save).toHaveBeenCalled();
  });
});
