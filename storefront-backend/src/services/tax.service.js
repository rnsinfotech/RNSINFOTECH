const { roundMoney } = require("./pricing.service");

function normalizeState(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stateCodeFromGSTIN(gstin) {
  const match = String(gstin || "").trim().match(/^(\d{2})[A-Z0-9]{13}$/i);
  return match ? match[1] : "";
}

function splitTax({ taxableValue, taxRate, sellerState, customerState, sellerGstin }) {
  const taxable = roundMoney(taxableValue);
  const rate = Math.max(0, Number(taxRate || 0));
  const tax = roundMoney((taxable * rate) / 100);
  const intraState = Boolean(sellerState && customerState && normalizeState(sellerState) === normalizeState(customerState));

  if (intraState) {
    const halfRate = rate / 2;
    const halfAmount = roundMoney(tax / 2);
    return {
      tax,
      cgstRate: halfRate,
      cgstAmount: halfAmount,
      sgstRate: halfRate,
      sgstAmount: roundMoney(tax - halfAmount),
      igstRate: 0,
      igstAmount: 0,
      supplyType: "intra-state",
      placeOfSupply: customerState,
      sellerStateCode: stateCodeFromGSTIN(sellerGstin),
    };
  }

  if (sellerState && customerState) {
    return {
      tax,
      cgstRate: 0, cgstAmount: 0,
      sgstRate: 0, sgstAmount: 0,
      igstRate: rate, igstAmount: tax,
      supplyType: "inter-state",
      placeOfSupply: customerState,
      sellerStateCode: stateCodeFromGSTIN(sellerGstin),
    };
  }

  return {
    tax,
    cgstRate: 0, cgstAmount: 0,
    sgstRate: 0, sgstAmount: 0,
    igstRate: rate, igstAmount: tax,
    supplyType: "unknown",
    placeOfSupply: customerState || "",
    sellerStateCode: stateCodeFromGSTIN(sellerGstin),
  };
}

module.exports = { splitTax, stateCodeFromGSTIN };
