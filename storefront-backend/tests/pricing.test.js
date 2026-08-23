const { calculatePricing, normalizeCommerce } = require("../src/services/pricing.service");

describe("central pricing engine", () => {
  const commerce = {
    freeShippingThreshold: 5000,
    flatShippingFee: 199,
    taxRate: 18,
    standardDeliveryFee: 149,
  };

  it("calculates subtotal, coupon, shipping, delivery fee, tax and final total deterministically", () => {
    const result = calculatePricing({
      items: [
        { price: 1000, quantity: 2 },
        { price: 500, quantity: 1 },
      ],
      coupon: { type: "percent", value: 10 },
      commerce,
    });

    expect(result).toMatchObject({
      subtotal: 2500,
      discount: 250,
      shippingFee: 199,
      deliveryFee: 149,
      taxableAmount: 2598,
      tax: 467.64,
      total: 3065.64,
    });
  });

  it("does not charge flat shipping once the pre-discount subtotal reaches the threshold", () => {
    const result = calculatePricing({
      items: [{ price: 5000, quantity: 1 }],
      coupon: null,
      commerce: { ...commerce, standardDeliveryFee: 0, taxRate: 0 },
    });

    expect(result.shippingFee).toBe(0);
    expect(result.total).toBe(5000);
  });

  it("normalizes invalid commerce settings back to safe defaults", () => {
    expect(normalizeCommerce({ taxRate: -5, flatShippingFee: "bad" })).toMatchObject({
      taxRate: 0,
      flatShippingFee: 199,
    });
  });
});
