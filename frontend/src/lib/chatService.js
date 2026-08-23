import { io } from "socket.io-client";
import { apiRequest, getStoredAccessToken, refreshStorefrontAccessToken } from "./api";

const GUEST_KEY = "rns_chat_guest_id_v1";
const CHAT_TOKEN_KEY = "rns_chat_guest_token_v1";
const SOCKET_BASE_URL = import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, "");

let socket = null;
let socketThreadId = null;
let socketListeners = new Set();

function makeId(prefix = "m") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function getOrCreateGuestId() {
  if (typeof window === "undefined") return "server";
  try {
    let gid = localStorage.getItem(GUEST_KEY);
    if (!gid) {
      gid = makeId("guest");
      localStorage.setItem(GUEST_KEY, gid);
    }
    return gid;
  } catch {
    return "guest_temp";
  }
}

function getChatToken() {
  return typeof window !== "undefined" ? localStorage.getItem(CHAT_TOKEN_KEY) || "" : "";
}

function setChatToken(token) {
  if (token && typeof window !== "undefined") localStorage.setItem(CHAT_TOKEN_KEY, token);
}

function headers() {
  const token = getChatToken();
  return token ? { "x-chat-token": token } : {};
}

function normalize(thread, fallback = {}) {
  return {
    id: thread.threadId || fallback.id,
    customerName: thread.customerName || fallback.name || "Guest",
    customerEmail: thread.customerEmail || fallback.email || "",
    messages: (thread.messages || []).map((m) => ({
      id: String(m._id || m.id || m.clientMessageId || makeId()),
      clientMessageId: m.clientMessageId || null,
      from: m.from,
      text: m.text,
      ts: new Date(m.ts).getTime(),
      readByCustomer: m.readByCustomer === true,
      readByAdmin: m.readByAdmin === true,
    })),
    updatedAt: thread.updatedAt ? new Date(thread.updatedAt).getTime() : Date.now(),
    status: thread.status || "open",
  };
}

export async function getOrCreateThread(threadId, customerName, customerEmail) {
  const authenticated = Boolean(getStoredAccessToken());
  const response = await apiRequest("/chat/threads", {
    method: "POST",
    body: { threadId, customerName, customerEmail },
    authRequired: authenticated,
    headers: authenticated ? {} : headers(),
  });
  if (response.chatToken) setChatToken(response.chatToken);
  return normalize(response.thread || {}, { id: threadId, name: customerName, email: customerEmail });
}

export async function getThread(threadId) {
  const response = await apiRequest(`/chat/threads/${encodeURIComponent(threadId)}`, {
    headers: headers(),
    authRequired: Boolean(getStoredAccessToken()),
  });
  return normalize(response.thread || {}, { id: threadId });
}

async function sendMessageHttp(threadId, text, clientMessageId) {
  const response = await apiRequest(`/chat/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: { text, clientMessageId },
    headers: headers(),
    authRequired: Boolean(getStoredAccessToken()),
  });
  return normalize(response.thread || {}, { id: threadId });
}

function emitSocketMessage(threadId, text, clientMessageId) {
  if (!socket) return Promise.reject(new Error("Realtime chat is not connected."));
  if (socket.connected) {
    return new Promise((resolve, reject) => {
      socket.timeout(5000).emit("chat:message", { threadId, text, clientMessageId }, (error, response) => {
        if (error) {
          reject(new Error("Realtime chat request timed out."));
          return;
        }
        if (!response?.ok) {
          reject(new Error(response?.error || "Unable to send message."));
          return;
        }
        resolve(normalize(response.thread || {}, { id: threadId }));
      });
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.off("connect", onConnect);
      fn(value);
    };
    const onConnect = () => {
      socket.emit("chat:join", { threadId });
      emitSocketMessage(threadId, text, clientMessageId).then(
        (value) => finish(resolve, value),
        (error) => finish(reject, error)
      );
    };
    const timer = setTimeout(() => finish(reject, new Error("Realtime chat is not connected.")), 5000);
    socket.once("connect", onConnect);
  });
}

export async function sendMessage(threadId, text) {
  const clientMessageId = makeId("msg");
  try {
    return await emitSocketMessage(threadId, text, clientMessageId);
  } catch {
    // HTTP remains a narrow resilience fallback if a transient websocket
    // outage occurs. The same id makes the fallback idempotent if the
    // websocket actually persisted the message but its acknowledgement
    // was lost.
    return sendMessageHttp(threadId, text, clientMessageId);
  }
}

export async function markRead(threadId) {
  const response = await apiRequest(`/chat/threads/${encodeURIComponent(threadId)}/read`, {
    method: "POST",
    headers: headers(),
    authRequired: Boolean(getStoredAccessToken()),
  });
  return normalize(response.thread || {}, { id: threadId });
}

function notify(payload) {
  if (!payload) return;
  for (const callback of socketListeners) callback(payload);
}

function closeSocket() {
  if (socket) socket.disconnect();
  socket = null;
  socketThreadId = null;
}

function connectSocket(threadId, onUpdate) {
  if (typeof window === "undefined") return () => {};

  if (socket && socketThreadId !== threadId) closeSocket();

  socketThreadId = threadId;
  socketListeners.add(onUpdate);

  if (!socket) {
    const accessToken = getStoredAccessToken();
    const chatToken = getChatToken();

    socket = io(SOCKET_BASE_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: accessToken ? { accessToken } : { chatToken },
    });

    socket.on("connect", async () => {
      const currentToken = getStoredAccessToken();
      if (currentToken && socket.auth?.accessToken !== currentToken) {
        socket.auth = { accessToken: currentToken };
      }
      socket.emit("chat:join", { threadId });
      // Reconcile once after every connection/reconnection so a message
      // sent while the browser was offline cannot be missed. This is a
      // reconnect sync, not polling.
      try {
        notify(await getThread(threadId));
      } catch {
        // The socket remains connected; the next reconnect will retry.
      }
    });

    socket.on("chat:message", (payload) => {
      if (payload?.threadId === threadId) notify(payload);
    });

    socket.on("connect_error", async (error) => {
      console.warn("Chat realtime connection failed:", error?.message || error);
      if (accessToken) {
        const refreshedToken = await refreshStorefrontAccessToken();
        if (refreshedToken && socket) {
          socket.auth = { accessToken: refreshedToken };
          if (!socket.connected) socket.connect();
        }
      }
    });
  } else {
    socket.emit("chat:join", { threadId });
  }

  return () => {
    socketListeners.delete(onUpdate);
    if (socketListeners.size === 0) closeSocket();
  };
}

export function subscribeToChatUpdates(threadId, onUpdate) {
  return connectSocket(threadId, onUpdate);
}
