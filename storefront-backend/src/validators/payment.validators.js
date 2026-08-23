const { z } = require("zod");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const createPaymentOrderSchema = z.object({
  orderId: z.string().trim().regex(OBJECT_ID_RE, "orderId must be a valid id"),
});

// Exactly the three fields Razorpay Checkout's success handler hands
// back to the frontend — nothing else is trusted from the client here,
// the signature check is what actually decides whether this is real.
const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

module.exports = { createPaymentOrderSchema, verifyPaymentSchema };
