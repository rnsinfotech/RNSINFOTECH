const mongoose = require("mongoose");

const blogPostSchema = new mongoose.Schema(
  {
    title: String,
    slug: { type: String, index: true },
    excerpt: String,
    image: String,
    coverImage: String,
    categoryId: String,
    category: String,
    author: String,
    publicationDate: Date,
    date: String,
    readTime: String,
    status: { type: String, index: true },
    publishedAt: { type: Date, index: true },
    content: [String],
  },
  { timestamps: true, collection: "blog_posts", strict: false, toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);
module.exports = mongoose.model("StorefrontBlogPost", blogPostSchema);
