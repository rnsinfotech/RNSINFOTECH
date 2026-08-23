require("dotenv").config();
const mongoose = require("mongoose");
const Brand = require("../src/models/Brand");
const FlashMessage = require("../src/models/FlashMessage");
const SiteSettings = require("../src/models/SiteSettings");

const brands = [
  { name: "Wacom", slug: "wacom", logo: "/assets/brands/wacom.png", isActive: true },
  { name: "Huion", slug: "huion", logo: "/assets/brands/huion.png", isActive: true },
  { name: "XP-Pen", slug: "xp-pen", logo: "/assets/brands/xppen.png", isActive: true },
  { name: "Xencelabs", slug: "xencelabs", logo: "/assets/brands/xencelabs.png", isActive: true },
];

const flashMessages = [
  { type: "login", message: "Sign in to track orders, save addresses, and check out faster.", ctaLabel: "Log in", ctaHref: "/login", active: true, durationSeconds: 5, sortOrder: 0 },
  { type: "sale", message: "Festive offers live — authorized dealer pricing on pen displays this week.", ctaLabel: "See offers", ctaHref: "/products", active: true, durationSeconds: 5, sortOrder: 1 },
  { type: "newsletter", message: "Join our newsletter for early access to new arrivals and drops.", ctaLabel: "Subscribe", ctaHref: "/help#newsletter", active: true, durationSeconds: 5, sortOrder: 2 },
];

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required.");
  await mongoose.connect(uri);

  for (const brand of brands) {
    await Brand.updateOne({ slug: brand.slug }, { $setOnInsert: brand }, { upsert: true });
  }
  const flashCount = await FlashMessage.countDocuments();
  if (flashCount === 0) await FlashMessage.insertMany(flashMessages);
  await SiteSettings.findOneAndUpdate(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        storeProfile: SiteSettings.DEFAULT_STORE_PROFILE,
        commerce: SiteSettings.DEFAULT_COMMERCE,
        homepage: SiteSettings.DEFAULT_HOMEPAGE,
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );

  console.log("Business content seed completed.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
