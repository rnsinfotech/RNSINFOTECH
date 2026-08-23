// Simplified 4-state order lifecycle — see PROGRESS_ORDER_SIMPLIFICATION.md.
// Mirrors storefront-backend/admin-backend's Order.ORDER_STATUSES exactly;
// keep in sync if that ever changes.
export const ORDER_STATUSES = Object.freeze(["pending", "confirmed", "shipped", "cancelled"]);
