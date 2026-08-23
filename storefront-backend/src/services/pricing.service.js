const SiteSettings = require("../models/SiteSettings");
const { computeDiscount } = require("./coupon.service");

// Delivery is no longer a customer choice — every order ships the same
// way, so there is a single delivery fee rather than a per-method table.
// The settings field is still named `standardDeliveryFee` (not renamed
// to something like `deliveryFee`) purely so an already-saved
// SiteSettings document with a real, admin-configured value doesn't
// silently fall back to the default the moment this deploys.
const DEFAULT_COMMERCE = {
  freeShippingThreshold: 5000,
  flatShippingFee: 199,
  lowStockThreshold: 8,
  taxRate: 0,
  standardDeliveryFee: 0,
};

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function normalizeCommerce(raw = {}) {
  const c = { ...DEFAULT_COMMERCE, ...(raw || {}) };
  const number = (value, fallback, min = 0) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  return {
    freeShippingThreshold: number(c.freeShippingThreshold, DEFAULT_COMMERCE.freeShippingThreshold),
    flatShippingFee: number(c.flatShippingFee, DEFAULT_COMMERCE.flatShippingFee),
    taxRate: number(c.taxRate, DEFAULT_COMMERCE.taxRate),
    standardDeliveryFee: number(c.standardDeliveryFee, DEFAULT_COMMERCE.standardDeliveryFee),
  };
}

async function getCommerceSettings() {
  const settings = await SiteSettings.findOne({ key: "global" }).lean();
  return normalizeCommerce(settings?.commerce);
}

/**
 * Single source of truth for all checkout/order/payment monetary calculations.
 *
 * `items` must already contain server-trusted prices. Client-submitted prices
 * must never be passed here until the caller has replaced them with Product
 * document values.
 */
function calculatePricing({ items = [], coupon = null, commerce }) {
  const settings = normalizeCommerce(commerce);
  const subtotal = roundMoney(items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0));
  const discount = coupon ? roundMoney(Math.min(computeDiscount(coupon, subtotal), subtotal)) : 0;
  const discountedSubtotal = roundMoney(Math.max(0, subtotal - discount));

  // Preserve the existing business rule: shipping threshold is based on
  // product subtotal before coupon discount.
  const shippingFee =
    subtotal > 0 && subtotal < settings.freeShippingThreshold
      ? roundMoney(settings.flatShippingFee)
      : 0;

  const deliveryFee = roundMoney(settings.standardDeliveryFee);
  const taxableAmount = roundMoney(discountedSubtotal + shippingFee + deliveryFee);
  const tax = roundMoney((taxableAmount * settings.taxRate) / 100);
  const total = roundMoney(taxableAmount + tax);

  return {
    currency: "INR",
    subtotal,
    discount,
    shippingFee,
    deliveryFee,
    tax,
    taxRate: settings.taxRate,
    taxPolicy: { priceIncludesTax: false, taxType: "GST" },
    taxableAmount,
    total,
    commerce: settings,
  };
}

function calculateStoredOrderPricing(order) {
  // Orders created before Phase 5 do not have a pricing snapshot and their
  // `itemsTotal` already represents the historical payable amount. Keep
  // those immutable totals payable through the same pricing service rather
  // than silently applying today's shipping/tax rules to an old order.
  if (!order.pricing) {
    return {
      currency: "INR",
      subtotal: roundMoney(order.subtotal || (Number(order.itemsTotal || 0) + Number(order.discount || 0))),
      discount: roundMoney(order.discount || 0),
      shippingFee: roundMoney(order.shippingFee || 0),
      deliveryFee: roundMoney(order.deliveryFee || 0),
      tax: roundMoney(order.tax || 0),
      taxRate: 0,
      taxPolicy: { priceIncludesTax: false, taxType: "GST" },
      taxableAmount: roundMoney(order.itemsTotal || 0),
      total: roundMoney(order.itemsTotal || 0),
      commerce: DEFAULT_COMMERCE,
      legacy: true,
    };
  }

  const pricing = order.pricing || {};
  const commerce = pricing.commerce || DEFAULT_COMMERCE;
  const coupon = order.couponSnapshot || null;
  return calculatePricing({
    items: order.items || [],
    coupon,
    commerce,
  });
}

function pricingMatchesOrder(order, calculated) {
  if (calculated.legacy) return roundMoney(order.itemsTotal) === calculated.total;
  return (
    roundMoney(order.itemsTotal) === calculated.total &&
    roundMoney(order.discount) === calculated.discount &&
    roundMoney(order.shippingFee) === calculated.shippingFee &&
    roundMoney(order.deliveryFee) === calculated.deliveryFee &&
    roundMoney(order.tax) === calculated.tax
  );
}

module.exports = {
  DEFAULT_COMMERCE,
  roundMoney,
  normalizeCommerce,
  getCommerceSettings,
  calculatePricing,
  calculateStoredOrderPricing,
  pricingMatchesOrder,
};
