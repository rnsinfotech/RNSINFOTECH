const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const Faq = require("../models/Faq");
const BlogPost = require("../models/BlogPost");
const Policy = require("../models/Policy");

const POLICY_KEYS = ["privacy", "returns", "terms", "warranty", "shipping"];

function normalizeFaq(doc) {
  return {
    id: String(doc._id),
    _id: doc._id,
    q: doc.question,
    a: doc.answer,
    question: doc.question,
    answer: doc.answer,
    isPublished: doc.isPublished,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeBlog(doc) {
  const image = doc.image || doc.coverImage || "";
  const publicationDate = doc.publicationDate || (doc.date ? new Date(doc.date) : null);
  return {
    id: String(doc._id),
    _id: doc._id,
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    image,
    coverImage: image,
    categoryId: doc.categoryId,
    category: doc.category,
    author: doc.author,
    publicationDate: publicationDate && !Number.isNaN(new Date(publicationDate).getTime()) ? new Date(publicationDate).toISOString() : null,
    date: doc.date || (publicationDate ? new Date(publicationDate).toISOString().slice(0, 10) : ""),
    readTime: doc.readTime,
    status: doc.status,
    publishedAt: doc.publishedAt,
    content: doc.content || [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function policyContentFromDoc(doc, source = "draft") {
  if (!doc) return { updated: "August 2026", intro: "", sections: [] };
  const candidate = doc[source];
  const hasContent = candidate && (candidate.updated || candidate.intro || (Array.isArray(candidate.sections) && candidate.sections.length) || (Array.isArray(candidate.coverage) && candidate.coverage.length));
  const value = hasContent ? candidate : (source === "published" ? null : doc);
  if (value) {
    const obj = value.toObject ? value.toObject() : value;
    return { ...obj };
  }
  return { updated: doc.updated || "August 2026", intro: doc.intro || "", sections: doc.sections || [], ...(doc.coverage ? { coverage: doc.coverage } : {}) };
}

function normalizePolicy(doc) {
  if (!doc) return null;
  const value = doc.toObject ? doc.toObject() : doc;
  return {
    key: value.key,
    id: value._id ? String(value._id) : undefined,
    status: value.status || "published",
    publishedAt: value.publishedAt || null,
    updatedAt: value.updatedAt,
    draft: policyContentFromDoc(value, "draft"),
    published: value.published ? policyContentFromDoc(value, "published") : null,
  };
}

const listFaqs = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const search = String(req.query.search || "").trim();
  const filter = search
    ? { $or: [{ question: { $regex: search, $options: "i" } }, { answer: { $regex: search, $options: "i" } }] }
    : {};
  const [items, total] = await Promise.all([
    Faq.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Faq.countDocuments(filter),
  ]);
  res.json({ items: items.map(normalizeFaq), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const createFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.create(req.body);
  res.status(201).json({ faq: normalizeFaq(faq) });
});

const updateFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!faq) throw ApiError.notFound("FAQ not found.");
  res.json({ faq: normalizeFaq(faq) });
});

const deleteFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.findByIdAndDelete(req.params.id);
  if (!faq) throw ApiError.notFound("FAQ not found.");
  res.status(204).send();
});

const listBlogPosts = asyncHandler(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const search = String(req.query.search || "").trim();
  const filter = search
    ? { $or: [{ title: { $regex: search, $options: "i" } }, { excerpt: { $regex: search, $options: "i" } }] }
    : {};
  const [items, total] = await Promise.all([
    BlogPost.find(filter).sort({ publicationDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    BlogPost.countDocuments(filter),
  ]);
  res.json({ items: items.map(normalizeBlog), page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const createBlogPost = asyncHandler(async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.image && !data.coverImage) data.coverImage = data.image;
    if (data.coverImage && !data.image) data.image = data.coverImage;
    if (data.publicationDate && !data.date) data.date = new Date(data.publicationDate).toISOString().slice(0, 10);
    if (data.status === "published" && !data.publishedAt) data.publishedAt = data.publicationDate ? new Date(data.publicationDate) : new Date();
    const post = await BlogPost.create(data);
    res.status(201).json({ post: normalizeBlog(post) });
  } catch (error) {
    if (error?.code === 11000) throw ApiError.conflict("A post with this slug already exists.");
    throw error;
  }
});

const updateBlogPost = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.image && !data.coverImage) data.coverImage = data.image;
  if (data.coverImage && !data.image) data.image = data.coverImage;
  if (data.publicationDate && !data.date) data.date = new Date(data.publicationDate).toISOString().slice(0, 10);
  if (data.status === "published" && !data.publishedAt) data.publishedAt = data.publicationDate ? new Date(data.publicationDate) : new Date();
  if (data.status === "draft") data.publishedAt = null;
  try {
    const post = await BlogPost.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!post) throw ApiError.notFound("Blog post not found.");
    res.json({ post: normalizeBlog(post) });
  } catch (error) {
    if (error?.code === 11000) throw ApiError.conflict("A post with this slug already exists.");
    throw error;
  }
});

const deleteBlogPost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findByIdAndDelete(req.params.id);
  if (!post) throw ApiError.notFound("Blog post not found.");
  res.status(204).send();
});

const getPolicies = asyncHandler(async (req, res) => {
  const docs = await Policy.find({ key: { $in: POLICY_KEYS } }).sort({ key: 1 });
  const policies = {};
  docs.forEach((doc) => { policies[doc.key] = normalizePolicy(doc); });
  POLICY_KEYS.forEach((key) => {
    if (!policies[key]) policies[key] = { key, status: "draft", publishedAt: null, draft: { updated: "August 2026", intro: "", sections: [] }, published: null };
  });
  res.json({ policies });
});

const updatePolicy = asyncHandler(async (req, res) => {
  if (!POLICY_KEYS.includes(req.params.key)) throw ApiError.notFound("Policy not found.");
  const draft = { updated: req.body.updated || "August 2026", intro: req.body.intro || "", sections: req.body.sections || [], ...(req.body.coverage ? { coverage: req.body.coverage } : {}) };
  const policy = await Policy.findOneAndUpdate(
    { key: req.params.key },
    { $set: { key: req.params.key, draft, status: "draft" } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json({ policy: normalizePolicy(policy) });
});

const publishPolicy = asyncHandler(async (req, res) => {
  if (!POLICY_KEYS.includes(req.params.key)) throw ApiError.notFound("Policy not found.");
  const policy = await Policy.findOne({ key: req.params.key });
  if (!policy) throw ApiError.notFound("Policy not found.");
  const draft = policy.draft || { updated: policy.updated, intro: policy.intro, sections: policy.sections, coverage: policy.coverage };
  policy.published = draft;
  policy.updated = draft.updated;
  policy.intro = draft.intro;
  policy.sections = draft.sections;
  policy.coverage = draft.coverage;
  policy.status = "published";
  policy.publishedAt = new Date();
  await policy.save();
  res.json({ policy: normalizePolicy(policy) });
});

const previewFaq = asyncHandler(async (req, res) => {
  const faq = await Faq.findById(req.params.id);
  if (!faq) throw ApiError.notFound("FAQ not found.");
  res.json({ faq: normalizeFaq(faq) });
});

const previewBlogPost = asyncHandler(async (req, res) => {
  const post = await BlogPost.findById(req.params.id);
  if (!post) throw ApiError.notFound("Blog post not found.");
  res.json({ post: normalizeBlog(post) });
});

const previewPolicy = asyncHandler(async (req, res) => {
  if (!POLICY_KEYS.includes(req.params.key)) throw ApiError.notFound("Policy not found.");
  const policy = await Policy.findOne({ key: req.params.key });
  if (!policy) throw ApiError.notFound("Policy not found.");
  res.json({ policy: normalizePolicy(policy) });
});

module.exports = {
  listFaqs, createFaq, updateFaq, deleteFaq,
  listBlogPosts, createBlogPost, updateBlogPost, deleteBlogPost,
  getPolicies, updatePolicy, publishPolicy,
  previewFaq, previewBlogPost, previewPolicy,
};
