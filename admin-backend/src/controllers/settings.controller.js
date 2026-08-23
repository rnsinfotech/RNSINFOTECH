const SiteSettings = require("../models/SiteSettings");
const asyncHandler = require("../utils/asyncHandler");

async function getSettingsDocument() {
  return SiteSettings.findOneAndUpdate(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        storeProfile: SiteSettings.DEFAULT_STORE_PROFILE,
        commerce: SiteSettings.DEFAULT_COMMERCE,
        homepage: SiteSettings.DEFAULT_HOMEPAGE,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

const getStoreProfile = asyncHandler(async (req, res) => {
  const settings = await getSettingsDocument();
  res.set("Cache-Control", "no-store");
  res.json({ storeProfile: settings.storeProfile });
});

const updateStoreProfile = asyncHandler(async (req, res) => {
  const settings = await getSettingsDocument();
  settings.storeProfile = { ...settings.storeProfile, ...(req.body || {}) };
  await settings.save();
  res.set("Cache-Control", "no-store");
  res.json({ storeProfile: settings.storeProfile });
});

const getCommerce = asyncHandler(async (req, res) => {
  const settings = await getSettingsDocument();
  res.json({ commerce: settings.commerce });
});

const updateCommerce = asyncHandler(async (req, res) => {
  const settings = await getSettingsDocument();
  const body = req.body || {};
  const current = settings.commerce || {};
  const numericNonNegative = (field) => {
    if (body[field] === undefined) return current[field];
    const value = Number(body[field]);
    return Number.isFinite(value) && value >= 0 ? value : current[field];
  };

  settings.commerce = {
    ...current,
    freeShippingThreshold: numericNonNegative("freeShippingThreshold"),
    flatShippingFee: numericNonNegative("flatShippingFee"),
    lowStockThreshold: numericNonNegative("lowStockThreshold"),
    taxRate: body.taxRate === undefined
      ? current.taxRate
      : Math.min(100, numericNonNegative("taxRate")),
    standardDeliveryFee: numericNonNegative("standardDeliveryFee"),
  };

  await settings.save();
  res.json({ commerce: settings.commerce });
});

const getAccount = asyncHandler(async (req, res) => {
  res.json({ account: { name: req.admin.name, email: req.admin.email, role: req.admin.role } });
});

const updateAccount = asyncHandler(async (req, res) => {
  const { name, email } = req.body || {};
  if (typeof name === "string" && name.trim()) req.admin.name = name.trim();
  if (typeof email === "string" && email.trim()) req.admin.email = email.trim().toLowerCase();
  await req.admin.save();
  res.json({ account: { name: req.admin.name, email: req.admin.email, role: req.admin.role } });
});

module.exports = { getStoreProfile, updateStoreProfile, getCommerce, updateCommerce, getAccount, updateAccount };
