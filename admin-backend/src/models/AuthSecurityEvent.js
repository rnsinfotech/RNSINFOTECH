const mongoose = require("mongoose");

const authSecurityEventSchema = new mongoose.Schema(
  {
    event: { type: String, required: true, index: true },
    email: { type: String, lowercase: true, trim: true, index: true },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null, index: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true }
);

authSecurityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

module.exports = mongoose.model("AuthSecurityEvent", authSecurityEventSchema);
