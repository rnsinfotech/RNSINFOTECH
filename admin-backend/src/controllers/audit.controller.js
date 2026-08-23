const asyncHandler = require("../utils/asyncHandler");
const { listAudit } = require("../services/audit.service");

const list = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
  const result = await listAudit({ page, limit, action: req.query.action, resource: req.query.resource, actorRole: req.query.actorRole, q: String(req.query.q || "").trim() });
  res.json(result);
});

module.exports = { list };
