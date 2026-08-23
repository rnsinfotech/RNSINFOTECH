// chatStore — a tiny localStorage-backed "backend" for the support
// chat, in the same spirit as AuthContext/OrdersContext: there's no
// real server here, so this simulates one well enough for the whole
// app (and a lightweight admin console) to share live state.
//
// All threads live under one localStorage key as { [threadId]: Thread }.
// Because localStorage is shared across tabs of the same origin, the
// customer-facing widget and the /admin/chat console stay in sync via
// the browser's native `storage` event — open one in each tab and
// messages sent from either side show up in the other, no bot in the
// middle. Swap this module for real API + WebSocket calls once there's
// a backend; every consumer only talks to the functions below.

export const STORE_KEY = "rns_chat_threads_v1";
export const GUEST_KEY = "rns_chat_guest_id_v1";

export function makeId(prefix = "m") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function loadStore() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveStore(store) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore (private browsing, storage full, etc.)
  }
  // The `storage` event only fires in *other* tabs/windows, not the one
  // that made the change — dispatch a same-tab event too so a single
  // page can update immediately (e.g. re-render after sending).
  try {
    window.dispatchEvent(new CustomEvent("rns-chat-store", { detail: store }));
  } catch {
    // ignore
  }
}

export function getGuestId() {
  if (typeof window === "undefined") return "server";
  try {
    let gid = window.localStorage.getItem(GUEST_KEY);
    if (!gid) {
      gid = makeId("guest");
      window.localStorage.setItem(GUEST_KEY, gid);
    }
    return gid;
  } catch {
    return "guest_temp";
  }
}

export function emptyThread(name, email) {
  return {
    customerName: name || "Guest",
    customerEmail: email || "",
    messages: [],
    updatedAt: 0,
  };
}

/**
 * Append a message to a thread and persist it.
 * from: "customer" | "admin"
 */
export function appendMessage(threadId, from, text, meta = {}) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  const store = loadStore();
  const existing = store[threadId] || emptyThread(meta.customerName, meta.customerEmail);
  const message = {
    id: makeId(),
    from,
    text: trimmed,
    ts: Date.now(),
    readByCustomer: from === "customer",
    readByAdmin: from === "admin",
  };
  const nextThread = {
    ...existing,
    customerName: meta.customerName || existing.customerName,
    customerEmail: meta.customerEmail || existing.customerEmail,
    messages: [...existing.messages, message],
    updatedAt: message.ts,
  };
  const nextStore = { ...store, [threadId]: nextThread };
  saveStore(nextStore);
  return nextStore;
}

export function markThreadRead(threadId, role) {
  const field = role === "admin" ? "readByAdmin" : "readByCustomer";
  const store = loadStore();
  const thread = store[threadId];
  if (!thread) return store;
  const otherFrom = role === "admin" ? "customer" : "admin";
  let changed = false;
  const nextMessages = thread.messages.map((m) => {
    if (m.from === otherFrom && !m[field]) {
      changed = true;
      return { ...m, [field]: true };
    }
    return m;
  });
  if (!changed) return store;
  const nextStore = { ...store, [threadId]: { ...thread, messages: nextMessages } };
  saveStore(nextStore);
  return nextStore;
}
