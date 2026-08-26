const crypto = require("crypto");
const EmailLog = require("../models/EmailLog");
const { env } = require("../config/env");
const logger = require("../utils/logger");

/* ============================================================
   BRAND / COMPANY CONFIG
   Fill these in (or wire them to env vars) — they show up in
   every email header, footer and CTA link.
   ============================================================ */
const BRAND = env.brandName || "RNS INFOTECH";
const BRAND_TAGLINE = env.brandTagline || "";
const BRAND_COLOR = env.brandColor || "#111827";      // header/CTA color
const ACCENT_COLOR = env.brandAccent || "#2563eb";     // links / highlights
const LOGO_URL = env.brandLogoUrl || "";               // optional, absolute URL
const SUPPORT_EMAIL = env.supportEmail || "support@rnsinfotech.co.in";
const SUPPORT_PHONE = env.supportPhone || "";
const COMPANY_ADDRESS = env.companyAddress || "";
const SITE_URL = env.siteUrl || "#";
const CURRENCY_SYMBOL = env.currencySymbol || "₹";

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

function money(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (Number.isNaN(n)) return esc(v);
  return `${CURRENCY_SYMBOL}${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return esc(v);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

/* ============================================================
   BASE LAYOUT (table-based for Outlook/Gmail compatibility)
   ============================================================ */
function layout({ preheader = "", title, intro = "", body = "", ctaLabel = "", ctaUrl = "" }) {
  const cta = ctaLabel && ctaUrl
    ? `<tr><td style="padding:8px 0 4px">
         <table role="presentation" cellpadding="0" cellspacing="0"><tr>
           <td style="border-radius:6px;background:${BRAND_COLOR}">
             <a href="${esc(ctaUrl)}" style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px">${esc(ctaLabel)}</a>
           </td>
         </tr></table>
       </td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_COLOR};padding:26px 32px;">
            <table role="presentation" width="100%"><tr>
              <td style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:.3px;">
                ${LOGO_URL ? `<img src="${esc(LOGO_URL)}" alt="${esc(BRAND)}" height="28" style="display:block;">` : esc(BRAND)}
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 8px;">
            <h1 style="margin:0 0 14px;font-size:20px;color:#111827;">${esc(title)}</h1>
            ${intro ? `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#374151;">${intro}</p>` : ""}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}${cta}</table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:28px 32px 32px;">
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;line-height:1.6;">
              Need help? Contact us at <a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:${ACCENT_COLOR};text-decoration:none;">${esc(SUPPORT_EMAIL)}</a>${SUPPORT_PHONE ? ` or call ${esc(SUPPORT_PHONE)}` : ""}.
            </p>
            ${COMPANY_ADDRESS ? `<p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">${esc(COMPANY_ADDRESS)}</p>` : ""}
            <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated message from ${esc(BRAND)}${BRAND_TAGLINE ? ` — ${esc(BRAND_TAGLINE)}` : ""}. Please do not reply directly to this email.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/* ============================================================
   REUSABLE CONTENT BLOCKS
   ============================================================ */

// Key/value summary rows, e.g. Order #, Date, Payment method
function summaryBlock(rows) {
  const filtered = rows.filter(([, v]) => v != null && v !== "");
  if (!filtered.length) return "";
  const trs = filtered.map(([label, value], i) => `
    <tr>
      <td style="padding:9px 0;border-top:${i === 0 ? "none" : "1px solid #f3f4f6"};font-size:13px;color:#6b7280;">${esc(label)}</td>
      <td style="padding:9px 0;border-top:${i === 0 ? "none" : "1px solid #f3f4f6"};font-size:13px;color:#111827;font-weight:600;text-align:right;">${value}</td>
    </tr>`).join("");
  return `<tr><td style="padding:4px 0 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:6px 16px;">${trs}</table>
  </td></tr>`;
}

// Line-items table: [{ name, qty, price, image }]
function itemsTable(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const rows = items.map(it => {
    const qty = it.qty || it.quantity || 1;
    const unit = it.price ?? it.unitPrice;
    const lineTotal = it.total ?? (unit != null ? Number(unit) * Number(qty) : null);
    return `
    <tr>
      <td style="padding:12px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#111827;">
        ${esc(it.name || it.title || "Item")}
        ${it.variant ? `<br><span style="font-size:12px;color:#9ca3af;">${esc(it.variant)}</span>` : ""}
      </td>
      <td style="padding:12px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#6b7280;text-align:center;">x${esc(qty)}</td>
      <td style="padding:12px 0;border-top:1px solid #f3f4f6;font-size:13px;color:#111827;text-align:right;">${lineTotal != null ? money(lineTotal) : ""}</td>
    </tr>`;
  }).join("");
  return `<tr><td style="padding:0 0 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;">Item</td>
        <td style="padding:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;text-align:center;">Qty</td>
        <td style="padding:0 0 8px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;text-align:right;">Amount</td>
      </tr>
      ${rows}
    </table>
  </td></tr>`;
}

// Totals breakdown: subtotal, shipping, tax, discount, total
function totalsBlock(d) {
  const rows = [
    ["Subtotal", d.subtotal],
    ["Shipping", d.shippingFee ?? d.shipping],
    ["Tax", d.tax],
    ["Discount", d.discount != null ? `-${money(d.discount)}` : null],
  ].filter(([, v]) => v != null && v !== "");
  if (!rows.length && d.total == null) return "";
  const lineRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:4px 0;font-size:13px;color:#6b7280;">${esc(label)}</td>
      <td style="padding:4px 0;font-size:13px;color:#111827;text-align:right;">${typeof value === "string" && value.startsWith("-") ? value : money(value)}</td>
    </tr>`).join("");
  const totalRow = d.total != null ? `
    <tr>
      <td style="padding:10px 0 0;font-size:14px;color:#111827;font-weight:bold;border-top:1px solid #e5e7eb;">Total</td>
      <td style="padding:10px 0 0;font-size:16px;color:${ACCENT_COLOR};font-weight:bold;text-align:right;border-top:1px solid #e5e7eb;">${money(d.total)}</td>
    </tr>` : "";
  return `<tr><td style="padding:14px 0 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lineRows}${totalRow}</table>
  </td></tr>`;
}

function addressBlock(label, addr) {
  if (!addr) return "";
  const line = typeof addr === "string"
    ? esc(addr)
    : [addr.name, addr.line1, addr.line2, [addr.city, addr.state, addr.pincode || addr.zip].filter(Boolean).join(", "), addr.country, addr.phone ? `Phone: ${addr.phone}` : null]
        .filter(Boolean).map(esc).join("<br>");
  if (!line) return "";
  return `<tr><td style="padding:0 0 18px">
    <p style="margin:0 0 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;">${esc(label)}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#111827;">${line}</p>
  </td></tr>`;
}

// Prominent tracking ID card for shipping emails
function trackingBlock(d) {
  if (!d.trackingId && !d.courier) return "";
  return `<tr><td style="padding:0 0 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 4px;font-size:11px;color:#2563eb;text-transform:uppercase;letter-spacing:.4px;font-weight:600;">Tracking ID</p>
        <p style="margin:0 0 10px;font-size:18px;color:#111827;font-weight:bold;letter-spacing:.5px;">${esc(d.trackingId || "Available soon")}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:13px;color:#374151;padding-right:18px;"><strong>Courier:</strong> ${esc(d.courier || "—")}</td>
          ${d.estimatedDelivery ? `<td style="font-size:13px;color:#374151;"><strong>Est. delivery:</strong> ${esc(fmtDate(d.estimatedDelivery) || d.estimatedDelivery)}</td>` : ""}
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`;
}

/* ============================================================
   TEMPLATE RENDERING
   ============================================================ */
function render(template, data = {}) {
  const d = data;
  const orderRef = d.orderNumber || d.orderId;

  switch (template) {

    case "otp": {
      return {
        subject: `Your ${BRAND} verification code`,
        text: `Your verification code is ${d.code}. It expires in ${d.ttlMinutes} minutes.`,
        html: layout({
          title: "Verify your email address",
          preheader: `Your verification code is ${d.code}`,
          intro: "Enter the code below to verify your email address. For your security, don't share this code with anyone.",
          body: `<tr><td style="padding:10px 0 22px;text-align:center;">
            <span style="display:inline-block;background:#f9fafb;border:1px dashed #d1d5db;border-radius:8px;padding:16px 28px;font-size:28px;font-weight:bold;letter-spacing:8px;color:${BRAND_COLOR};">${esc(d.code)}</span>
            <p style="margin:14px 0 0;font-size:13px;color:#6b7280;">This code expires in ${esc(d.ttlMinutes)} minutes.</p>
          </td></tr>`,
        }),
      };
    }

    case "order-confirmation": {
      const rows = [
        ["Order Number", esc(orderRef)],
        ["Order Date", fmtDate(d.orderDate) || fmtDate(new Date())],
        ["Payment Method", d.paymentMethod],
        ["Payment Status", d.paymentStatus],
      ];
      return {
        subject: `Order Confirmed — #${orderRef}`,
        text: `Your order ${orderRef} has been confirmed. Total: ${CURRENCY_SYMBOL}${d.total}.`,
        html: layout({
          title: "Thanks for your order!",
          preheader: `Order #${orderRef} confirmed — total ${money(d.total) || ""}`,
          intro: `We've received your order and it's being prepared. Here's a summary of what you ordered.`,
          body: summaryBlock(rows) + itemsTable(d.items) + totalsBlock(d) + addressBlock("Shipping Address", d.shippingAddress) + addressBlock("Billing Address", d.billingAddress),
          ctaLabel: d.orderUrl ? "View Order" : "",
          ctaUrl: d.orderUrl || (SITE_URL !== "#" ? `${SITE_URL}/orders/${orderRef}` : ""),
        }),
      };
    }

    case "payment-confirmation": {
      const rows = [
        ["Order Number", esc(orderRef)],
        ["Payment ID / Transaction ID", d.paymentId || d.transactionId],
        ["Payment Method", d.paymentMethod],
        ["Card / UPI Ref", d.last4 ? `•••• ${esc(d.last4)}` : d.upiRef],
        ["Payment Date", fmtDate(d.paymentDate) || fmtDate(new Date())],
        ["Amount Paid", money(d.amount)],
      ];
      return {
        subject: `Payment Received — Order #${orderRef}`,
        text: `Payment received for order ${orderRef}. Amount: ${CURRENCY_SYMBOL}${d.amount}.`,
        html: layout({
          title: "Payment received",
          preheader: `We received your payment of ${money(d.amount) || ""} for order #${orderRef}`,
          intro: `Thank you — your payment has been received and confirmed successfully.`,
          body: summaryBlock(rows) + itemsTable(d.items) + totalsBlock(d),
          ctaLabel: d.orderUrl ? "View Receipt" : "",
          ctaUrl: d.orderUrl || (SITE_URL !== "#" ? `${SITE_URL}/orders/${orderRef}` : ""),
        }),
      };
    }

    case "shipping": {
      const rows = [
        ["Order Number", esc(orderRef)],
        ["Shipped On", fmtDate(d.shippedAt) || fmtDate(new Date())],
      ];
      return {
        subject: `Your Order #${orderRef} Has Shipped`,
        text: `Your order has shipped via ${d.courier || "our courier"}. Tracking: ${d.trackingId || "available in your account"}.`,
        html: layout({
          title: "Your order is on its way!",
          preheader: `Tracking ID: ${d.trackingId || ""} via ${d.courier || ""}`,
          intro: `Good news — your order has left our warehouse and is headed your way.`,
          body: summaryBlock(rows) + trackingBlock(d) + itemsTable(d.items) + addressBlock("Delivering To", d.shippingAddress),
          ctaLabel: d.trackingUrl ? "Track Shipment" : "",
          ctaUrl: d.trackingUrl || "",
        }),
      };
    }

    case "delivery": {
      const rows = [
        ["Order Number", esc(orderRef)],
        ["Delivered On", fmtDate(d.deliveredAt) || fmtDate(new Date())],
      ];
      return {
        subject: `Order #${orderRef} Delivered`,
        text: `Your order ${orderRef} has been delivered.`,
        html: layout({
          title: "Your order has been delivered",
          preheader: `Order #${orderRef} was delivered successfully`,
          intro: `Your package has arrived. We hope you love what you ordered!`,
          body: summaryBlock(rows) + itemsTable(d.items) + addressBlock("Delivered To", d.shippingAddress),
          ctaLabel: d.reviewUrl ? "Leave a Review" : "",
          ctaUrl: d.reviewUrl || "",
        }),
      };
    }

    case "cancellation": {
      const rows = [
        ["Order Number", esc(orderRef)],
        ["Cancelled On", fmtDate(d.cancelledAt) || fmtDate(new Date())],
        ["Reason", d.reason],
      ];
      return {
        subject: `Order #${orderRef} Cancelled`,
        text: `Order ${orderRef} was cancelled. ${d.reason || ""}`,
        html: layout({
          title: "Your order has been cancelled",
          preheader: `Order #${orderRef} was cancelled`,
          intro: `As requested, we've cancelled the order below. If you paid online, any eligible refund will be processed to your original payment method.`,
          body: summaryBlock(rows) + itemsTable(d.items) + totalsBlock(d),
          ctaLabel: d.orderUrl ? "View Order" : "",
          ctaUrl: d.orderUrl || "",
        }),
      };
    }

    case "refund": {
      const rows = [
        ["Order Number", esc(orderRef)],
        ["Refund ID", d.refundId || "Pending"],
        ["Refund Amount", money(d.amount)],
        ["Refund Method", d.refundMethod || d.paymentMethod],
        ["Status", d.status],
        ["Initiated On", fmtDate(d.initiatedAt) || fmtDate(new Date())],
      ];
      return {
        subject: `Refund Update — Order #${orderRef}`,
        text: `Refund of ${CURRENCY_SYMBOL}${d.amount} for order ${orderRef} is ${d.status}. Refund ID: ${d.refundId || "pending"}.`,
        html: layout({
          title: "Refund update",
          preheader: `Refund of ${money(d.amount) || ""} is ${d.status || "processing"}`,
          intro: `Here's the latest status on your refund. It may take 5–7 business days to reflect in your account once processed.`,
          body: summaryBlock(rows) + itemsTable(d.items),
          ctaLabel: d.orderUrl ? "View Order" : "",
          ctaUrl: d.orderUrl || "",
        }),
      };
    }

    case "lead-notification": {
      const rows = [["Type", d.leadType], ["Name", d.name], ["Email", d.email], ["Phone", d.phone], ["Company", d.company]]
        .filter(([, v]) => v);
      return {
        subject: `New ${d.leadType || "website"} submission — ${d.name || d.email}`,
        text: rows.map(([k, v]) => `${k}: ${v}`).join("\n") + (d.message ? `\nMessage: ${d.message}` : ""),
        html: layout({
          title: `New ${esc(d.leadType || "website")} submission`,
          intro: `A new lead came in through the website.`,
          body: summaryBlock(rows) + (d.message ? `<tr><td style="padding:0 0 6px"><p style="margin:0 0 6px;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;">Message</p><p style="margin:0;font-size:13px;line-height:1.6;color:#111827;white-space:pre-wrap;">${esc(d.message)}</p></td></tr>` : ""),
        }),
      };
    }

    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

/* ============================================================
   QUEUE / DELIVERY (unchanged logic)
   ============================================================ */
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