import { adminApiRequest, adminApiUpload } from "../lib/adminApi";
import { getProducts } from "./productsService";

function normalizeCategory(category = {}) {
  return {
    id: category._id || category.id || category.slug,
    name: category.name || "",
    slug: category.slug || "",
    description: category.description || "",
    image: category.image?.url || category.image || "",
    icon: category.icon || "tag",
    status: category.isActive === false ? "inactive" : "active",
    isActive: category.isActive !== false,
    count: Number(category.count || 0),
  };
}

async function withCounts(items) {
  const products = await getProducts();
  return items.map((category) => {
    const normalized = normalizeCategory(category);
    return {
      ...normalized,
      count: products.filter((product) => product.categoryId === normalized.id).length,
    };
  });
}

export async function getCategories() {
  const payload = await adminApiRequest(`/categories?page=1&limit=100`);
  return withCounts(payload?.items || []);
}

export async function getCategory(id) {
  const list = await getCategories();
  return list.find((category) => category.id === id) || null;
}

export async function createCategory(data) {
  const response = await adminApiRequest("/categories", {
    method: "POST",
    body: {
      name: String(data.name || "").trim(),
      description: String(data.description || "").trim(),
      icon: data.icon || "tag",
      isActive: (data.status || "active") === "active",
      sortOrder: Number(data.sortOrder || 0),
    },
  });
  return normalizeCategory(response?.category);
}

export async function updateCategory(id, data) {
  const response = await adminApiRequest(`/categories/${id}`, {
    method: "PATCH",
    body: {
      name: data.name,
      description: data.description,
      icon: data.icon,
      isActive: data.status === undefined ? undefined : (data.status === "active"),
      sortOrder: data.sortOrder,
    },
  });
  return normalizeCategory(response?.category);
}

// Categories only ever have one image, stored as a Cloudinary
// {url, publicId} pair (see admin-backend Category model) — unlike
// products there's no plain "image URL" field on the record, so this
// always goes through the multipart upload endpoint, never the JSON
// PATCH body.
export async function uploadCategoryImage(id, file, { onProgress } = {}) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  const payload = await adminApiUpload(`/categories/${id}/image`, formData, { onProgress });
  return payload?.category ? normalizeCategory(payload.category) : null;
}

export async function deleteCategory(id) {
  await adminApiRequest(`/categories/${id}`, { method: "DELETE" });
  return true;
}
