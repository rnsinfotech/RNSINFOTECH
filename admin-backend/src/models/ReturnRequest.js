const mongoose = require("mongoose");

const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "pickup-scheduled",
  "received",
  "refunded",
  "replacement-initiated",
  "completed",
  "cancelled",
];

const returnItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  sku: { type: String, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
}, { _id: false });

const returnRequestSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: { type: [returnItemSchema], required: true, minlength: 1 },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  comments: { type: String, trim: true, maxlength: 2000, default: "" },
  evidence: [{ type: String, trim: true, maxlength: 500 }],
  status: { type: String, enum: RETURN_STATUSES, default: "requested", index: true },
  statusHistory: [{
    status: { type: String, enum: RETURN_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    actorType: { type: String, enum: ["customer","admin","system"], required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    note: { type: String, maxlength: 500, default: "" },
  }],
  pickupScheduledAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  refundAmount: { type: Number, min: 0, default: null },
  replacementNote: { type: String, default: null },
}, { timestamps: true });

returnRequestSchema.index({ user: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

returnRequestSchema.statics.RETURN_STATUSES = RETURN_STATUSES;
module.exports = mongoose.model("ReturnRequest", returnRequestSchema);
