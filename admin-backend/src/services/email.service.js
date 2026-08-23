const { env } = require("../config/env");
const logger = require("../utils/logger");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// Raw-socket SMTP (like storefront-backend's old approach) turned out to be
// unreliable on Render's outbound network — connections would hang or fail
// with ENETUNREACH depending on which address family got resolved. Resend's
// HTTPS API is the same kind of outbound traffic every other call in this
// app already makes reliably, so it sidesteps SMTP-port issues entirely.
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

async function sendAdminPasswordResetEmail(email,resetUrl){
  const safeUrl=escapeHtml(resetUrl);
  return sendRawMail({to:email,subject:"Reset your RNS INFOTECH admin password",text:`A password reset was requested. Use this link within ${env.adminPasswordResetTtlMinutes} minutes:\n\n${resetUrl}`,html:`<p>A password reset was requested.</p><p><a href="${safeUrl}">Reset your password</a></p><p>This link expires in ${env.adminPasswordResetTtlMinutes} minutes.</p>`});
}
async function sendAdminInvitationEmail(email,name,role,inviteUrl){
  const safeUrl=escapeHtml(inviteUrl);
  return sendRawMail({to:email,subject:"You have been invited to RNS INFOTECH Admin Portal",text:`Hello ${name},\n\nYou have been invited as ${role}. Activate here:\n${inviteUrl}`,html:`<p>Hello ${escapeHtml(name)},</p><p>You have been invited as <strong>${escapeHtml(role)}</strong>.</p><p><a href="${safeUrl}">Set your password and activate your account</a></p>`});
}
async function sendTransactionalEmail(template,recipient,data,eventKey){
  const {queueEmail}=require("./emailTemplates.service");
  return queueEmail({template,recipient,data,event:template,eventKey});
}
module.exports={sendRawMail,sendAdminPasswordResetEmail,sendAdminInvitationEmail,sendTransactionalEmail};