import { adminApiRequest } from "../lib/adminApi";

function normalizeCustomer(customer = {}) {
  const orders = Array.isArray(customer.orders) ? customer.orders : [];
  const lastOrderDate = customer.lastOrderAt || orders[0]?.createdAt || null;

  return {
    id: customer._id || customer.id || customer.email,
    email: customer.email || "",
    name: customer.name || "",
    phone: customer.phone || "",
    city: customer.city || "",
    state: customer.state || "",
    orderCount: Number(customer.orderCount || orders.length || 0),
    totalSpent: Number(customer.totalSpent || 0),
    lastOrderDate,
    firstOrderDate: customer.firstOrderAt || customer.createdAt || null,
    orders,
  };
}

export async function getCustomers(filters = {}) {
  const { q = "", sort = "recent" } = filters;
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (q) params.set("search", q);

  const payload = await adminApiRequest(`/customers?${params.toString()}`);
  const items = (payload?.items || []).map(normalizeCustomer);

  if (sort === "orders") items.sort((a, b) => b.orderCount - a.orderCount);
  else if (sort === "spend") items.sort((a, b) => b.totalSpent - a.totalSpent);
  else items.sort((a, b) => new Date(b.lastOrderDate || 0) - new Date(a.lastOrderDate || 0));

  return items;
}

export async function getCustomer(email) {
  const items = await getCustomers({});
  return items.find((customer) => customer.email.toLowerCase() === String(email).toLowerCase()) || null;
}

export async function getCustomerStats() {
  const items = await getCustomers({});
  return {
    total: items.length,
    repeat: items.filter((customer) => customer.orderCount > 1).length,
    totalRevenue: items.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0),
    avgOrderValue: items.length ? Math.round(items.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0) / items.reduce((sum, customer) => sum + Number(customer.orderCount || 0), 0)) : 0,
  };
}
