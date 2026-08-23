const mongoose = require("mongoose");

const adminAuditLogSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
  actorName: { type: String, default: "", trim: true },
  actorEmail: { type: String, default: "", lowercase: true, trim: true },
  actorRole: { type: String, enum: ["Owner", "Manager", "Staff"], required: true, index: true },
  action: { type: String, required: true, index: true },
  resource: { type: String, required: true, index: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  targetId: { type: String, default: "", index: true },
  statusCode: { type: Number, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "" },
}, { timestamps: true });

adminAuditLogSchema.index({ createdAt: -1 });
module.exports = mongoose.model("AdminAuditLog", adminAuditLogSchema);
