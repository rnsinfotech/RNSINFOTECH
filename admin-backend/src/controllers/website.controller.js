const mongoose = require("mongoose");
const SiteSettings = require("../models/SiteSettings");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const LIST_SECTIONS = ["whyChooseUs", "solutions", "testimonials"];
const SINGLETON_SECTIONS = ["hero", "promo"];

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

function cleanString(value, field, max = 5000, required = false) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw ApiError.badRequest(`${field} must be a string.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw ApiError.badRequest(`${field} is required.`);
  if (trimmed.length > max) throw ApiError.badRequest(`${field} is too long.`);
  return trimmed;
}

function validateSingleton(section, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw ApiError.badRequest("Website section must be an object.");
  if (section === "hero") {
    cleanString(data.title, "title", 300, true);
    cleanString(data.subtitle, "subtitle", 2000, true);
    if (data.primaryCta && typeof data.primaryCta !== "object") throw ApiError.badRequest("primaryCta must be an object.");
    if (data.secondaryCta && typeof data.secondaryCta !== "object") throw ApiError.badRequest("secondaryCta must be an object.");
    if (data.stats !== undefined && (!Array.isArray(data.stats) || data.stats.length > 20)) throw ApiError.badRequest("stats must be an array of at most 20 items.");
  }
  if (section === "promo") {
    cleanString(data.eyebrow, "eyebrow", 200);
    cleanString(data.title, "title", 300, true);
    cleanString(data.body, "body", 2000, true);
    if (data.cta && typeof data.cta !== "object") throw ApiError.badRequest("cta must be an object.");
  }
}

function validateListItem(section, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw ApiError.badRequest("Website item must be an object.");
  if (section === "whyChooseUs" || section === "solutions") {
    cleanString(data.icon, "icon", 50, true);
    cleanString(data.title, "title", 200, true);
    cleanString(data.body, "body", 2000, true);
  }
  if (section === "testimonials") {
    cleanString(data.quote, "quote", 2000, true);
    cleanString(data.name, "name", 120, true);
    cleanString(data.role, "role", 200);
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw ApiError.badRequest("rating must be an integer between 1 and 5.");
  }
}

const get = asyncHandler(async (req, res) => {
  const settings = await getSettingsDocument();
  if (!settings.homepagePublished) {
    settings.homepagePublished = settings.homepage || SiteSettings.DEFAULT_HOMEPAGE;
    settings.homepagePublishedAt = settings.homepagePublishedAt || new Date();
    await settings.save();
  }
  res.json({ website: settings.homepage, publishedWebsite: settings.homepagePublished || settings.homepage, homepagePublishedAt: settings.homepagePublishedAt || null });
});

const updateSection = asyncHandler(async (req, res) => {
  if (!SINGLETON_SECTIONS.includes(req.params.section)) throw ApiError.notFound("Website section not found.");
  validateSingleton(req.params.section, req.body);
  const settings = await getSettingsDocument();
  settings.homepage = { ...(settings.homepage || SiteSettings.DEFAULT_HOMEPAGE), [req.params.section]: req.body };
  await settings.save();
  res.json({ website: settings.homepage, publishedWebsite: settings.homepagePublished || settings.homepage, section: settings.homepage[req.params.section], homepagePublishedAt: settings.homepagePublishedAt || null });
});

const createItem = asyncHandler(async (req, res) => {
  const { section } = req.params;
  if (!LIST_SECTIONS.includes(section)) throw ApiError.notFound("Website collection not found.");
  validateListItem(section, req.body);
  const settings = await getSettingsDocument();
  const item = { ...req.body, id: req.body.id || new mongoose.Types.ObjectId().toString() };
  settings.homepage = { ...(settings.homepage || SiteSettings.DEFAULT_HOMEPAGE), [section]: [...((settings.homepage || SiteSettings.DEFAULT_HOMEPAGE)?.[section] || []), item] };
  await settings.save();
  res.status(201).json({ item });
});

const updateItem = asyncHandler(async (req, res) => {
  const { section, id } = req.params;
  if (!LIST_SECTIONS.includes(section)) throw ApiError.notFound("Website collection not found.");
  validateListItem(section, req.body);
  const settings = await getSettingsDocument();
  const draft = settings.homepage || SiteSettings.DEFAULT_HOMEPAGE;
  const items = Array.isArray(draft?.[section]) ? draft[section] : [];
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) throw ApiError.notFound("Website item not found.");
  const updated = { ...items[index], ...req.body, id: items[index].id };
  items[index] = updated;
  settings.homepage = { ...draft, [section]: items };
  await settings.save();
  res.json({ item: updated });
});

const deleteItem = asyncHandler(async (req, res) => {
  const { section, id } = req.params;
  if (!LIST_SECTIONS.includes(section)) throw ApiError.notFound("Website collection not found.");
  const settings = await getSettingsDocument();
  const draft = settings.homepage || SiteSettings.DEFAULT_HOMEPAGE;
  const items = Array.isArray(draft?.[section]) ? draft[section] : [];
  if (!items.some((item) => item.id === id)) throw ApiError.notFound("Website item not found.");
  settings.homepage = { ...draft, [section]: items.filter((item) => item.id !== id) };
  await settings.save();
  res.status(204).send();
});

const publish = asyncHandler(async (req, res) => {
  const settings = await getSettingsDocument();
  const draft = settings.homepage || SiteSettings.DEFAULT_HOMEPAGE;
  settings.homepagePublished = draft;
  settings.homepagePublishedAt = new Date();
  await settings.save();
  res.json({ website: settings.homepage, homepagePublishedAt: settings.homepagePublishedAt });
});

const preview = asyncHandler(async (req, res) => {
  const settings = await getSettingsDocument();
  res.json({ website: settings.homepage || SiteSettings.DEFAULT_HOMEPAGE, preview: true });
});

module.exports = { get, updateSection, createItem, updateItem, deleteItem, publish, preview };
