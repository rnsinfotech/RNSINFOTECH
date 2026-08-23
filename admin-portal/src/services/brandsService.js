import { adminApiRequest } from "../lib/adminApi";

function normalizeBrand(brand = {}) {
  return {
    id: brand._id || brand.id || brand.slug,
    name: brand.name || "",
    logo: brand.logo || "",
    status: brand.isActive === false ? "inactive" : "active",
    count: Number(brand.count || 0),
    slug: brand.slug || "",
  };
}

export async function getBrands() {
  const payload = await adminApiRequest("/brands?page=1&limit=100");
  return (payload?.items || []).map(normalizeBrand);
}

export async function getBrand(id) {
  const payload = await adminApiRequest(`/brands/${id}`);
  return payload?.brand ? normalizeBrand(payload.brand) : null;
}

export async function createBrand(data) {
  const payload = await adminApiRequest("/brands", {
    method: "POST",
    body: { name: String(data.name || "").trim(), logo: String(data.logo || "").trim(), isActive: data.status !== "inactive" },
  });
  return normalizeBrand(payload?.brand);
}

export async function updateBrand(id, data) {
  const payload = await adminApiRequest(`/brands/${id}`, {
    method: "PATCH",
    body: {
      ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
      ...(data.logo !== undefined ? { logo: String(data.logo).trim() } : {}),
      ...(data.status !== undefined ? { isActive: data.status === "active" } : {}),
    },
  });
  return normalizeBrand(payload?.brand);
}

export async function deleteBrand(id) {
  await adminApiRequest(`/brands/${id}`, { method: "DELETE" });
  return true;
}
