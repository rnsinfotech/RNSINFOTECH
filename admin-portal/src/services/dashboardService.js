import { adminApiRequest } from "../lib/adminApi";

function normalizeDashboard(data = {}) {
  return {
    stats: Array.isArray(data.stats) ? data.stats : [],
    salesTrend: Array.isArray(data.salesTrend) ? data.salesTrend : [],
    recentOrders: Array.isArray(data.recentOrders) ? data.recentOrders : [],
    lowStock: Array.isArray(data.lowStock) ? data.lowStock : [],
    recentActivity: Array.isArray(data.recentActivity) ? data.recentActivity : [],
  };
}

export async function getDashboardSummary() {
  const payload = await adminApiRequest("/dashboard/summary");
  return normalizeDashboard(payload);
}
