import { adminApiRequest } from "../lib/adminApi";
import { getProducts } from "./productsService";

export async function getInventory(filters = {}) {
  return getProducts(filters);
}

export async function getInventoryStats() {
  const payload = await adminApiRequest("/inventory/stats");
  return payload || { total: 0, inStock: 0, lowStock: 0, outOfStock: 0 };
}

function normalizeAdjustment(entry = {}) {
  const product = entry.product && typeof entry.product === "object" ? entry.product : {};
  return {
    id: entry._id || entry.id,
    productId: product._id || entry.productId || entry.product || "",
    productName: entry.productName || product.name || "",
    sku: entry.sku || product.sku || "",
    action: entry.action || "adjustment",
    actorType: entry.actorType || "system",
    actorName: entry.actorName || null,
    actorEmail: entry.actorEmail || null,
    delta: Number(entry.delta || 0),
    reason: entry.reason || "Adjustment",
    previousQty: Number(entry.previousQty || 0),
    newQty: Number(entry.newQty || 0),
    at: entry.at || entry.createdAt || new Date().toISOString(),
  };
}

export async function getAdjustments(filters = {}) {
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (filters.q) params.set("search", filters.q);
  if (filters.productId) params.set("productId", filters.productId);
  const payload = await adminApiRequest(`/inventory/adjustments?${params.toString()}`);
  return (payload?.items || []).map(normalizeAdjustment);
}

export async function adjustStock(product, delta, reason) {
  const payload = await adminApiRequest("/inventory/adjustments", {
    method: "POST",
    body: {
      productId: product.id,
      delta: Number(delta),
      reason: String(reason || "").trim() || (Number(delta) >= 0 ? "Restock" : "Adjustment"),
    },
  });
  return payload?.entry ? normalizeAdjustment(payload.entry) : null;
}
