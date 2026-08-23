import { io } from "socket.io-client";
import { adminApiRequest, getAdminAccessToken, refreshAdminAccessToken } from "../lib/adminApi";

const SOCKET_BASE_URL = import.meta.env.VITE_ADMIN_API_BASE_URL.replace(/\/api\/?$/, "");

function normalizeMessage(m = {}) {
  return {
    id: String(m._id || m.id || m.clientMessageId || ""),
    clientMessageId: m.clientMessageId || null,
    from: m.from,
    text: m.text || "",
    ts: m.ts ? new Date(m.ts).getTime() : Date.now(),
    readByCustomer: m.readByCustomer === true,
    readByAdmin: m.readByAdmin === true,
  };
}

function normalizeThread(t = {}) {
  const messages = Array.isArray(t.messages) ? t.messages.map(normalizeMessage) : [];
  const last = t.last ? normalizeMessage(t.last) : messages[messages.length - 1] || null;
  const unread = Number.isFinite(Number(t.unread))
    ? Number(t.unread)
    : messages.filter((m) => m.from === "customer" && !m.readByAdmin).length;

  return {
    id: t.threadId || t.id || t._id,
    threadId: t.threadId || t.id,
    customerName: t.customerName || "Guest",
    customerEmail: t.customerEmail || "",
    status: t.status || "open",
    messages,
    unread,
    last,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).getTime() : 0,
    createdAt: t.createdAt ? new Date(t.createdAt).getTime() : 0,
  };
}

export async function getThreads({ q = "" } = {}) {
  const payload = await adminApiRequest(
    `/chat/threads${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`
  );
  return (payload?.items || []).map(normalizeThread);
}

export async function getThread(id) {
  const payload = await adminApiRequest(`/chat/threads/${encodeURIComponent(id)}`);
  return payload?.thread ? normalizeThread(payload.thread) : null;
}

export async function getChatStats() {
  const payload = await adminApiRequest("/chat/stats");
  return payload?.stats || { total: 0, unreadThreads: 0, totalUnread: 0, resolved: 0 };
}

async function sendReplyHttp(threadId, text, clientMessageId) {
  const payload = await adminApiRequest(`/chat/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: { text, clientMessageId },
  });
  return payload?.thread ? normalizeThread(payload.thread) : null;
}

async function sendReplyRealtime(threadId, text, clientMessageId) {
  const s = await getSocket();
  if (!s) throw new Error("Admin realtime chat is unavailable.");

  if (!s.connected) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        s.off("connect", onConnect);
        reject(new Error("Admin realtime chat is not connected."));
      }, 5000);
      const onConnect = () => {
        clearTimeout(timer);
        resolve();
      };
      s.once("connect", onConnect);
    });
  }

  return new Promise((resolve, reject) => {
    s.timeout(5000).emit("chat:message", { threadId, text, clientMessageId }, (error, response) => {
      if (error) {
        reject(new Error("Realtime chat request timed out."));
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || "Unable to send message."));
        return;
      }
      resolve(response.thread ? normalizeThread(response.thread) : null);
    });
  });
}

export async function sendReply(threadId, text) {
  const clientMessageId = `admin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    return await sendReplyRealtime(threadId, text, clientMessageId);
  } catch {
    return sendReplyHttp(threadId, text, clientMessageId);
  }
}

export async function markRead(threadId) {
  const payload = await adminApiRequest(`/chat/threads/${encodeURIComponent(threadId)}/read`, {
    method: "POST",
  });
  return payload?.thread ? normalizeThread(payload.thread) : null;
}

let socket = null;
let socketPromise = null;
const threadCallbacks = new Map();
const globalCallbacks = new Set();

async function getSocket() {
  if (socket?.connected) return socket;
  if (socketPromise) return socketPromise;

  socketPromise = getAdminAccessToken()
    .then((token) => {
      if (!token) return null;

      if (!socket) {
        socket = io(SOCKET_BASE_URL, {
          path: "/socket.io",
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 500,
          reconnectionDelayMax: 5000,
          timeout: 10000,
          auth: { accessToken: token },
        });

        socket.on("connect", async () => {
          const currentToken = await getAdminAccessToken();
          if (currentToken && socket.auth?.accessToken !== currentToken) {
            socket.auth = { accessToken: currentToken };
          }
          for (const threadId of threadCallbacks.keys()) {
            socket.emit("chat:join", { threadId });
          }
          for (const callback of globalCallbacks) callback({ type: "reconnected" });
        });

        socket.on("chat:message", (payload) => {
          for (const callback of globalCallbacks) callback(payload);
          const callbacks = threadCallbacks.get(payload?.threadId) || [];
          for (const callback of callbacks) callback(payload);
        });

        socket.on("connect_error", async (error) => {
          console.warn("Admin chat realtime connection failed:", error?.message || error);
          const refreshedToken = await refreshAdminAccessToken();
          if (refreshedToken && socket) {
            socket.auth = { accessToken: refreshedToken };
            if (!socket.connected) socket.connect();
          }
        });

        socket.on("disconnect", () => {
          // Socket.IO handles reconnects automatically. Consumers remain
          // subscribed and are rejoined on the next connect event.
        });
      }

      return socket;
    })
    .finally(() => {
      socketPromise = null;
    });

  return socketPromise;
}

function maybeCloseSocket() {
  if (globalCallbacks.size === 0 && threadCallbacks.size === 0 && socket) {
    socket.disconnect();
    socket = null;
    socketPromise = null;
  }
}

export function subscribeToThreads(callback) {
  let active = true;
  const wrapped = (payload) => {
    if (active) callback(payload);
  };
  globalCallbacks.add(wrapped);
  getSocket().catch(() => {});
  return () => {
    active = false;
    globalCallbacks.delete(wrapped);
    maybeCloseSocket();
  };
}

export async function subscribeToThread(threadId, callback) {
  const s = await getSocket();
  if (!s) return () => {};

  const callbacks = threadCallbacks.get(threadId) || [];
  callbacks.push(callback);
  threadCallbacks.set(threadId, callbacks);
  s.emit("chat:join", { threadId });

  return () => {
    const current = threadCallbacks.get(threadId) || [];
    const next = current.filter((item) => item !== callback);
    if (next.length) threadCallbacks.set(threadId, next);
    else {
      threadCallbacks.delete(threadId);
      s.emit("chat:leave", { threadId });
    }
    maybeCloseSocket();
  };
}
