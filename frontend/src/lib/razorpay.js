import { apiRequest } from "./api";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

let loadPromise = null;

/**
 * loadRazorpayCheckout — injects Razorpay's Checkout.js once and resolves
 * with the global `window.Razorpay` constructor. Safe to call more than
 * once (subsequent calls reuse the same in-flight/completed load), which
 * matters because PaymentPage can mount fresh on every "Pay now" retry.
 */
export function loadRazorpayCheckout() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay Checkout can only load in a browser."));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error("Razorpay Checkout failed to initialize."));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Could not reach Razorpay. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

// POST /api/payments/create-order — starts (or restarts) a payment
// attempt for an order this customer owns. Returns the Razorpay order id
// + amount (in paise) + the public key id the Checkout widget needs.
export function createPaymentOrder(orderId) {
  return apiRequest("/payments/create-order", {
    method: "POST",
    body: { orderId },
    authRequired: true,
  });
}

// POST /api/payments/verify — exactly the fields Razorpay Checkout's
// success handler hands back. The server re-derives the HMAC itself;
// nothing here is trusted client-side.
export function verifyPayment({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  return apiRequest("/payments/verify", {
    method: "POST",
    body: { razorpayOrderId, razorpayPaymentId, razorpaySignature },
    authRequired: true,
  });
}
