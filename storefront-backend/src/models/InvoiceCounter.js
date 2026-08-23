const mongoose = require("mongoose");

const invoiceCounterSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    sequence: { type: Number, required: true, min: 0, default: 0 },
  },
  { collection: "invoice_counters", timestamps: true }
);

module.exports = mongoose.model("InvoiceCounter", invoiceCounterSchema);
