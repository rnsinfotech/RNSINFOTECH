const mongoose = require("mongoose");

// Not part of BACKEND_PLAN.md's ownership matrix — it's an internal
// implementation detail of storefront-backend's own auth flow, not data the
// other service ever needs to read. One doc per requested code; the TTL
// index below lets Mongo garbage-collect expired/used codes on its own so
// this collection never grows unbounded.
const otpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, default: "login" },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: Mongo deletes the document once expiresAt is in the past.
// Codes are short-lived (see OTP_TTL_MINUTES in the service) so this just
// keeps the collection tidy, not a security control on its own.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// At most one active OTP can exist for an email. Expired records are removed
// before issuing a new code, and the unique partial index closes the race
// between simultaneous OTP requests.
otpSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { consumedAt: null } });

module.exports = mongoose.model("Otp", otpSchema);
