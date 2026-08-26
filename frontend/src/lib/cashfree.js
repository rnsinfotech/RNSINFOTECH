import { apiRequest } from "./api";

// Cashfree Web Checkout v3. VERIFY THIS URL AND THE `mode` VALUES AGAINST
// THE OFFICIAL CASHFREE DOCS before going live — they are the only two
// pieces of Cashfree protocol that live in the browser bundle.
const CHECKOUT_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

let loadPromise = null;

/**
 * loadCashfreeCheckout — injects the Cashfree Web Checkout SDK once and
 * resolves with an initialised checkout instance. Safe to call more than
 * once (subsequent calls reuse the same in-flight/completed load), which
 * matters because PaymentPage can mount fresh on every "Pay now" retry.
 *
 * `mode` comes from the server, not from a build-time constant. That is
 * deliberate: it means a browser bundle can never be the reason a production
 * customer is sent to a sandbox checkout, because the environment is decided
 * by the same backend config that holds the credentials.
 */
export function loadCashfreeCheckout(mode = "sandbox") {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Cashfree Checkout can only load in a browser."));
  }
  if (window.Cashfree) return Promise.resolve(window.Cashfree({ mode }));
  if (loadPromise) return loadPromise.then((Ctor) => Ctor({ mode }));

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.Cashfree) resolve(window.Cashfree);
      else reject(new Error("Cashfree Checkout failed to initialize."));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Could not reach Cashfree. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });

  return loadPromise.then((Ctor) => Ctor({ mode }));
}

// POST /api/payments/create-order — starts (or resumes) a payment attempt
// for an order this customer owns. Returns the payment session id the
// Checkout SDK needs, plus the amount/currency purely so the UI can show
// what is about to be charged.
//
// Note what is NOT in that response: no API key, no app id, no secret. The
// session id is a short-lived, single-order capability — it is the only
// gateway credential a browser ever holds.
export function createPaymentOrder(orderId) {
  return apiRequest("/payments/create-order", {
    method: "POST",
    body: { orderId },
    authRequired: true,
  });
}

// POST /api/payments/verify — asks the server to go and find out what
// actually happened.
//
// Unlike a signature-callback gateway, Cashfree hands the browser no signed
// success payload, so there is nothing here for the client to assert or to
// forge. This call means "checkout closed, please look now"; the server
// re-reads authoritative status from Cashfree and decides. A customer who
// never makes this call still gets settled by the webhook.
export function verifyPayment({ gatewayOrderId }) {
  return apiRequest("/payments/verify", {
    method: "POST",
    body: { gatewayOrderId },
    authRequired: true,
  });
}
