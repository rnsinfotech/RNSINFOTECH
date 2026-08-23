import React from "react";
import { useLocation } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import { navItemsFlat } from "../config/navConfig";

const DESCRIPTIONS = {
  "/products": "Product list, search/filter/sort, add/edit, images, pricing, inventory and status.",
  "/categories": "Category list with add/edit/delete, images, product counts and active/inactive toggles.",
  "/brands": "Brand list with add/edit/delete, logos, product counts and active/inactive toggles.",
  "/inventory": "Stock overview, in-stock/low-stock/out-of-stock views, stock adjustment UI and history.",
  "/orders": "All orders across every status, order details, timeline and status-update UI.",
  "/payments": "Payment list and details — successful, pending, failed and refunded.",
  "/coupons": "Create and manage coupons — discount type/value, expiry and usage limits.",
  "/customers": "Customer list, search/filter, order history and total spend.",
  "/chat": "Admin chat console — conversation list, unread state, composer and linked order.",
  "/reviews": "Review moderation — pending, approved, rejected, with approve/reject UI.",
  "/website": "Manage everything visible on the customer homepage — hero, banners, featured sections.",
  "/content": "FAQs, policies, pages and blog content.",
  "/settings": "Store settings, admin profile, notifications and general settings.",
};

export default function StubPage() {
  const { pathname } = useLocation();
  const item = navItemsFlat.find((i) => pathname.startsWith(i.path) && i.path !== "/");

  return (
    <EmptyState
      icon={item?.icon || "info"}
      title={item?.label || "Coming soon"}
      description={DESCRIPTIONS[pathname] || "This section will be built out in a later phase."}
      phase={item?.phase}
    />
  );
}
