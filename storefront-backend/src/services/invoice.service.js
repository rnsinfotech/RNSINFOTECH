const mongoose = require("mongoose");
const Invoice = require("../models/Invoice");
const InvoiceCounter = require("../models/InvoiceCounter");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");
const Product = require("../models/Product");
const SiteSettings = require("../models/SiteSettings");
const { calculateStoredOrderPricing } = require("./pricing.service");
const { splitTax } = require("./tax.service");
const ApiError = require("../utils/ApiError");

function fiscalYear(date = new Date()) {
  const d = new Date(date);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

function formatInvoiceNumber(fy, sequence) {
  return `RNS/${fy}/${String(sequence).padStart(6, "0")}`;
}

function partyFromAddress(address = {}, user = {}) {
  return {
    name: address.fullName || user.name || "",
    legalName: "",
    email: user.email || "",
    phone: address.phone || "",
    line1: address.line1 || "",
    line2: address.line2 || "",
    city: address.city || "",
    state: address.state || "",
    pincode: address.pincode || "",
    country: address.country || "India",
    gstin: address.gstin || "",
    stateCode: "",
  };
}

function sellerFromProfile(profile = {}) {
  return {
    name: profile.name || "RNS INFOTECH",
    legalName: profile.legalName || profile.name || "RNS INFOTECH",
    email: profile.email || "",
    phone: profile.phone || "",
    address: profile.address || "",
    line1: profile.line1 || "",
    line2: profile.line2 || "",
    city: profile.city || "",
    state: profile.state || "",
    pincode: profile.pincode || "",
    country: profile.country || "India",
    gstin: profile.gstin || "",
    stateCode: "",
  };
}

async function nextInvoiceNumber(date, session) {
  const fy = fiscalYear(date);
  const counter = await InvoiceCounter.findOneAndUpdate(
    { key: `invoice:${fy}` },
    { $inc: { sequence: 1 }, $setOnInsert: { key: `invoice:${fy}` } },
    { new: true, upsert: true, session }
  );
  return formatInvoiceNumber(fy, counter.sequence);
}

async function getVerifiedPayment(orderId) {
  return Payment.findOne({ order: orderId, status: { $in: ["paid", "refunded"] } }).sort({ createdAt: -1 }).lean();
}

async function buildInvoiceData(order, user, payment, profile) {
  const pricing = calculateStoredOrderPricing(order);
  const seller = sellerFromProfile(profile);
  const customer = partyFromAddress(order.shippingAddress, user);
  const tax = splitTax({
    taxableValue: pricing.taxableAmount,
    taxRate: pricing.taxRate,
    sellerState: seller.state,
    customerState: customer.state,
    sellerGstin: seller.gstin,
  });

  const productIds = order.items.map(i => i.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: productIds } }).select("sku").lean();
  const skuById = new Map(products.map(p => [String(p._id), p.sku || ""]));

  const itemTaxableTotal = pricing.taxableAmount;
  const lineItems = order.items.map(item => {
    const lineBase = Number(item.price || 0) * Number(item.quantity || 0);
    const allocated = pricing.subtotal > 0
      ? roundMoney((lineBase / pricing.subtotal) * Math.max(0, itemTaxableTotal - pricing.shippingFee - pricing.deliveryFee))
      : 0;
    const lineTax = splitTax({
      taxableValue: allocated,
      taxRate: pricing.taxRate,
      sellerState: seller.state,
      customerState: customer.state,
      sellerGstin: seller.gstin,
    });
    return {
      product: item.product || null,
      sku: item.sku || skuById.get(String(item.product)) || "",
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.price || 0),
      taxableValue: allocated,
      taxRate: pricing.taxRate,
      cgstRate: lineTax.cgstRate,
      cgstAmount: lineTax.cgstAmount,
      sgstRate: lineTax.sgstRate,
      sgstAmount: lineTax.sgstAmount,
      igstRate: lineTax.igstRate,
      igstAmount: lineTax.igstAmount,
      total: roundMoney(allocated + lineTax.tax),
    };
  });

  return {
    currency: pricing.currency,
    taxPolicy: {
      priceIncludesTax: false,
      taxType: "GST",
      taxRate: pricing.taxRate,
      placeOfSupply: customer.state || "",
      supplyType: tax.supplyType,
    },
    seller,
    customer,
    items: lineItems,
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    taxableValue: pricing.taxableAmount,
    shippingFee: pricing.shippingFee,
    deliveryFee: pricing.deliveryFee,
    tax: pricing.tax,
    cgstAmount: tax.cgstAmount,
    sgstAmount: tax.sgstAmount,
    igstAmount: tax.igstAmount,
    total: pricing.total,
    payment: {
      status: payment?.status || "unpaid",
      method: payment?.method || "",
      razorpayOrderId: payment?.razorpayOrderId || "",
      razorpayPaymentId: payment?.razorpayPaymentId || "",
      paidAt: payment?.verifiedAt || payment?.createdAt || null,
      amount: Number(payment?.amount || 0),
    },
    shippingAddress: customer,
    sourceOrderCreatedAt: order.createdAt,
  };
}

async function getOrCreateInvoice(orderId, userId) {
  const existing = await Invoice.findOne({ order: orderId }).lean();
  if (existing) return existing;

  const order = await Order.findOne({ _id: orderId, user: userId }).lean();
  if (!order) throw ApiError.notFound("Order not found.");
  if (order.status !== "shipped") {
    throw ApiError.conflict("Invoice is available after the order is shipped.");
  }

  const user = await User.findById(userId).lean();
  const payment = await getVerifiedPayment(orderId);
  if (!payment || !["paid", "refunded"].includes(payment.status)) {
    throw ApiError.conflict("A verified payment is required before an invoice can be issued.");
  }
  const settings = await SiteSettings.findOne({ key: "global" }).lean();
  const data = await buildInvoiceData(order, user || {}, payment, settings?.storeProfile || {});

  const createPayload = (invoiceNumber) => ({
    order: order._id,
    invoiceNumber,
    invoiceDate: new Date(),
    ...data,
    generatedAt: new Date(),
  });

  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        const again = await Invoice.findOne({ order: orderId }).session(session).lean();
        if (again) { result = again; return; }
        const invoiceNumber = await nextInvoiceNumber(order.createdAt || new Date(), session);
        const [created] = await Invoice.create([createPayload(invoiceNumber)], { session });
        result = created.toObject();
      });
      return result;
    } catch (transactionError) {
      // MongoDB Atlas/replica sets use the transaction path above. For a
      // standalone development MongoDB, retain concurrency-safe atomic
      // counter allocation as a compatibility fallback.
      const unsupportedTransaction = /transaction|replica set|mongos|not supported/i.test(String(transactionError?.message || ""));
      if (!unsupportedTransaction) throw transactionError;
      const again = await Invoice.findOne({ order: orderId }).lean();
      if (again) return again;
      const invoiceNumber = await nextInvoiceNumber(order.createdAt || new Date(), null);
      try {
        const created = await Invoice.create(createPayload(invoiceNumber));
        return created.toObject();
      } catch (fallbackError) {
        if (fallbackError?.code === 11000) {
          const raced = await Invoice.findOne({ order: orderId }).lean();
          if (raced) return raced;
        }
        throw fallbackError;
      }
    }
  } catch (err) {
    if (err?.code === 11000) {
      const existingAfterRace = await Invoice.findOne({ order: orderId }).lean();
      if (existingAfterRace) return existingAfterRace;
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

module.exports = { getOrCreateInvoice, fiscalYear, formatInvoiceNumber };
