const mongoose = require("mongoose");

const policyContentSchema = new mongoose.Schema(
  {
    updated: { type: String, default: "August 2026", trim: true },
    description: { type: String, default: "", trim: false },
  },
  { _id: false }
);

const policySchema = new mongoose.Schema(
  {
    key: { type: String, enum: ["privacy", "returns", "terms", "warranty"], required: true, unique: true, index: true },
    status: { type: String, enum: ["draft", "published"], default: "published", index: true },
    publishedAt: { type: Date, default: null },
    draft: { type: policyContentSchema, default: () => ({}) },
    published: { type: policyContentSchema, default: null },
    // Legacy fields are retained for backward compatibility with existing policy documents.
    updated: { type: String, default: "August 2026", trim: true },
    intro: { type: String, default: "", trim: false },
    sections: { type: Array, default: [] },
    coverage: { type: Array, default: undefined },
  },
  { timestamps: true, collection: "policies", toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);

module.exports = mongoose.model("Policy", policySchema);
