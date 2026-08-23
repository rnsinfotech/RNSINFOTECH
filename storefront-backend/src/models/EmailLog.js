const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema({
  eventKey: { type: String, unique: true, sparse: true, index: true },
  template: { type: String, required: true, index: true },
  event: { type: String, required: true, index: true },
  recipient: { type: String, required: true, index: true },
  subject: { type: String, required: true },
  status: { type: String, enum: ["queued", "sending", "sent", "retry", "failed"], default: "queued", index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  sentAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

emailLogSchema.index({ status: 1, nextAttemptAt: 1 });
emailLogSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
