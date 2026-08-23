const crypto = require("crypto");
const EmailLog = require("../models/EmailLog");
const { env } = require("../config/env");
const logger = require("../utils/logger");

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

const BRAND = "RNS INFOTECH";
function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#f6f6f3;font-family:Arial,sans-serif;color:#171717">
  <div style="max-width:640px;margin:32px auto;background:#fff;border:1px solid #e5e5e0">
  <div style="padding:24px;border-bottom:1px solid #e5e5e0"><strong>${BRAND}</strong></div>
  <div style="padding:28px"><h2 style="margin:0 0 18px">${esc(title)}</h2>${body}</div>
  <div style="padding:18px 28px;border-top:1px solid #e5e5e0;color:#777;font-size:12px">This is an automated message from ${BRAND}.</div>
  </div></body></html>`;
}

function render(template, data = {}) {
  const d = data;
  switch (template) {
    case "otp":
      return { subject:"Your RNS INFOTECH verification code", text:`Your verification code is ${d.code}. It expires in ${d.ttlMinutes} minutes.`, html:layout("Verify your email",`<p>Your verification code is <strong style="font-size:22px;letter-spacing:4px">${esc(d.code)}</strong>.</p><p>It expires in ${esc(d.ttlMinutes)} minutes.</p>`) };
    case "order-confirmation":
      return { subject:`Order ${d.orderNumber || d.orderId} confirmed`, text:`Your order ${d.orderNumber || d.orderId} has been confirmed. Total: ₹${d.total}.`, html:layout("Order confirmed",`<p>Your order <strong>${esc(d.orderNumber || d.orderId)}</strong> has been confirmed.</p><p>Total: ₹${esc(d.total)}</p>`) };
    case "payment-confirmation":
      return { subject:`Payment received for order ${d.orderNumber || d.orderId}`, text:`Payment received for order ${d.orderNumber || d.orderId}. Amount: ₹${d.amount}.`, html:layout("Payment received",`<p>We received your payment for order <strong>${esc(d.orderNumber || d.orderId)}</strong>.</p><p>Amount: ₹${esc(d.amount)}</p>`) };
    case "shipping":
      return { subject:`Order ${d.orderNumber || d.orderId} shipped`, text:`Your order has shipped via ${d.courier || "our courier"}. Tracking: ${d.trackingId || "available in your account"}.`, html:layout("Your order has shipped",`<p>Your order <strong>${esc(d.orderNumber || d.orderId)}</strong> is on its way.</p><p>Courier: ${esc(d.courier || "—")}<br>Tracking: <strong>${esc(d.trackingId || "—")}</strong></p>`) };
    case "delivery":
      return { subject:`Order ${d.orderNumber || d.orderId} delivered`, text:`Your order ${d.orderNumber || d.orderId} has been delivered.`, html:layout("Order delivered",`<p>Your order <strong>${esc(d.orderNumber || d.orderId)}</strong> has been delivered.</p>`) };
    case "cancellation":
      return { subject:`Order ${d.orderNumber || d.orderId} cancelled`, text:`Order ${d.orderNumber || d.orderId} was cancelled. ${d.reason || ""}`, html:layout("Order cancelled",`<p>Order <strong>${esc(d.orderNumber || d.orderId)}</strong> was cancelled.</p><p>${esc(d.reason || "")}</p>`) };
    case "refund":
      return { subject:`Refund update for order ${d.orderNumber || d.orderId}`, text:`Refund of ₹${d.amount} for order ${d.orderNumber || d.orderId} is ${d.status}. Refund ID: ${d.refundId || "pending"}.`, html:layout("Refund update",`<p>Refund for order <strong>${esc(d.orderNumber || d.orderId)}</strong>: ₹${esc(d.amount)}.</p><p>Status: ${esc(d.status)}${d.refundId ? `<br>Refund ID: ${esc(d.refundId)}` : ""}</p>`) };
    default: throw new Error(`Unknown email template: ${template}`);
  }
}

async function deliver(log) {
  const { sendRawMail } = require("./email.service");
  const rendered = render(log.template, log.metadata || {});
  await sendRawMail({ to: log.recipient, subject: rendered.subject, text: rendered.text, html: rendered.html });
}

async function queueEmail({ template, recipient, data = {}, event = template, eventKey = null }) {
  if (!recipient) return null;
  const rendered = render(template, data);
  let log;
  try {
    log = await EmailLog.findOneAndUpdate(
      eventKey ? { eventKey } : { _id: new (require("mongoose").Types.ObjectId)() },
      { $setOnInsert: { eventKey: eventKey || undefined, template, event, recipient, subject: rendered.subject, metadata: data, status:"queued", nextAttemptAt:new Date() } },
      { upsert:true, new:true, setDefaultsOnInsert:true }
    );
  } catch (err) {
    if (err.code === 11000 && eventKey) return EmailLog.findOne({ eventKey });
    throw err;
  }
  await attemptEmail(log);
  return log;
}

async function attemptEmail(log) {
  if (!log || log.status === "sent") return log;
  const claimed = await EmailLog.findOneAndUpdate(
    { _id: log._id, status: { $in:["queued","retry"] }, nextAttemptAt: { $lte:new Date() } },
    { $set:{ status:"sending" }, $inc:{ attempts:1 } },
    { new:true }
  );
  if (!claimed) return log;
  try {
    await deliver(claimed);
    claimed.status="sent"; claimed.sentAt=new Date(); claimed.lastError=null; await claimed.save();
  } catch (err) {
    const max = Math.max(1, Number(env.emailMaxAttempts || 5));
    const attempts = claimed.attempts;
    claimed.lastError = String(err.message || "SMTP failure").slice(0,500);
    if (attempts >= max) claimed.status="failed";
    else { claimed.status="retry"; claimed.nextAttemptAt=new Date(Date.now()+Math.min(30*60_000, 2 ** attempts * 15_000)); }
    await claimed.save();
    logger.error(`[email] ${claimed.template} delivery failed (attempt ${attempts}): ${claimed.lastError}`);
  }
  return claimed;
}

async function processEmailQueue() {
  const due = await EmailLog.find({ status:{ $in:["queued","retry"] }, nextAttemptAt:{ $lte:new Date() } }).sort({nextAttemptAt:1}).limit(20);
  for (const log of due) await attemptEmail(log);
}

function startEmailQueue() {
  const interval = setInterval(() => processEmailQueue().catch(err => logger.error(`[email] queue worker failed: ${err.message}`)), Math.max(10, Number(env.emailRetryIntervalSeconds || 30))*1000);
  return interval;
}

module.exports = { queueEmail, attemptEmail, processEmailQueue, startEmailQueue, render };
