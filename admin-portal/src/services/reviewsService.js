import { adminApiRequest } from "../lib/adminApi";

function normalizeReview(review = {}) {
  const product = review.product && typeof review.product === "object" ? review.product : {};
  const user = review.user && typeof review.user === "object" ? review.user : {};
  return {
    id: review._id || review.id,
    productId: product._id || review.productId || review.product || "",
    productName: product.name || review.productName || "Unknown product",
    customerName: user.name || user.email || review.customerName || "Customer",
    rating: Number(review.rating || 0),
    date: review.createdAt ? new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : review.date || "",
    comment: review.comment || "",
  };
}

export async function getReviews({ product = "" } = {}) {
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (product) params.set("product", product);
  const payload = await adminApiRequest(`/reviews?${params.toString()}`);
  return (payload?.items || []).map(normalizeReview);
}

export async function getReviewStats() {
  const payload = await adminApiRequest("/reviews/stats");
  return payload || { total: 0, averageRating: 0 };
}

export async function deleteReview(id) {
  await adminApiRequest(`/reviews/${id}`, { method: "DELETE" });
  return true;
}
