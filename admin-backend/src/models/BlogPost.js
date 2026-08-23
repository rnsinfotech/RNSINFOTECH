const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    excerpt: { type: String, default: "", trim: true },
    image: { type: String, default: "", trim: true },
    // coverImage is kept as a backwards-compatible alias for existing admin data.
    coverImage: { type: String, default: "", trim: true },
    categoryId: { type: String, default: "", trim: true },
    category: { type: String, default: "", trim: true },
    author: { type: String, default: "RNS Editorial", trim: true },
    publicationDate: { type: Date, default: null },
    date: { type: String, default: "", trim: true },
    readTime: { type: String, default: "3 min read", trim: true },
    status: { type: String, enum: ["draft", "published"], default: "draft", index: true },
    publishedAt: { type: Date, default: null, index: true },
    content: { type: [String], default: [] },
  },
  { timestamps: true, collection: "blog_posts", toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);

module.exports = mongoose.model("BlogPost", blogPostSchema);
