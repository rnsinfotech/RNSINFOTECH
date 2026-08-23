const mongoose = require("mongoose");

const policySchema = new mongoose.Schema(
  {
    key: { type: String, index: true },
    status: String,
    publishedAt: Date,
    draft: mongoose.Schema.Types.Mixed,
    published: mongoose.Schema.Types.Mixed,
    updated: String,
    intro: String,
    sections: mongoose.Schema.Types.Mixed,
    coverage: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, collection: "policies", strict: false, toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);
module.exports = mongoose.model("StorefrontPolicy", policySchema);
