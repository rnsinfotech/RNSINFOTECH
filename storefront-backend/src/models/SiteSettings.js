const mongoose = require("mongoose");

const DEFAULT_COMMERCE = {
  freeShippingThreshold: 5000,
  flatShippingFee: 199,
  lowStockThreshold: 8,
  taxRate: 0,
  standardDeliveryFee: 0,
};

const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "global", index: true },
    storeProfile: { type: mongoose.Schema.Types.Mixed, default: {} },
    commerce: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_COMMERCE },
    homepage: { type: mongoose.Schema.Types.Mixed, default: {} },
    homepagePublished: { type: mongoose.Schema.Types.Mixed, default: null },
    homepagePublishedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "site_settings", strict: false, toJSON: { transform(doc, ret) { delete ret.__v; return ret; } } }
);
siteSettingsSchema.statics.DEFAULT_COMMERCE = DEFAULT_COMMERCE;

module.exports = mongoose.model("StorefrontSiteSettings", siteSettingsSchema);
