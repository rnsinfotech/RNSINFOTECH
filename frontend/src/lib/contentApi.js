import { apiRequest } from "./api";

export async function getWebsiteContent() {
  const payload = await apiRequest("/website");
  return payload?.website || {};
}

export async function getStoreProfileContent() {
  const payload = await apiRequest("/store-profile");
  return payload?.storeProfile || {};
}

export async function getFaqContent() {
  const payload = await apiRequest("/faqs");
  return (payload?.items || []).map((item) => ({
    id: item._id || item.id,
    q: item.q || item.question || "",
    a: item.a || item.answer || "",
    sortOrder: Number(item.sortOrder || 0),
  }));
}

export async function getBlogContent() {
  const payload = await apiRequest("/blog");
  return (payload?.items || []).map(normalizeBlog);
}

export async function getBlogPostContent(slug) {
  const payload = await apiRequest(`/blog/${encodeURIComponent(slug)}`);
  return normalizeBlog(payload?.post);
}

function normalizeBlog(post = {}) {
  const image = post.image || post.coverImage || "";
  return {
    ...post,
    id: post.id || post._id || post.slug,
    image,
    coverImage: image,
    categoryId: post.categoryId || null,
    content: Array.isArray(post.content) ? post.content : [],
    date: post.date || (post.publicationDate ? String(post.publicationDate).slice(0, 10) : ""),
  };
}

export async function getPolicyContent(key) {
  const payload = await apiRequest(`/policies/${key}`);
  return payload?.policy || null;
}
