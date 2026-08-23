const { env } = require("../config/env");
const logger = require("../utils/logger");

// Render's outbound network intermittently fails/times out on raw SMTP
// connections to Gmail (both IPv4 and IPv6, on port 587), which made OTP
// delivery unreliable. Resend's API is a normal HTTPS POST — the same kind
// of outbound traffic every other call in this app already makes reliably —
// so it sidesteps SMTP-port flakiness entirely instead of working around it.
const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function sendRawMail({ to, subject, text, html }) {
  if (!env.resendApiKey) {
    logger.info(`[email:dev] ${subject} -> ${to}`);
    return { accepted: [to], dev: true };
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API ${res.status}: ${body.slice(0, 300)}`);
  }

  return res.json();
}

async function sendOtpEmail(email, code) {
  const { queueEmail } = require("./emailTemplates.service");
  return queueEmail({ template:"otp", recipient:email, event:"otp", eventKey:`otp:${email}:${code}`, data:{ code, ttlMinutes:env.otpTtlMinutes } });
}
async function sendTransactionalEmail(template, recipient, data, eventKey) {
  const { queueEmail } = require("./emailTemplates.service");
  return queueEmail({ template, recipient, data, event:template, eventKey });
}
module.exports = { sendRawMail, sendOtpEmail, sendTransactionalEmail };