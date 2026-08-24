const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
if (!configuredApiBaseUrl) throw new Error("VITE_API_BASE_URL is required.");
export const API_BASE_URL = configuredApiBaseUrl.replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "rns_storefront_access_token_v1";
const REFRESH_TOKEN_KEY = "rns_storefront_refresh_token_v1";
const USER_KEY = "rns_storefront_user_v1";

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  const refreshToken = typeof window !== "undefined"
    ? window.localStorage.getItem(REFRESH_TOKEN_KEY)
    : null;
  if (!refreshToken) return null;

  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.accessToken || !payload?.refreshToken) {
        clearStoredAuth();
        return null;
      }
      setStoredAuth({
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: getStoredUser(),
      });
      return payload.accessToken;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function refreshStorefrontAccessToken() {
  return refreshAccessToken();
}

export function getStoredAccessToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || null;
}

export function setStoredAuth({ accessToken, refreshToken, user }) {
  if (typeof window === "undefined") return;
  if (accessToken) window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  else window.localStorage.removeItem(ACCESS_TOKEN_KEY);

  if (refreshToken) window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  else window.localStorage.removeItem(REFRESH_TOKEN_KEY);

  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export class ApiClientError extends Error {
  constructor(message, { status = 0, code = "REQUEST_FAILED", payload = null, retryable = false, retryAfterSeconds = 0 } = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.payload = payload;
    this.retryable = retryable;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function userFacingApiMessage(status, payload, fallback = "We couldn't complete that request.") {
  // Domain-specific 401s (currently just OTP_INVALID, from /auth/verify-otp)
  // carry their own message and must not be clobbered by the generic
  // "session expired" copy below, or a wrong-code entry reads as if the
  // user's whole session died instead of just being told to retry the code.
  if (status === 401 && payload?.error?.code) return payload.error.message || fallback;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to perform this action.";
  if (status === 404) return "The requested information could not be found.";
  if (status === 409) return payload?.error?.message || "This request conflicts with the current data. Please refresh and try again.";
  if (status === 413) return "The request is too large.";
  if (status === 429) return payload?.error?.message || "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The service is temporarily unavailable. Please try again.";
  return payload?.error?.message || payload?.message || fallback;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function apiRequest(path, { method = "GET", body, token, headers = {}, authRequired = false, timeoutMs = 15000, retry = true, retryOnUnauthorized = true } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  const config = { method, headers: { ...headers }, signal: undefined };
  if (authRequired || token) {
    const finalToken = token || getStoredAccessToken();
    if (finalToken) config.headers.Authorization = `Bearer ${finalToken}`;
  }
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    config.headers["Content-Type"] = config.headers["Content-Type"] || "application/json";
    config.body = JSON.stringify(body);
  } else if (body !== undefined && body !== null) config.body = body;

  const canRetry = retry && ["GET", "HEAD"].includes(method.toUpperCase());
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...config, signal: controller.signal });
      clearTimeout(timer);
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json") ? await response.json().catch(() => null) : null;

      if (response.status === 401 && authRequired && retryOnUnauthorized && !path.includes("/auth/refresh")) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          config.headers.Authorization = `Bearer ${refreshedToken}`;
          return apiRequest(path, {
            method,
            body,
            headers,
            authRequired,
            timeoutMs,
            retry,
            retryOnUnauthorized: false,
          });
        }
      }

      if (response.ok) return payload;
      const retryAfterSeconds = Number(response.headers.get("retry-after") || payload?.error?.details?.retryAfterSeconds || 0);
      const retryableStatus = [502, 503, 504].includes(response.status);
      if (canRetry && retryableStatus && attempt === 0) { attempt += 1; await sleep(400); continue; }
      throw new ApiClientError(userFacingApiMessage(response.status, payload), {
        status: response.status, payload, code: payload?.error?.code || (response.status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED"),
        retryable: retryableStatus || response.status === 429, retryAfterSeconds,
      });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof ApiClientError) throw error;
      if (canRetry && attempt === 0) { attempt += 1; await sleep(400); continue; }
      throw new ApiClientError(error?.name === "AbortError" ? "The request timed out. Please try again." : "Network error. Please check your connection and try again.", { retryable: true });
    }
  }
}

/**
 * submitLead — posts to /api/leads. Backs the footer newsletter form,
 * /demo, /help's contact form, and /request-quote, which previously each
 * just faked a success after a setTimeout with nothing behind them.
 * `type` must be one of "newsletter" | "demo" | "contact" | "quote".
 */
export function submitLead({ type, name = "", email, phone = "", company = "", message = "", meta = {} }) {
  return apiRequest("/leads", {
    method: "POST",
    body: { type, name, email, phone, company, message, meta },
  });
}

export function getInvoice(orderId) {
  return apiRequest(`/orders/${encodeURIComponent(orderId)}/invoice`, {
    method: "GET",
    authRequired: true,
  });
}

export function getCheckoutQuote({ items, couponCode }) {
  return apiRequest("/checkout/quote", {
    method: "POST",
    body: {
      items: items.map((item) => ({
        product: item.product || item.id,
        quantity: Number(item.qty || item.quantity || 1),
      })),
      ...(couponCode ? { couponCode } : {}),
    },
    authRequired: true,
  });
}

export function normalizeAddress(address = {}) {
  return {
    id: address._id || address.id || null,
    name: address.fullName || address.name || "",
    phone: address.phone || "",
    line1: address.line1 || "",
    line2: address.line2 || "",
    city: address.city || "",
    state: address.state || "",
    pincode: address.pincode || "",
    country: address.country || "India",
    gstin: address.gstin || "",
    isDefault: Boolean(address.isDefault),
  };
}

export function normalizeOrder(order = {}) {
  const shipping = order.shippingAddress || {};
  // order.itemsTotal is the real payable amount from order.controller.js —
  // as of Phase BC (Coupons) it's already net of any applied discount, and
  // is exactly what PaymentPage charges via Razorpay. order.discount is
  // just the amount that was subtracted, kept for display/invoice only;
  // `subtotal` below is reconstructed (itemsTotal + discount) so the
  // pre-discount line item total still shows correctly even though the
  // backend never stores it separately.
  const discount = Number(order.discount || 0);
  const payableTotal = Number(order.itemsTotal || order.total || order.subtotal || 0);
  return {
    id: order._id || order.id,
    date: order.createdAt || order.date,
    items: (order.items || []).map((item) => ({
      id: item.product || item.id,
      name: item.name,
      image: item.image || "",
      price: item.price,
      mrp: item.mrp || item.price,
      qty: item.quantity || item.qty || 1,
      category: item.category || "",
      stock: "in-stock",
    })),
    subtotal: Number(order.subtotal ?? (payableTotal + discount)),
    shipping: Number(order.shippingFee ?? order.shipping ?? 0),
    deliveryFee: Number(order.deliveryFee || 0),
    tax: Number(order.tax || 0),
    savings: order.savings || 0,
    discount,
    couponCode: order.couponCode || null,
    total: payableTotal,
    shippingAddress: {
      name: shipping.fullName || shipping.name || "",
      phone: shipping.phone || "",
      line1: shipping.line1 || "",
      line2: shipping.line2 || "",
      city: shipping.city || "",
      state: shipping.state || "",
      pincode: shipping.pincode || "",
      country: shipping.country || "India",
      gstin: shipping.gstin || "",
    },
    // Online payment only — COD no longer exists, so there's nothing else this could be.
    paymentMethod: order.paymentMethod || "Online payment",
    paymentStatus: order.paymentStatus || "unpaid",
    status: order.status || "pending",
    trackingId: order.trackingId || null,
    courierName: order.courierName || null,
    confirmedAt: order.confirmedAt || null,
    shippedAt: order.shippedAt || null,
    cancelledAt: order.cancelledAt || null,
    cancelReason: order.cancelReason || null,
    user: order.user || null,
  };
}

export function normalizeReview(review = {}) {
  const user = review.user && typeof review.user === "object" ? review.user : null;
  return {
    id: review._id || review.id,
    rating: Number(review.rating || 0),
    comment: review.comment || "",
    createdAt: review.createdAt || null,
    // Reviews are public and unmoderated (see review.controller.js) —
    // the API populates only the reviewer's name, never email or any
    // other account detail.
    reviewerName: user?.name || "Anonymous",
  };
}

export function normalizeProduct(product = {}) {
  const categoryObj = product.category || {};
  const productImages = Array.isArray(product.images) ? product.images : [];
  const firstImage = productImages.length ? (typeof productImages[0] === "string" ? productImages[0] : productImages[0].url || "") : product.image || "";
  const specs = Array.isArray(product.specifications)
    ? product.specifications
    : product.specifications && typeof product.specifications === "object"
      ? Object.entries(product.specifications).map(([label, value]) => ({
          label,
          value: String(value ?? ""),
        }))
      : [];
  // tags[] is freeform (search/filtering elsewhere on the storefront) and
  // fully decoupled from homepage curation — Featured/Best Seller are
  // their own booleans below, not tag values. Kept as a full array
  // rather than truncating to the first entry so ProductGrid/ProductCard
  // can match against any of a product's tags, not just tags[0].
  const tags = Array.isArray(product.tags) ? product.tags : product.tag ? [product.tag] : [];

  return {
    id: product._id || product.id || product.slug,
    slug: product.slug || product.id || product._id,
    name: product.name || "",
    category: categoryObj.name || product.category || "",
    categoryId: categoryObj.slug || categoryObj._id || categoryObj.id || product.categoryId || "",
    brand: product.brand || "RNS INFOTECH",
    sku: product.sku || "",
    price: Number(product.price || 0),
    mrp: Number(product.mrp || product.price || 0),
    discountPercent: Number(product.discountPercent || 0),
    stock: Number(product.stock || 0) > 0 ? "in-stock" : "out-of-stock",
    image: firstImage,
    images: productImages.length ? productImages.map((img) => (typeof img === "string" ? img : img.url || "")).filter(Boolean) : firstImage ? [firstImage] : [],
    shortDescription: product.shortDescription || product.description || "",
    description: product.description || product.shortDescription || "",
    highlights: product.highlights || [],
    specs,
    // Manufacturer-hosted driver/manual links, set by the admin at
    // product creation/edit time — see ProductDetailPage's "Downloads
    // for this product" section, which renders these directly instead
    // of pulling from the old static siteData `downloads` catalogue.
    downloadLinks: Array.isArray(product.downloadLinks)
      ? product.downloadLinks.map((d) => ({ id: d._id || d.id || "", label: d.label || "", url: d.url || "" })).filter((d) => d.label && d.url)
      : [],
    // "What's in the box" item names — see ProductDetailPage's own
    // section for where this renders, separate from Description/Specifications.
    packageContents: Array.isArray(product.packageContents) ? product.packageContents.filter(Boolean) : [],
    rating: Number(product.rating || 0),
    reviewCount: Number(product.reviewCount || 0),
    reviews: product.reviews || [],
    tags,
    // `tag` (singular, first tag) kept read-only for any caller that
    // hasn't moved to the `tags` array yet.
    tag: tags[0] || "",
    isFeatured: Boolean(product.isFeatured),
    isBestSeller: Boolean(product.isBestSeller),
    stockCount: Number(product.stock || 0),
  };
}

/**
 * getHomepageProducts — GET /homepage-products, the single call HomePage
 * needs for all four curated/automatic rails. Returns already-normalized
 * arrays so callers never touch the raw API shape:
 *   { featured, bestSellers, newArrivals, discounted }
 * Each rail comes back pre-filtered and pre-sorted by the backend (see
 * storefront-backend/src/controllers/catalog.controller.js) — callers
 * should render each array as-is rather than re-filtering it.
 */
export async function getHomepageProducts() {
  const payload = await apiRequest("/homepage-products");
  return {
    featured: (payload?.featured || []).map(normalizeProduct),
    bestSellers: (payload?.bestSellers || []).map(normalizeProduct),
    newArrivals: (payload?.newArrivals || []).map(normalizeProduct),
    discounted: (payload?.discounted || []).map(normalizeProduct),
  };
}
