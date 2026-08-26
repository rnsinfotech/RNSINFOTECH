const { z } = require("zod");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const createPaymentOrderSchema = z.object({
  orderId: z.string().trim().regex(OBJECT_ID_RE, "orderId must be a valid id"),
});

// The only thing the browser sends to confirm a payment is which attempt
// it is asking about. Cashfree's Web Checkout hands the client no signed
// success payload, so there is nothing here for a client to forge: the
// server re-reads the authoritative status from Cashfree, and the caller
// must already own this gateway order id for the lookup to resolve.
//
// The pattern is pinned to ids this server generated (see
// buildGatewayOrderId) so arbitrary strings never reach the gateway.
const verifyPaymentSchema = z.object({
  gatewayOrderId: z.string().trim().regex(/^rns_[a-f0-9]{24}_[a-f0-9]{8}$/i, "gatewayOrderId must be a valid payment reference"),
});

module.exports = { createPaymentOrderSchema, verifyPaymentSchema };
