import { adminApiRequest } from "../lib/adminApi";

function normalize(item = {}) {
  return {
    id: item._id || item.id,
    type: item.type || "custom",
    message: item.message || "",
    ctaLabel: item.ctaLabel || "",
    ctaHref: item.ctaHref || "",
    active: item.active !== false,
    durationSeconds: Number(item.durationSeconds || 5),
    sortOrder: Number(item.sortOrder || 0),
  };
}

export async function getFlashMessages() {
  const payload = await adminApiRequest("/flash-messages");
  return (payload?.items || []).map(normalize);
}

export async function createFlashMessage(data) {
  const payload = await adminApiRequest("/flash-messages", { method: "POST", body: data });
  return normalize(payload?.message);
}

export async function updateFlashMessage(id, data) {
  const payload = await adminApiRequest(`/flash-messages/${id}`, { method: "PATCH", body: data });
  return normalize(payload?.message);
}

export async function deleteFlashMessage(id) {
  await adminApiRequest(`/flash-messages/${id}`, { method: "DELETE" });
  return true;
}

export async function reorderFlashMessages(orderedIds) {
  const payload = await adminApiRequest("/flash-messages/reorder", { method: "PATCH", body: { orderedIds } });
  return (payload?.items || []).map(normalize);
}
