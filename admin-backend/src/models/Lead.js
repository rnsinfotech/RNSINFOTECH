const mongoose = require("mongoose");

// Reads the same "leads" collection that storefront-backend writes to via
// POST /api/leads. That service owns creation (the public, unauthenticated
// storefront forms: footer newsletter signup, /demo, /help's contact form,
// and /request-quote, which also covers bulk-pricing requests). This copy
// of the model is admin-backend's read/moderate side — list, filter, and
// move a lead through new -> contacted -> closed, same pattern as Review.js.
const LEAD_TYPES = ["newsletter", "demo", "contact", "quote"];
const LEAD_STATUSES = ["new", "contacted", "closed"];

const leadSchema = new mongoose.Schema(
  {
    type: { type: String, enum: LEAD_TYPES, required: true, index: true },
    name: { type: String, trim: true, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true, default: "" },
    company: { type: String, trim: true, default: "" },
    message: { type: String, trim: true, default: "" },
    // Free-form extra fields per type (e.g. demo's interest/mode/preferredDate,
    // quote's product/quantity) so each form doesn't need its own collection.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: LEAD_STATUSES, default: "new", index: true },
    source: { type: String, trim: true, default: "" },
  },
  { timestamps: true, collection: "leads", toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);

leadSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model("Lead", leadSchema);
module.exports.LEAD_TYPES = LEAD_TYPES;
module.exports.LEAD_STATUSES = LEAD_STATUSES;
