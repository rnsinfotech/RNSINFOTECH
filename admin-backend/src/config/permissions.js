const ROLE_PERMISSIONS = {
  Owner: new Set([
    "catalog.write", "inventory.write", "orders.write", "payments.refund", "content.write",
    "website.write", "coupons.write", "reviews.write", "leads.write", "settings.write", "staff.manage", "audit.read", "chat.write",
  ]),
  Manager: new Set([
    "catalog.write", "inventory.write", "orders.write", "payments.refund", "content.write",
    "website.write", "coupons.write", "reviews.write", "leads.write", "chat.write", "audit.read", "staff.manage",
  ]),
  Staff: new Set(["orders.write", "chat.write"]),
};

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.has(permission) === true;
}

module.exports = { ROLE_PERMISSIONS, hasPermission };
