const { writeAudit } = require("../services/audit.service");
const logger = require("../utils/logger");

function auditAdminMutation(req, res, next) {
  const originalEnd = res.end;
  res.end = function auditedEnd(...args) {
    const result = originalEnd.apply(this, args);
    if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method) && req.admin) {
      writeAudit({ req, statusCode: res.statusCode }).catch((err) => {
        // Auditing must never break a successful business operation.
        if (process.env.NODE_ENV !== "test") logger.error("audit_write_failed", { error: err.message, requestId: req.id });
      });
    }
    return result;
  };
  next();
}
module.exports = auditAdminMutation;
