const mongoose = require("mongoose");

// Collection: `webhookevents` — written and read only by storefront-backend's
// payment webhook handler.
//
// WHY THIS EXISTS
// Payment gateways guarantee at-least-once webhook delivery, not exactly-once.
// Cashfree retries on any non-2xx response and on timeouts, so the same
// PAYMENT_SUCCESS event legitimately arrives more than once. Without a
// durable record of what has already been handled, each redelivery would
// re-run settlement: a second inventory decrement, a second coupon
// consumption, a second confirmation email.
//
// The unique index on `eventKey` is the actual idempotency mechanism. The
// handler inserts first and processes second, so two concurrent deliveries of
// the same event race on the index and exactly one wins — the loser gets a
// duplicate-key error and acknowledges without doing any work. This is a
// database-level guarantee rather than an application-level check, which
// matters because the two deliveries may land on different Node processes
// where an in-memory guard would see nothing.
const webhookEventSchema = new mongoose.Schema(
  {
    gateway: { type: String, default: "cashfree", index: true },
    // Content-derived stable identity — see webhookEventKey() in
    // cashfree.service.js. A retry of the same event yields the same key; a
    // genuinely later event on the same payment yields a different one.
    eventKey: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, index: true },
    // Local correlation, for support queries like "show me every webhook we
    // received for this order".
    payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null, index: true },
    gatewayOrderId: { type: String, default: null, index: true },
    gatewayPaymentId: { type: String, default: null },

    status: { type: String, enum: ["processing", "processed", "failed", "ignored"], default: "processing", index: true },
    // Short failure note only. The raw webhook body is deliberately NOT
    // stored: it carries customer contact details and payment instrument
    // metadata that this collection has no reason to retain.
    error: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Housekeeping: these rows exist to suppress duplicate deliveries, and
// gateways stop retrying long before this. Thirty days is far past any
// realistic retry window while still covering a support lookback.
webhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model("WebhookEvent", webhookEventSchema);
