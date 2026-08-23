import { adminApiRequest, getStoredAdminAuth } from "../lib/adminApi";

const FALLBACK_COMMERCE = { freeShippingThreshold: 5000, flatShippingFee: 199, lowStockThreshold: 8, taxRate: 0, standardDeliveryFee: 0 };
let commerceCache = { ...FALLBACK_COMMERCE };

export async function getStoreProfile() {
  const payload = await adminApiRequest("/settings/store-profile");
  return payload?.storeProfile || null;
}

export async function updateStoreProfile(data) {
  const payload = await adminApiRequest("/settings/store-profile", { method: "PATCH", body: data });
  return payload?.storeProfile || null;
}

export async function getCommerceSettings() {
  const payload = await adminApiRequest("/settings/commerce");
  commerceCache = { ...commerceCache, ...(payload?.commerce || {}) };
  return commerceCache;
}

export async function updateCommerceSettings(data) {
  const payload = await adminApiRequest("/settings/commerce", { method: "PATCH", body: data });
  commerceCache = { ...commerceCache, ...(payload?.commerce || {}) };
  return commerceCache;
}

export function getLowStockThresholdSync() {
  const n = Number(commerceCache.lowStockThreshold);
  return Number.isFinite(n) && n >= 0 ? n : FALLBACK_COMMERCE.lowStockThreshold;
}

export async function getAccount() {
  const payload = await adminApiRequest("/settings/account");
  return payload?.account || getStoredAdminAuth().admin || null;
}

export async function updateAccount(data) {
  const payload = await adminApiRequest("/settings/account", { method: "PATCH", body: data });
  return payload?.account || getStoredAdminAuth().admin || null;
}

export function getAccountSync() {
  return getStoredAdminAuth().admin || null;
}
