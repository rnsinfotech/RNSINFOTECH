const mongoose = require("mongoose");

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    isPublished: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true, collection: "faqs", toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);

faqSchema.index({ isPublished: 1, sortOrder: 1, createdAt: -1 });

module.exports = mongoose.model("Faq", faqSchema);
