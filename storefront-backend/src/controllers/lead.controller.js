const Lead = require("../models/Lead");
const { sendTransactionalEmail } = require("../services/email.service");
const { env } = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const logger = require("../utils/logger");

const create = asyncHandler(async (req, res) => {
  const { type, name, email, phone, company, message, meta } = req.body;

  const lead = await Lead.create({ type, name, email, phone, company, message, meta, source: req.get("origin") || "" });

  // Notify the store, but never let a broken SMTP config fail the
  // customer's submission - they should still get their "thanks, we got
  // it" response even if the internal notification email doesn't go out.
  const notifyTo = env.leadNotifyEmail || env.emailFrom;
  if (notifyTo) {
    sendTransactionalEmail("lead-notification", notifyTo, { leadType: type, name, email, phone, company, message }, null)
      .catch((err) => logger.error("lead_notification_email_failed", { leadId: String(lead._id), error: err.message }));
  }

  res.status(201).json({ lead: { id: String(lead._id), type: lead.type, createdAt: lead.createdAt } });
});

module.exports = { create };
