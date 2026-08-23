import { apiRequest } from "./api";

// validateCoupon — POST /coupons/validate. A read-only preview: the
// discount shown here is what CheckoutPage displays before an order
// exists, but it is NOT what actually gets applied. The real, binding
// application happens server-side inside POST /orders when the order is
// placed with the same code (see order.controller.js) — that call
// re-validates the coupon from scratch against the current DB state, so a
// code that previews fine here can still legitimately be rejected at
// placement time (expired/limit hit in between). Never authenticated —
// coupon codes aren't user-specific.
export async function validateCoupon(code, orderTotal) {
  const response = await apiRequest("/coupons/validate", {
    method: "POST",
    body: { code, orderTotal },
  });
  return {
    code: response.coupon?.code || String(code || "").trim().toUpperCase(),
    discount: Number(response.discount || 0),
    finalTotal: Number(response.finalTotal || 0),
  };
}
