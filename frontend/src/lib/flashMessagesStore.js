import { apiRequest } from "./api";

export const FLASH_KEY = "rns_flash_messages_v1";
const EVENT = "rns-flash-messages-updated";
const POLL_INTERVAL_MS = 30_000;
const CACHE_TTL_MS = 15_000;

let cachedMessages = [];
let cachedAt = 0;
let inFlight = null;
let subscriberCount = 0;
let sharedInterval = null;

export async function loadFlashMessages({ force = false } = {}) {
  if (typeof window === "undefined") return [];
  if (!force && cachedAt && Date.now() - cachedAt < CACHE_TTL_MS) return cachedMessages;
  if (inFlight) return inFlight;

  inFlight = apiRequest("/flash-messages", { method: "GET" })
    .then((response) => {
      const items = (response.items || []).map((m) => ({
        id: m._id || m.id,
        type: m.type || "custom",
        message: m.message || "",
        ctaLabel: m.ctaLabel || "",
        ctaHref: m.ctaHref || "",
        active: m.active !== false,
        durationSeconds: m.durationSeconds || 5,
      }));
      cachedMessages = items;
      cachedAt = Date.now();
      return items;
    })
    .catch((error) => {
      console.warn("Failed to load flash messages:", error);
      return cachedMessages;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function startSharedPolling() {
  if (sharedInterval || typeof window === "undefined") return;
  sharedInterval = window.setInterval(async () => {
    const messages = await loadFlashMessages({ force: true });
    window.dispatchEvent(new CustomEvent(EVENT, { detail: messages }));
  }, POLL_INTERVAL_MS);
}

function stopSharedPolling() {
  if (!sharedInterval || typeof window === "undefined") return;
  window.clearInterval(sharedInterval);
  sharedInterval = null;
}

export function subscribeFlashMessages(callback) {
  subscriberCount += 1;
  startSharedPolling();

  const handler = (event) => callback(event.detail || cachedMessages);
  window.addEventListener(EVENT, handler);

  return () => {
    window.removeEventListener(EVENT, handler);
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) stopSharedPolling();
  };
}

export function visibleFlashMessages(messages, { isAuthenticated } = {}) {
  return (messages || []).filter((m) => {
    if (m.active === false || !m.message) return false;
    if (m.type === "login" && isAuthenticated) return false;
    return true;
  });
}
