const AdminAuditLog = require("../models/AdminAuditLog");

function sanitize(value, depth = 0) {
  if (depth > 2) return "[truncated]";
  if (value == null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  if (typeof value !== "object") {
    if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }
  const out = {};
  for (const [key, val] of Object.entries(value)) {
    if (/password|token|secret|authorization|cookie/i.test(key)) continue;
    out[key] = sanitize(val, depth + 1);
  }
  return out;
}

function inferResource(path = "") {
  const parts = String(path).split("/").filter(Boolean);
  const apiIndex = parts.indexOf("api");
  return parts[apiIndex + 1] || parts[0] || "unknown";
}

function inferAction(method, path) {
  const normalized = String(path).toLowerCase();
  if (normalized.includes("/publish")) return "publish";
  if (normalized.includes("/refund")) return "refund";
  if (normalized.includes("/adjustments")) return "inventory_adjustment";
  if (normalized.includes("/invitations")) return "staff_invitation";
  if (normalized.includes("/status") || normalized.includes("/confirm") || normalized.includes("/ship") || normalized.includes("/cancel")) return "order_change";
  if (method === "DELETE") return "delete";
  if (method === "POST") return "create";
  if (method === "PATCH" || method === "PUT") return "update";
  return method.toLowerCase();
}

async function writeAudit({ req, statusCode, targetId = "", metadata = {} }) {
  if (!req.admin || !["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return null;
  return AdminAuditLog.create({
    actorId: req.admin._id,
    actorName: req.admin.name,
    actorEmail: req.admin.email,
    actorRole: req.admin.role,
    action: inferAction(req.method, req.originalUrl),
    resource: inferResource(req.originalUrl),
    method: req.method,
    path: req.originalUrl,
    targetId: targetId || req.params?.id || req.params?.threadId || "",
    statusCode,
    metadata: { body: sanitize(req.body), ...sanitize(metadata) },
    ip: req.ip || req.headers["x-forwarded-for"] || "",
  });
}

async function listAudit({ page = 1, limit = 50, action, resource, actorRole, q }) {
  const filter = {};
  if (action) filter.action = action;
  if (resource) filter.resource = resource;
  if (actorRole) filter.actorRole = actorRole;
  if (q) filter.$or = [{ actorName: { $regex: q, $options: "i" } }, { actorEmail: { $regex: q, $options: "i" } }, { path: { $regex: q, $options: "i" } }];
  const [items, total] = await Promise.all([
    AdminAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    AdminAuditLog.countDocuments(filter),
  ]);
  return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

module.exports = { writeAudit, listAudit, sanitize };
