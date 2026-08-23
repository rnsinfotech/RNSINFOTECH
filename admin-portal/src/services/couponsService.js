import { adminApiRequest } from "../lib/adminApi";

export function isExpired(coupon) {
  return Boolean(coupon?.expiresAt && new Date(coupon.expiresAt) < new Date());
}

export function isExhausted(coupon) {
  return Number(coupon?.usageLimit || 0) > 0 && Number(coupon?.usageCount || 0) >= Number(coupon.usageLimit);
}

export function effectiveStatus(coupon) {
  if (coupon.status === "inactive") return "inactive";
  if (isExpired(coupon)) return "expired";
  if (isExhausted(coupon)) return "exhausted";
  return "active";
}

function normalizeCoupon(coupon = {}) {
  return {
    id: coupon._id || coupon.id,
    code: coupon.code || "",
    description: coupon.description || "",
    type: coupon.type || "percent",
    value: Number(coupon.value || 0),
    minOrderValue: Number(coupon.minOrderValue || 0),
    usageLimit: Number(coupon.usageLimit || 0),
    usageCount: Number(coupon.usageCount || 0),
    reservedCount: Number(coupon.reservedCount || 0),
    allowedUsers: coupon.allowedUsers || [],
    maxUsesPerUser: Number(coupon.maxUsesPerUser || 0),
    expiresAt: coupon.expiresAt || null,
    status: coupon.status || "active",
    createdAt: coupon.createdAt || null,
    updatedAt: coupon.updatedAt || null,
  };
}

export async function getCoupons(filters = {}) {
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (filters.search) params.set("search", filters.search);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const payload = await adminApiRequest(`/coupons?${params.toString()}`);
  return (payload?.items || []).map(normalizeCoupon);
}

export async function getCouponStats() {
  const payload = await adminApiRequest("/coupons/stats");
  return payload || { total: 0, active: 0, expired: 0, totalRedemptions: 0 };
}

// The backend's Zod schema for expiresAt accepts a real date, null, or the
// field being omitted entirely — but coerces "" (what a cleared/blank HTML
// date input sends) into `new Date("")`, an Invalid Date, which fails
// validation with a generic "Validation failed." error. Normalize blank
// strings to null here so "no expiry" round-trips correctly.
function normalizeExpiresAt(value) {
  if (value === "" || value === undefined) return null;
  return value;
}

export async function createCoupon(data) {
  const payload = await adminApiRequest("/coupons", {
    method: "POST",
    body: {
      ...data,
      code: String(data.code || "").trim().toUpperCase(),
      type: data.type === "flat" ? "fixed" : data.type,
      expiresAt: normalizeExpiresAt(data.expiresAt),
    },
  });
  return normalizeCoupon(payload?.coupon);
}

export async function updateCoupon(id, data) {
  const payload = await adminApiRequest(`/coupons/${id}`, {
    method: "PATCH",
    body: {
      ...data,
      code: data.code ? String(data.code).trim().toUpperCase() : data.code,
      type: data.type === "flat" ? "fixed" : data.type,
      expiresAt: normalizeExpiresAt(data.expiresAt),
    },
  });
  return normalizeCoupon(payload?.coupon);
}

export async function deleteCoupon(id) {
  await adminApiRequest(`/coupons/${id}`, { method: "DELETE" });
  return true;
}
