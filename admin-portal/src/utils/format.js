export const STATUS_TONE = {
  pending: "warning",
  processing: "info",
  confirmed: "info",
  packed: "info",
  shipped: "info",
  "out-for-delivery": "info",
  delivered: "success",
  "return-requested": "warning",
  returned: "info",
  cancelled: "danger",
  successful: "success",
  failed: "danger",
  refunded: "neutral",
  "in-stock": "success",
  "low-stock": "warning",
  "out-of-stock": "danger",
  active: "success",
  inactive: "neutral",
  approved: "success",
  rejected: "danger",
  expired: "neutral",
  exhausted: "neutral",
  published: "success",
  draft: "neutral",
  new: "warning",
  contacted: "info",
  closed: "neutral",
};

export function statusLabel(status) {
  return status
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
