const mongoose = require("mongoose");

const inventoryLogSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    action: { type: String, enum: ["increase", "decrease", "reservation", "release", "adjustment"], required: true, index: true },
    delta: { type: Number, required: true },
    previousQty: { type: Number, required: true, min: 0 },
    newQty: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, default: "Inventory operation" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    actorUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actorName: { type: String, default: null },
    actorEmail: { type: String, default: null },
    actorType: { type: String, enum: ["customer", "admin", "system"], default: "system" },
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);

inventoryLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("InventoryLog", inventoryLogSchema);
