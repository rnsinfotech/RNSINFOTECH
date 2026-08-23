import { adminApiRequest } from "../lib/adminApi";

// Leads = everything the storefront's public forms send in: the footer
// newsletter signup, /demo (Book a Demo), /help's contact form, and
// /request-quote — which also covers "Corporate & Bulk Sales" pricing
// asks, since CorporateSalesPage deliberately reuses the quote form rather
// than having its own. All four land in one "leads" collection with a
// `type` field, which is what the tabs below filter on.
function normalizeLead(lead = {}) {
  return {
    id: lead._id || lead.id,
    type: lead.type || "contact",
    name: lead.name || "",
    email: lead.email || "",
    phone: lead.phone || "",
    company: lead.company || "",
    message: lead.message || "",
    meta: lead.meta && typeof lead.meta === "object" ? lead.meta : {},
    status: lead.status || "new",
    source: lead.source || "",
    date: lead.createdAt ? new Date(lead.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "",
    createdAt: lead.createdAt || null,
  };
}

export async function getLeads({ type = "", status = "", search = "" } = {}) {
  const params = new URLSearchParams({ page: "1", limit: "100" });
  if (type && type !== "all") params.set("type", type);
  if (status && status !== "all") params.set("status", status);
  if (search) params.set("search", search);
  const payload = await adminApiRequest(`/leads?${params.toString()}`);
  return (payload?.items || []).map(normalizeLead);
}

export async function getLeadStats() {
  const payload = await adminApiRequest("/leads/stats");
  return payload || { total: 0, new: 0, contacted: 0, closed: 0, byType: { newsletter: 0, demo: 0, contact: 0, quote: 0 } };
}

export async function setLeadStatus(id, status) {
  const payload = await adminApiRequest(`/leads/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
  return payload?.lead ? normalizeLead(payload.lead) : null;
}

export async function deleteLead(id) {
  await adminApiRequest(`/leads/${id}`, { method: "DELETE" });
  return true;
}
