const mongoose = require("mongoose");

const flashMessageSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["login", "sale", "newsletter", "custom"], default: "custom" },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    ctaLabel: { type: String, trim: true, default: "", maxlength: 100 },
    ctaHref: { type: String, trim: true, default: "", maxlength: 500 },
    active: { type: Boolean, default: true, index: true },
    durationSeconds: { type: Number, default: 5, min: 1, max: 120 },
    sortOrder: { type: Number, default: 0, index: true },
  },
  {
    timestamps: true,
    collection: "flash_messages",
    toJSON: { transform(doc, ret) { delete ret.__v; return ret; } },
  }
);

module.exports = mongoose.model("AdminFlashMessage", flashMessageSchema);
