import { getInvoice } from "./api";

function formatINR(n) {
  return "Rs. " + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * The browser is only responsible for presentation/PDF rendering.
 * All commercial, customer, seller, tax and payment values come from
 * the immutable backend invoice snapshot.
 */
export async function downloadInvoice(order) {
  const { invoice } = await getInvoice(order.id);
  if (!invoice) throw new Error("Invoice data is unavailable.");

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(invoice.seller.name || "RNS INFOTECH", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  const sellerAddress = [
    invoice.seller.legalName,
    invoice.seller.line1 || invoice.seller.address,
    [invoice.seller.city, invoice.seller.state, invoice.seller.pincode].filter(Boolean).join(", "),
    invoice.seller.gstin ? `GSTIN: ${invoice.seller.gstin}` : "",
  ].filter(Boolean).join(" | ");
  doc.text(sellerAddress || "Tax invoice", marginX, y + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text("TAX INVOICE", pageWidth - marginX, y, { align: "right" });

  y += 40;
  doc.setDrawColor(225);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 24;

  const colGap = (pageWidth - marginX * 2) / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text("Invoice details", marginX, y);
  doc.text("Bill to / Ship to", marginX + colGap, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(80);

  const payment = invoice.payment || {};
  const metaLines = [
    `Invoice no: ${invoice.invoiceNumber}`,
    `Invoice date: ${formatDate(invoice.invoiceDate)}`,
    `Order ID: ${invoice.order}`,
    `Payment: ${payment.status === "paid" ? (payment.method || "Online payment") : payment.status || "Unpaid"}`,
  ];
  metaLines.forEach((line, i) => doc.text(line, marginX, y + i * 14));

  const customer = invoice.customer || {};
  const customerLines = [
    customer.name,
    customer.email,
    customer.phone ? `Phone: ${customer.phone}` : "",
    customer.line1 || customer.address || "",
    [customer.line2, customer.city, customer.state, customer.pincode].filter(Boolean).join(", "),
    customer.gstin ? `GSTIN: ${customer.gstin}` : "",
  ].filter(Boolean);
  customerLines.forEach((line, i) => doc.text(line, marginX + colGap, y + i * 14));

  y += Math.max(metaLines.length, customerLines.length) * 14 + 26;

  const col = {
    item: marginX,
    qty: pageWidth - marginX - 220,
    price: pageWidth - marginX - 150,
    total: pageWidth - marginX,
  };

  doc.setFillColor(245, 246, 250);
  doc.rect(marginX, y - 14, pageWidth - marginX * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(20);
  doc.text("Item", col.item + 6, y + 1);
  doc.text("Qty", col.qty, y + 1);
  doc.text("Price", col.price, y + 1);
  doc.text("Amount", col.total, y + 1, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(50);
  (invoice.items || []).forEach((item) => {
    const name = item.sku ? `${item.name} (${item.sku})` : item.name;
    const nameLines = doc.splitTextToSize(name, col.qty - col.item - 20);
    nameLines.forEach((line, i) => doc.text(line, col.item + 6, y + i * 12));
    doc.text(String(item.quantity), col.qty, y);
    doc.text(formatINR(item.unitPrice), col.price, y);
    doc.text(formatINR(item.total), col.total, y, { align: "right" });
    y += Math.max(nameLines.length, 1) * 12 + 10;
    doc.setDrawColor(235);
    doc.line(marginX, y - 6, pageWidth - marginX, y - 6);
  });

  y += 10;
  const totalsX = pageWidth - marginX - 190;
  function totalRow(label, value, bold = false) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(bold ? 20 : 80);
    doc.text(label, totalsX, y);
    doc.text(value, pageWidth - marginX, y, { align: "right" });
    y += bold ? 18 : 15;
  }

  totalRow("Subtotal", formatINR(invoice.subtotal));
  if (invoice.discount > 0) totalRow("Discount", "-" + formatINR(invoice.discount));
  totalRow("Taxable value", formatINR(invoice.taxableValue));
  totalRow("Shipping", invoice.shippingFee === 0 ? "Free" : formatINR(invoice.shippingFee));
  if (invoice.deliveryFee > 0) totalRow("Delivery", formatINR(invoice.deliveryFee));
  if (invoice.cgstAmount > 0) totalRow(`CGST`, formatINR(invoice.cgstAmount));
  if (invoice.sgstAmount > 0) totalRow(`SGST`, formatINR(invoice.sgstAmount));
  if (invoice.igstAmount > 0) totalRow(`IGST`, formatINR(invoice.igstAmount));
  doc.setDrawColor(200);
  doc.line(totalsX, y - 4, pageWidth - marginX, y - 4);
  y += 10;
  totalRow("Total", formatINR(invoice.total), true);

  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(
    `GST: ${invoice.taxPolicy?.taxRate || 0}% | ${invoice.taxPolicy?.supplyType || "unknown"} | Place of supply: ${invoice.taxPolicy?.placeOfSupply || "—"}`,
    marginX,
    y
  );
  doc.text("Prices are exclusive of GST; tax is added as calculated by the backend pricing engine.", marginX, y + 13);
  doc.text("This invoice is generated from the verified order and payment record.", marginX, y + 26);

  doc.save(`invoice-${invoice.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`);
}
