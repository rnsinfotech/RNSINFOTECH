// navConfig — the sidebar, the router, and (later) breadcrumbs all read
// from this one list instead of hardcoding links in three places. Each
// entry's `phase` matches the phase plan in HANDOFF.md; `status: "stub"`
// pages render an <EmptyState> "coming in Phase N" placeholder until that
// phase builds them out, so the nav is fully wired from Phase 0 even
// though most pages don't have real content yet.

export const navConfig = [
  {
    group: "Overview",
    items: [{ label: "Dashboard", path: "/", icon: "home", phase: 1, status: "planned" }],
  },
  {
    group: "Catalogue",
    items: [
      { label: "Products", path: "/products", icon: "package", phase: 2, status: "built" },
      { label: "Categories", path: "/categories", icon: "tag", phase: 2, status: "built" },
      { label: "Brands", path: "/brands", icon: "layers", phase: 2, status: "built" },
      { label: "Inventory", path: "/inventory", icon: "warehouse", phase: 3, status: "built" },
    ],
  },
  {
    group: "Sales",
    items: [
      { label: "Orders", path: "/orders", icon: "truck", phase: 4, status: "built" },
      { label: "Payments", path: "/payments", icon: "creditCard", phase: 4, status: "built" },
      { label: "Coupons", path: "/coupons", icon: "percent", phase: 8, status: "built" },
    ],
  },
  {
    group: "People",
    items: [
      { label: "Customers", path: "/customers", icon: "user", phase: 5, status: "built" },
      { label: "Leads", path: "/leads", icon: "inbox", phase: 20, status: "built" },
      { label: "Chat", path: "/chat", icon: "message", phase: 6, status: "built" },
      { label: "Reviews", path: "/reviews", icon: "star", phase: 8, status: "built" },
    ],
  },
  {
    group: "Site",
    items: [
      { label: "Website management", path: "/website", icon: "layout", phase: 7, status: "built" },
      { label: "Content", path: "/content", icon: "fileText", phase: 8, status: "built" },
    ],
  },
  {
    group: "System",
    items: [{ label: "Settings", path: "/settings", icon: "gear", phase: 9, status: "built" },
      { label: "Staff", path: "/staff", icon: "user", phase: 13, status: "built", roles: ["Owner", "Manager"] },
      { label: "Audit log", path: "/audit", icon: "fileText", phase: 13, status: "built", roles: ["Owner", "Manager"] }],
  },
];

// Flat lookup used by the router and the topbar (page title, breadcrumb).
export const navItemsFlat = navConfig.flatMap((g) => g.items);
