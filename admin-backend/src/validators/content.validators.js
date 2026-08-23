const { z } = require("zod");

const listFaqsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().trim().optional(),
});

const createFaqSchema = z.object({
  question: z.string().trim().min(2).max(300),
  answer: z.string().trim().min(2).max(5000),
  isPublished: z.coerce.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().optional().default(0),
});

const updateFaqSchema = createFaqSchema.partial();

const createBlogPostSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(120),
  excerpt: z.string().trim().min(10).max(500).optional().default(""),
  image: z.string().trim().max(2000).optional().default(""),
  coverImage: z.string().trim().max(2000).optional().default(""),
  content: z.array(z.string().trim().min(1)).optional().default([]),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  author: z.string().trim().max(100).optional().default("RNS Editorial"),
  publicationDate: z.coerce.date().nullable().optional(),
  readTime: z.string().trim().max(50).optional().default("3 min read"),
});

const updateBlogPostSchema = createBlogPostSchema.partial();

const updatePolicySchema = z.object({
  updated: z.string().trim().max(50).optional(),
  intro: z.string().trim().max(5000).optional(),
  sections: z.array(z.object({ title: z.string().trim().min(1), body: z.string().trim().min(1) })).optional(),
  coverage: z.array(z.object({ categoryId: z.string().trim().min(1), categoryLabel: z.string().trim().min(1), duration: z.string().trim().min(1), note: z.string().trim().min(1) })).optional(),
}).partial();

module.exports = {
  listFaqsQuerySchema,
  createFaqSchema,
  updateFaqSchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  updatePolicySchema,
};
