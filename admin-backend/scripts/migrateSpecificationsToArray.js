// One-time migration: `specifications` used to be a label/value Map
// (e.g. { "Active Area": "10 x 6 in" }); it is now a plain array of
// description strings (e.g. ["10 x 6 in"]) — same shape as `highlights`.
//
// admin-backend and storefront-backend point at the same MongoDB
// database and the same `products` collection, so running this once is
// enough for both backends — there's no separate storefront-backend copy
// to run.
//
// This script is idempotent: documents whose `specifications` is already
// an array are left untouched, so it's safe to re-run.
//
// Usage (from admin-backend/):
//   node scripts/migrateSpecificationsToArray.js
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required.");
  await mongoose.connect(uri);

  const db = mongoose.connection.db;
  const products = db.collection("products");

  const cursor = products.find({});
  let scanned = 0;
  let migrated = 0;
  let alreadyArray = 0;
  let skippedEmpty = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;

    const specs = doc.specifications;

    if (Array.isArray(specs)) {
      alreadyArray += 1;
      continue;
    }

    if (!specs || typeof specs !== "object") {
      // No specifications field, or an unexpected type — normalize to [].
      await products.updateOne({ _id: doc._id }, { $set: { specifications: [] } });
      skippedEmpty += 1;
      continue;
    }

    // Old shape: a Map/plain object of { label: value }. Keep only the
    // values (labels are intentionally dropped — see IMPLEMENTATION_PLAN.md),
    // trimmed, de-duplicated, and with blanks filtered out.
    const values = Object.values(specs)
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
    const deduped = [...new Set(values)];

    await products.updateOne({ _id: doc._id }, { $set: { specifications: deduped } });
    migrated += 1;
  }

  console.log("Specifications migration complete.");
  console.log(`  Scanned:        ${scanned}`);
  console.log(`  Migrated:       ${migrated} (label/value -> array of values)`);
  console.log(`  Already array:  ${alreadyArray} (left untouched)`);
  console.log(`  Normalized to []: ${skippedEmpty} (missing/invalid field)`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
