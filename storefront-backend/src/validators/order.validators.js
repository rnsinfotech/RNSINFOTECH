const { z } = require("zod");

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const orderItemInputSchema = z.object({
  product: z.string().trim().regex(OBJECT_ID_RE, "product must be a valid id"),
  quantity: z.coerce.number().int().min(1).max(50),
});

const shippingAddressInputSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().min(3).max(12),
  country: z.string().trim().min(2).max(100).optional().default("India"),
  gstin: z.string().trim().max(15).optional().default(""),
});

// POST /api/orders body — deliberately takes only `product` + `quantity`
// per item, never a client-supplied price. order.controller.js re-prices
// every item from the current Product doc server-side; a tampered price
// in the request body is simply ignored, not trusted.
const placeOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, "An order must contain at least one item."),
  shippingAddress: shippingAddressInputSchema,
  // Phase BC (Coupons) — optional. order.controller.js re-validates this
  // server-side against the current Coupon doc exactly like
  // POST /coupons/validate does; nothing about the discount itself is
  // ever trusted from the client.
  couponCode: z.string().trim().min(1).max(50).optional(),
});

const listMyOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["pending", "confirmed", "shipped", "cancelled"]).optional(),
});

const orderActionSchema = z.object({ reason: z.string().trim().max(300).optional() });
module.exports = { placeOrderSchema, listMyOrdersQuerySchema, orderActionSchema };
