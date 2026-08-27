const FlashMessage = require("../models/FlashMessage");
const Faq = require("../models/Faq");
const BlogPost = require("../models/BlogPost");
const Policy = require("../models/Policy");
const SiteSettings = require("../models/SiteSettings");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");

const POLICY_KEYS = ["privacy", "returns", "terms", "warranty"];

function publicBlog(doc) {
  const image = doc.image || doc.coverImage || "";
  const publicationDate = doc.publicationDate || (doc.date ? new Date(doc.date) : null);
  return {
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt || "",
    image,
    coverImage: image,
    categoryId: doc.categoryId || "",
    category: doc.category || "",
    author: doc.author || "RNS Editorial",
    publicationDate: publicationDate && !Number.isNaN(new Date(publicationDate).getTime()) ? new Date(publicationDate).toISOString() : null,
    date: doc.date || (publicationDate ? new Date(publicationDate).toISOString().slice(0, 10) : ""),
    readTime: doc.readTime || "3 min read",
    publishedAt: doc.publishedAt || publicationDate || null,
    content: Array.isArray(doc.content) ? doc.content : [],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const listFlashMessages = asyncHandler(async (req, res) => {
  const items = await FlashMessage.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 });
  res.json({ items });
});

const WEBSITE_DEFAULTS = { hero: null, promo: null, whyChooseUs: [], solutions: [], testimonials: [], categories: [] };

const getWebsite = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ key: "global" }).lean();
  const homepage = settings?.homepagePublished || settings?.homepage || {};
  res.set("Cache-Control", "no-store");
  res.json({ website: { ...WEBSITE_DEFAULTS, ...homepage } });
});

const STORE_PROFILE_PUBLIC_FIELDS = ["name", "email", "phone", "whatsapp", "hours", "address", "city", "state", "pincode", "country"];

const getStoreProfile = asyncHandler(async (req, res) => {
  const settings = await SiteSettings.findOne({ key: "global" }).lean();
  const storeProfile = settings?.storeProfile || {};
  const publicProfile = STORE_PROFILE_PUBLIC_FIELDS.reduce((acc, field) => {
    acc[field] = storeProfile[field] || "";
    return acc;
  }, {});
  res.set("Cache-Control", "no-store");
  res.json({ storeProfile: publicProfile });
});

const listFaqs = asyncHandler(async (req, res) => {
  const items = await Faq.find({ isPublished: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
  res.json({ items: items.map((item) => ({ ...item, id: String(item._id), q: item.question, a: item.answer })) });
});

const listBlogPosts = asyncHandler(async (req, res) => {
  const now = new Date();
  const items = await BlogPost.find({ status: "published", $or: [{ publishedAt: { $lte: now } }, { publishedAt: null, publicationDate: { $lte: now } }, { publishedAt: null, publicationDate: null }] })
    .sort({ publishedAt: -1, publicationDate: -1, createdAt: -1 })
    .lean();
  res.json({ items: items.map(publicBlog) });
});

const getBlogPost = asyncHandler(async (req, res) => {
  const now = new Date();
  const post = await BlogPost.findOne({ slug: req.params.slug, status: "published", $or: [{ publishedAt: { $lte: now } }, { publishedAt: null, publicationDate: { $lte: now } }, { publishedAt: null, publicationDate: null }] }).lean();
  if (!post) throw ApiError.notFound("Blog post not found.");
  res.json({ post: publicBlog(post) });
});

const getPolicy = asyncHandler(async (req, res) => {
  if (!POLICY_KEYS.includes(req.params.key)) throw ApiError.notFound("Policy not found.");
  const doc = await Policy.findOne({ key: req.params.key, status: "published" }).lean();
  if (!doc) throw ApiError.notFound("Policy not found.");
  const content = doc.published || {
    updated: doc.updated || "",
    description: typeof doc.description === "string" ? doc.description : [doc.intro, ...(Array.isArray(doc.sections) ? doc.sections.map((s) => `${s.title || ""}\n\n${s.body || ""}`) : [])].filter(Boolean).join("\n\n"),
  };
  res.json({ policy: { key: doc.key, ...content, publishedAt: doc.publishedAt || null } });
});

module.exports = { listFlashMessages, getWebsite, getStoreProfile, listFaqs, listBlogPosts, getBlogPost, getPolicy };
