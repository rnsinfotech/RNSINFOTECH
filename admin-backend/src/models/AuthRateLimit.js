const mongoose = require("mongoose");

const authRateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    attempts: { type: Number, default: 0 },
    windowStartedAt: { type: Date, required: true },
    blockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

authRateLimitSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = mongoose.model("AuthRateLimit", authRateLimitSchema);
