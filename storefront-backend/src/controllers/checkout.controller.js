const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { findValidCoupon } = require("../services/coupon.service");
const { calculatePricing, getCommerceSettings } = require("../services/pricing.service");

function buildServerPricedItems(requestedItems, products) {
  const productById = new Map(products.map((product) => [String(product._id), product]));
  return requestedItems.map((requested) => {
    const product = productById.get(requested.product);
    if (!product) throw ApiError.badRequest(`Product ${requested.product} is unavailable.`);
    if (product.stock < requested.quantity) {
      throw ApiError.conflict(`"${product.name}" only has ${product.stock} left in stock.`);
    }
    return {
      product: product._id,
      name: product.name,
      image: (product.images && product.images[0] && product.images[0].url) || null,
      price: product.price,
      quantity: requested.quantity,
    };
  });
}

// POST /api/checkout/quote — authenticated, read-only quote. Product prices,
// stock and coupon validity are all read server-side. No client total is
// accepted or echoed as authoritative.
const getQuote = asyncHandler(async (req, res) => {
  const { items: requestedItems, couponCode } = req.body;
  const productIds = requestedItems.map((item) => item.product);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const items = buildServerPricedItems(requestedItems, products);

  let coupon = null;
  if (couponCode) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    coupon = await findValidCoupon(couponCode, subtotal, req.auth.userId);
  }

  const commerce = await getCommerceSettings();
  const pricing = calculatePricing({ items, coupon, commerce });

  res.json({
    quote: {
      ...pricing,
      couponCode: coupon ? coupon.code : null,
      items: items.map(({ product, name, image, price, quantity }) => ({
        product, name, image, price, quantity,
      })),
    },
  });
});

module.exports = { getQuote };
