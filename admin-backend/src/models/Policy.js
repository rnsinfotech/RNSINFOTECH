const mongoose = require("mongoose");

const policySectionSchema = new mongoose.Schema(
  { title: { type: String, required: true, trim: true }, body: { type: String, required: true, trim: true } },
  { _id: false }
);

const coverageSchema = new mongoose.Schema(
  {
    categoryId: { type: String, required: true, trim: true },
    categoryLabel: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    note: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const policyContentSchema = new mongoose.Schema(
  {
    updated: { type: String, default: "August 2026", trim: true },
    intro: { type: String, default: "", trim: true },
    sections: { type: [policySectionSchema], default: [] },
    coverage: { type: [coverageSchema], default: undefined },
  },
  { _id: false }
);

const policySchema = new mongoose.Schema(
  {
    key: { type: String, enum: ["privacy", "returns", "terms", "warranty"], required: true, unique: true, index: true },
    status: { type: String, enum: ["draft", "published"], default: "published", index: true },
    publishedAt: { type: Date, default: null },
    // `draft` is the editable CMS version. `published` is the immutable storefront snapshot.
    draft: { type: policyContentSchema, default: () => ({}) },
    published: { type: policyContentSchema, default: null },
    // Legacy top-level fields are retained so existing documents remain readable during migration.
    updated: { type: String, default: "August 2026", trim: true },
    intro: { type: String, default: "", trim: true },
    sections: { type: [policySectionSchema], default: [] },
    coverage: { type: [coverageSchema], default: undefined },
  },
  { timestamps: true, collection: "policies", toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);

module.exports = mongoose.model("Policy", policySchema);
