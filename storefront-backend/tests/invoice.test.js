const { fiscalYear, formatInvoiceNumber } = require("../src/services/invoice.service");
const { splitTax } = require("../src/services/tax.service");

describe("invoice and GST architecture", () => {
  test("uses Indian fiscal year Apr-Mar", () => {
    expect(fiscalYear(new Date("2026-04-01T00:00:00Z"))).toBe("2627");
    expect(fiscalYear(new Date("2026-03-31T00:00:00Z"))).toBe("2526");
  });

  test("formats a unique business invoice sequence", () => {
    expect(formatInvoiceNumber("2627", 1)).toBe("RNS/2627/000001");
    expect(formatInvoiceNumber("2627", 42)).toBe("RNS/2627/000042");
  });

  test("splits intra-state GST into CGST and SGST", () => {
    const tax = splitTax({
      taxableValue: 1000,
      taxRate: 18,
      sellerState: "Karnataka",
      customerState: "Karnataka",
    });
    expect(tax.tax).toBe(180);
    expect(tax.cgstRate).toBe(9);
    expect(tax.sgstRate).toBe(9);
    expect(tax.cgstAmount).toBe(90);
    expect(tax.sgstAmount).toBe(90);
    expect(tax.igstAmount).toBe(0);
    expect(tax.supplyType).toBe("intra-state");
  });

  test("uses IGST for inter-state supply", () => {
    const tax = splitTax({
      taxableValue: 1000,
      taxRate: 18,
      sellerState: "Karnataka",
      customerState: "Uttar Pradesh",
    });
    expect(tax.tax).toBe(180);
    expect(tax.igstRate).toBe(18);
    expect(tax.igstAmount).toBe(180);
    expect(tax.cgstAmount).toBe(0);
    expect(tax.sgstAmount).toBe(0);
    expect(tax.supplyType).toBe("inter-state");
  });

  test("does not guess a place of supply when state is missing", () => {
    const tax = splitTax({
      taxableValue: 1000,
      taxRate: 18,
      sellerState: "",
      customerState: "",
    });
    expect(tax.tax).toBe(180);
    expect(tax.supplyType).toBe("unknown");
  });
});
