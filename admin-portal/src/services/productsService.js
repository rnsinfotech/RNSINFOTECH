import { adminApiRequest, adminApiUpload } from "../lib/adminApi";
import { getLowStockThresholdSync } from "./settingsService";

function normalizeProduct(product = {}) {
  const stockQty = Number(product.stock ?? product.stockQty ?? 0);
  const category = product.category || {};
  const images = Array.isArray(product.images) ? product.images : [];
  const image = images[0]?.url || product.image || images[0] || "";
  // tags[] is freeform (search/filtering elsewhere) and fully decoupled
  // from homepage curation as of the Phase H build — no more overloading
  // a single tag with "featured"/"best-seller" meaning. `tag` (singular)
  // is kept only as a read-only convenience (first tag) for any older
  // callers that haven't moved to `tags` yet.
  const tags = Array.isArray(product.tags) ? product.tags : product.tag && product.tag !== "none" ? [product.tag] : [];
  const status = product.isActive === false ? "inactive" : "active";
  const nextStock = stockQty <= 0 ? "out-of-stock" : stockQty <= getLowStockThresholdSync() ? "low-stock" : "in-stock";
  // `specifications` is a Mongoose Map on the backend, which serializes to
  // a plain object ({ "Active Area": "10 x 6 in" }), never an array — the
  // Array.isArray check below always failed, so specs silently came back
  // empty on both this detail page and the edit form after every save.
  // Mirrors frontend/src/lib/api.js's normalizeProduct, which already
  // handled this correctly on the storefront side.
  const specs = Array.isArray(product.specifications)
    ? product.specifications
    : product.specifications && typeof product.specifications === "object"
      ? Object.entries(product.specifications).map(([label, value]) => ({ label, value: String(value ?? "") }))
      : [];

  return {
    id: product._id || product.id || product.slug,
    name: product.name || "",
    sku: product.sku || "",
    price: Number(product.price || 0),
    mrp: Number(product.mrp || product.price || 0),
    category: category.name || product.categoryName || product.category || "",
    categoryId: category._id || category.id || product.categoryId || "",
    brand: product.brand || "",
    stock: nextStock,
    stockQty: stockQty,
    status,
    tags,
    tag: tags[0] || "none",
    image,
    images: images.map((entry) => ({ id: entry._id || entry.id || "", url: entry.url || entry, publicId: entry.publicId || null })),
    shortDescription: product.shortDescription || "",
    description: product.description || "",
    highlights: Array.isArray(product.highlights) ? product.highlights : [],
    specs,
    downloadLinks: Array.isArray(product.downloadLinks)
      ? product.downloadLinks.map((d) => ({ id: d._id || d.id || "", label: d.label || "", url: d.url || "" }))
      : [],
    rating: Number(product.rating || 0),
    reviewCount: Number(product.reviewCount || 0),
    isFeatured: Boolean(product.isFeatured),
    homepageFeaturedOrder: typeof product.homepageFeaturedOrder === "number" ? product.homepageFeaturedOrder : null,
    isBestSeller: Boolean(product.isBestSeller),
    homepageBestSellerOrder: typeof product.homepageBestSellerOrder === "number" ? product.homepageBestSellerOrder : null,
    slug: product.slug || "",
    createdAt: product.createdAt || null,
    updatedAt: product.updatedAt || null,
  };
}

function toApiPayload(data) {
  const stockQty = Number(data.stockQty ?? data.stock ?? 0);
  const payload = {
    name: data.name,
    category: data.categoryId || data.category || "",
    brand: data.brand || "",
    price: Number(data.price || 0),
    mrp: Number(data.mrp || data.price || 0),
    stock: stockQty,
    isActive: (data.status || "active") === "active",
    isFeatured: Boolean(data.isFeatured),
    isBestSeller: Boolean(data.isBestSeller),
    shortDescription: data.shortDescription || "",
    description: data.description || data.shortDescription || "",
    sku: String(data.sku || "").trim(),
    tags: Array.isArray(data.tags) ? data.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean) : [],
    highlights: Array.isArray(data.highlights) ? data.highlights.filter(Boolean) : [],
    specifications: Array.isArray(data.specs) ? Object.fromEntries(data.specs.filter((s) => s && s.label && s.value).map((s) => [s.label, s.value])) : {},
    downloadLinks: Array.isArray(data.downloadLinks)
      ? data.downloadLinks.filter((d) => d && d.label && d.url).map((d) => ({ label: String(d.label).trim(), url: String(d.url).trim() }))
      : [],
  };
  // Only send an explicit order when the admin actually set one — leaving
  // it out (rather than sending "") lets the backend auto-assign the next
  // free slot (see resolveHomepageCuration in the admin-backend
  // controller), same as Phase 2's create/update default behavior.
  if (data.homepageFeaturedOrder !== "" && data.homepageFeaturedOrder != null) payload.homepageFeaturedOrder = Number(data.homepageFeaturedOrder);
  if (data.homepageBestSellerOrder !== "" && data.homepageBestSellerOrder != null) payload.homepageBestSellerOrder = Number(data.homepageBestSellerOrder);
  return payload;
}

function buildQueryString(filters = {}) {
  const params = new URLSearchParams();
  const { q = "", categoryId = "", brand = "", status = "", stock = "", sort = "", page = 1, limit = 20 } = filters;
  if (q) params.set("search", q);
  if (categoryId) params.set("category", categoryId);
  if (brand) params.set("brand", brand);
  if (status) params.set("isActive", status === "active");
  if (stock) params.set("stock", stock);
  if (sort) params.set("sort", sort);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return params.toString();
}

export async function getProductsPage(filters = {}) {
  const payload = await adminApiRequest(`/products?${buildQueryString(filters)}`);
  return {
    items: (payload?.items || []).map(normalizeProduct),
    page: Number(payload?.page || filters.page || 1),
    limit: Number(payload?.limit || filters.limit || 20),
    total: Number(payload?.total || 0),
    totalPages: Number(payload?.totalPages || 0),
  };
}

// Kept for existing dashboard/inventory/category consumers. The product list
// page uses getProductsPage so catalogue browsing is server-side paginated.
export async function getProducts(filters = {}) {
  const payload = await getProductsPage({ ...filters, page: 1, limit: filters.limit || 100 });
  return payload.items;
}

export async function getProduct(id) {
  const payload = await adminApiRequest(`/products/${id}`);
  return payload?.product ? normalizeProduct(payload.product) : null;
}

export async function createProduct(data) {
  const payload = await adminApiRequest("/products", { method: "POST", body: toApiPayload(data) });
  return payload?.product ? normalizeProduct(payload.product) : null;
}

export async function updateProduct(id, data) {
  const payload = await adminApiRequest(`/products/${id}`, { method: "PATCH", body: toApiPayload(data) });
  return payload?.product ? normalizeProduct(payload.product) : null;
}

// Quick-toggle affordance (product list page): sends ONLY the curation
// field(s) that changed rather than routing through toApiPayload, which
// builds a *full* product payload. The list page's row data doesn't carry
// highlights/specifications (the list endpoint doesn't return them), so a
// full-payload PATCH from a row would silently wipe those fields. The
// admin-backend update endpoint is a true partial update (zod
// .partial() + Object.assign), so a minimal body here only ever touches
// what's passed in. Pass e.g. { isFeatured: true } to flip a flag (order
// auto-assigns) or { homepageFeaturedOrder: 3 } to just reorder.
export async function updateProductCuration(id, patch) {
  const payload = await adminApiRequest(`/products/${id}`, { method: "PATCH", body: patch });
  return payload?.product ? normalizeProduct(payload.product) : null;
}

export async function uploadProductImages(id, files, { onProgress } = {}) {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file, file.name));
  const payload = await adminApiUpload(`/products/${id}/images`, formData, { onProgress });
  return payload?.product ? normalizeProduct(payload.product) : null;
}

// Uploads an image referenced inside the rich-text "full description"
// field (see RichTextEditor). Not tied to a product id, so it works even
// while creating a brand-new product, and it doesn't touch the product's
// image gallery — the returned URL is just embedded in the description
// HTML by the editor.
export async function uploadDescriptionImage(file, { onProgress } = {}) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  return adminApiUpload("/products/description-images", formData, { onProgress });
}

export async function replaceProductImage(id, imageId, file, { onProgress } = {}) {
  const formData = new FormData();
  formData.append("image", file, file.name);
  const payload = await adminApiUpload(`/products/${id}/images/${imageId}`, formData, { method: "PATCH", onProgress });
  return payload?.product ? normalizeProduct(payload.product) : null;
}

export async function deleteProductImage(id, imageId) {
  const payload = await adminApiRequest(`/products/${id}/images/${imageId}`, { method: "DELETE" });
  return payload?.product ? normalizeProduct(payload.product) : null;
}

export async function bulkProductAction(action, ids, categoryId = "") {
  const payload = await adminApiRequest("/products/bulk", { method: "POST", body: { action, ids, ...(categoryId ? { categoryId } : {}) } });
  return payload;
}

export async function deleteProduct(id) {
  await adminApiRequest(`/products/${id}`, { method: "DELETE" });
  return true;
}

export async function getProductStats() {
  const items = await getProducts();
  return {
    total: items.length,
    active: items.filter((p) => p.status === "active").length,
    lowStock: items.filter((p) => p.stock === "low-stock").length,
    outOfStock: items.filter((p) => p.stock === "out-of-stock").length,
  };
}

