import { getDashboardSummary } from "./dashboardService";
import { getOrders } from "./ordersService";

// There's no notifications model/endpoint on admin-backend, so this
// is computed client-side from data the existing services already
// expose — low stock (dashboard summary) and pending orders. Reviews
// go live the moment a shopper submits them (no moderation queue —
// see reviewsService.js), so they don't need a notification here.
// "Read" state has nothing to persist against on the server, so it's
// tracked locally instead.
const DISMISSED_KEY = "admin_notifications_dismissed_v1";
const MAX_PER_GROUP = 5;

function getDismissedSet() {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

function saveDismissedSet(set) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // best-effort only — a full/blocked localStorage shouldn't break the panel
  }
}

export function dismissNotification(id) {
  const dismissed = getDismissedSet();
  dismissed.add(id);
  saveDismissedSet(dismissed);
}

export function dismissAllNotifications(ids) {
  const dismissed = getDismissedSet();
  ids.forEach((id) => dismissed.add(id));
  saveDismissedSet(dismissed);
}

function timeAgo(dateLike) {
  if (!dateLike) return "";
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * getNotifications — a merged, sorted (unread first) list of things
 * that likely need admin attention right now. Best-effort: any one
 * source failing doesn't take down the whole panel.
 */
export async function getNotifications() {
  const [summary, pendingOrders] = await Promise.all([
    getDashboardSummary().catch(() => null),
    getOrders({ status: "pending" }).catch(() => []),
  ]);

  const items = [];

  (summary?.lowStock || []).slice(0, MAX_PER_GROUP).forEach((p) => {
    const outOfStock = Number(p.stock) <= 0;
    items.push({
      id: `inventory:${p.sku || p.name}`,
      icon: "warehouse",
      severity: outOfStock ? "danger" : "warning",
      title: outOfStock ? `${p.name} is out of stock` : `${p.name} is low on stock`,
      detail: `${p.sku ? `SKU ${p.sku} · ` : ""}${p.stock} left`,
      href: "/inventory",
      at: null,
    });
  });

  pendingOrders.slice(0, MAX_PER_GROUP).forEach((o) => {
    items.push({
      id: `order:${o.id}`,
      icon: "truck",
      severity: "info",
      title: "New order needs confirmation",
      detail: `#${String(o.id).slice(-6).toUpperCase()} · ${o.customerEmail || "Customer"}`,
      href: `/orders/${o.id}`,
      at: o.date,
    });
  });

  const dismissed = getDismissedSet();
  return items
    .map((item) => ({
      ...item,
      read: dismissed.has(item.id),
      timeLabel: item.timeLabelOverride ?? timeAgo(item.at),
    }))
    .sort((a, b) => Number(a.read) - Number(b.read));
}
