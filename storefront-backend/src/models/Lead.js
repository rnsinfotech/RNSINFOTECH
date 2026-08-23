const mongoose = require("mongoose");

// Backs the frontend's previously-fake forms: footer newsletter signup,
// /demo (Book a Demo), /help contact form, and /request-quote. Each of
// those used to just fire a setTimeout + toast with nothing behind it —
// this collection + the /api/leads route give them somewhere real to land,
// and a notification email goes out per submission (see lead.controller.js).
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
