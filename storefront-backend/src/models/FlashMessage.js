const mongoose = require("mongoose");

const flashMessageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["login", "sale", "newsletter", "custom"], default: "custom" },
    message: { type: String, required: true, trim: true },
    ctaLabel: { type: String, trim: true, default: "" },
    ctaHref: { type: String, trim: true, default: "" },
    active: { type: Boolean, default: true },
    durationSeconds: { type: Number, default: 5, min: 1 },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true, collection: "flash_messages", toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);
module.exports = mongoose.model("StorefrontFlashMessage", flashMessageSchema);
