const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, default: null },
  sku: { type: String, default: "" },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  taxableValue: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, required: true, min: 0 },
  cgstRate: { type: Number, default: 0, min: 0 },
  cgstAmount: { type: Number, default: 0, min: 0 },
  sgstRate: { type: Number, default: 0, min: 0 },
  sgstAmount: { type: Number, default: 0, min: 0 },
  igstRate: { type: Number, default: 0, min: 0 },
  igstAmount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
}, { _id: false });

const partySchema = new mongoose.Schema({
  name: { type: String, default: "" },
  legalName: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
  line1: { type: String, default: "" },
  line2: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  pincode: { type: String, default: "" },
  country: { type: String, default: "India" },
  gstin: { type: String, default: "" },
  stateCode: { type: String, default: "" },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  invoiceDate: { type: Date, required: true },
  currency: { type: String, default: "INR", required: true },
  taxPolicy: {
    priceIncludesTax: { type: Boolean, required: true, default: false },
    taxType: { type: String, enum: ["GST"], default: "GST" },
    taxRate: { type: Number, required: true, min: 0 },
    placeOfSupply: { type: String, default: "" },
    supplyType: { type: String, enum: ["intra-state", "inter-state", "unknown"], default: "unknown" },
  },
  seller: { type: partySchema, required: true },
  customer: { type: partySchema, required: true },
  items: { type: [invoiceItemSchema], required: true },
  subtotal: { type: Number, required: true, min: 0 },
  discount: { type: Number, required: true, min: 0 },
  taxableValue: { type: Number, required: true, min: 0 },
  shippingFee: { type: Number, required: true, min: 0 },
  deliveryFee: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  cgstAmount: { type: Number, default: 0, min: 0 },
  sgstAmount: { type: Number, default: 0, min: 0 },
  igstAmount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  payment: {
    status: { type: String, default: "unpaid" },
    method: { type: String, default: "" },
    // Gateway-neutral so an invoice never has to be reissued because the
    // processor changed. `gateway` names which one handled it, which is what
    // an accountant reconciling a settlement report actually needs.
    gateway: { type: String, default: "" },
    gatewayOrderId: { type: String, default: "" },
    gatewayPaymentId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    amount: { type: Number, default: 0, min: 0 },
  },
  shippingAddress: { type: partySchema, required: true },
  sourceOrderCreatedAt: { type: Date, required: true },
  generatedAt: { type: Date, required: true },
}, { timestamps: true, collection: "invoices", strict: true });


module.exports = mongoose.model("Invoice", invoiceSchema);
