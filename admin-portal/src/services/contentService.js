import { adminApiRequest } from "../lib/adminApi";

export const POLICY_LABELS = {
  privacy: "Privacy policy",
  returns: "Returns & refunds",
  terms: "Terms & conditions",
  warranty: "Warranty",
};

function normalizeFaq(faq = {}) {
  return {
    id: faq._id || faq.id,
    q: faq.q ?? faq.question ?? "",
    a: faq.a ?? faq.answer ?? "",
    isPublished: faq.isPublished !== false,
    sortOrder: Number(faq.sortOrder || 0),
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  };
}

function normalizeBlog(post = {}) {
  const image = post.image || post.coverImage || "";
  return {
    ...post,
    id: post._id || post.id,
    image,
    coverImage: image,
    content: Array.isArray(post.content) ? post.content : [],
    publicationDate: post.publicationDate || (post.date ? new Date(post.date).toISOString() : null),
  };
}

function normalizePolicy(policy = {}) {
  const draft = policy.draft || {
    updated: policy.updated || "August 2026",
    description: typeof policy.description === "string" ? policy.description : [policy.intro, ...(Array.isArray(policy.sections) ? policy.sections.map((s) => `${s.title || ""}\n\n${s.body || ""}`) : [])].filter(Boolean).join("\n\n"),
  };
  return {
    key: policy.key,
    status: policy.status || "draft",
    publishedAt: policy.publishedAt || null,
    draft: {
      updated: draft.updated || "August 2026",
      description: typeof draft.description === "string" ? draft.description : "",
    },
    published: policy.published || null,
  };
}

export async function getFaqs() {
  const payload = await adminApiRequest("/faqs?page=1&limit=100");
  return (payload?.items || []).map(normalizeFaq);
}

export async function createFaq(data) {
  const payload = await adminApiRequest("/faqs", {
    method: "POST",
    body: {
      question: String(data.q ?? data.question ?? "").trim(),
      answer: String(data.a ?? data.answer ?? "").trim(),
      isPublished: data.isPublished !== false,
      sortOrder: Number(data.sortOrder || 0),
    },
  });
  return normalizeFaq(payload?.faq);
}

export async function updateFaq(id, data) {
  const body = {};
  if (data.q !== undefined || data.question !== undefined) body.question = String(data.q ?? data.question).trim();
  if (data.a !== undefined || data.answer !== undefined) body.answer = String(data.a ?? data.answer).trim();
  if (data.isPublished !== undefined) body.isPublished = Boolean(data.isPublished);
  if (data.sortOrder !== undefined) body.sortOrder = Number(data.sortOrder);
  const payload = await adminApiRequest(`/faqs/${id}`, { method: "PATCH", body });
  return normalizeFaq(payload?.faq);
}

export async function deleteFaq(id) {
  await adminApiRequest(`/faqs/${id}`, { method: "DELETE" });
  return true;
}

export async function previewFaq(id) {
  const payload = await adminApiRequest(`/preview/faqs/${id}`);
  return normalizeFaq(payload?.faq);
}

export async function getPolicies() {
  const payload = await adminApiRequest("/policies");
  return Object.fromEntries(Object.entries(payload?.policies || {}).map(([key, value]) => [key, normalizePolicy(value)]));
}

export async function updatePolicy(key, data) {
  const payload = await adminApiRequest(`/policies/${key}`, { method: "PATCH", body: data });
  const updated = normalizePolicy(payload?.policy);
  const current = await getPolicies();
  return { ...current, [key]: updated };
}

export async function publishPolicy(key) {
  const payload = await adminApiRequest(`/policies/${key}/publish`, { method: "POST" });
  const published = normalizePolicy(payload?.policy);
  const current = await getPolicies();
  return { ...current, [key]: published };
}

export async function previewPolicy(key) {
  const payload = await adminApiRequest(`/preview/policies/${key}`);
  return normalizePolicy(payload?.policy);
}

export async function getBlogPosts() {
  const payload = await adminApiRequest("/blog?page=1&limit=100");
  return (payload?.items || []).map(normalizeBlog);
}

export async function createBlogPost(data) {
  const slug = String(data.slug || data.title || "post")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const payload = await adminApiRequest("/blog", { method: "POST", body: { ...data, slug } });
  return normalizeBlog(payload?.post);
}

export async function updateBlogPost(id, data) {
  const payload = await adminApiRequest(`/blog/${id}`, { method: "PATCH", body: data });
  return normalizeBlog(payload?.post);
}

export async function deleteBlogPost(id) {
  await adminApiRequest(`/blog/${id}`, { method: "DELETE" });
  return true;
}

export async function previewBlogPost(id) {
  const payload = await adminApiRequest(`/preview/blog/${id}`);
  return normalizeBlog(payload?.post);
}
