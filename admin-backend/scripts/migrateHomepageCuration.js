require("dotenv").config();
const mongoose = require("mongoose");
const { env } = require("../src/config/env");
const Product = require("../src/models/Product");

// Phase H1 migration. Two jobs:
//
// 1. Backfill isBestSeller from the legacy single-tag workflow: the old
//    admin form stored "best-seller" as a tags[] entry with no matching
//    boolean (isBestSeller didn't exist). Any product carrying that tag
//    is now marked isBestSeller: true so it isn't silently dropped from
//    curation once the new toggle-based UI ships in Phase 4.
// 2. Assign homepageFeaturedOrder / homepageBestSellerOrder to every
//    product already flagged isFeatured / isBestSeller (old or newly
//    backfilled) so the curated rails have a stable, non-null sort order
//    from day one — ordered by createdAt asc (oldest curated pick shown
//    first), matching how they'd have naturally been added over time.
//    Products with an order already set (re-run safety) are left alone.
async function main() {
  await mongoose.connect(env.mongoUri);

  const legacyBestSellerResult = await Product.updateMany(
    { tags: "best-seller", isBestSeller: { $ne: true } },
    { $set: { isBestSeller: true } }
  );

  const featuredToOrder = await Product.find({ isFeatured: true, homepageFeaturedOrder: null })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();
  let order = 0;
  for (const { _id } of featuredToOrder) {
    await Product.updateOne({ _id }, { $set: { homepageFeaturedOrder: order } });
    order += 1;
  }

  const bestSellersToOrder = await Product.find({ isBestSeller: true, homepageBestSellerOrder: null })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();
  order = 0;
  for (const { _id } of bestSellersToOrder) {
    await Product.updateOne({ _id }, { $set: { homepageBestSellerOrder: order } });
    order += 1;
  }

  console.log("Phase H1 homepage curation migration complete:", {
    legacyBestSellerTagsBackfilled: legacyBestSellerResult.modifiedCount,
    featuredOrdersAssigned: featuredToOrder.length,
    bestSellerOrdersAssigned: bestSellersToOrder.length,
  });

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
