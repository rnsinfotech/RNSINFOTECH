/**
 * Non-destructive migration of existing payment rows onto the gateway-neutral
 * schema.
 *
 *   node scripts/migrateLegacyGatewayPayments.js --dry-run
 *   node scripts/migrateLegacyGatewayPayments.js
 *
 * WHAT THIS DOES
 * Rows written by the previous payment processor carry that provider's field
 * names (its own order/payment/refund identifiers). The active schema uses
 * neutral `gateway*` columns. This script copies each old value into its new
 * home, stamps `gateway: "legacy"` so the row stays honest about which
 * processor actually handled the money, and archives the original field names
 * verbatim under `legacyGatewayData`.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *   - It does not delete anything. Historical transactions are needed for
 *     accounting, invoices, chargebacks, customer support and statutory
 *     record-keeping, and a payments table is close to the last place where
 *     destroying history to tidy up a schema is defensible.
 *   - It does not relabel old rows as Cashfree payments. They were not, and a
 *     reconciliation against a Cashfree settlement report would fail on them.
 *     `gateway: "legacy"` is what makes them skippable rather than mysterious.
 *   - It does not touch rows already on the active gateway, so it is safe to
 *     re-run. The $exists filter makes each pass idempotent.
 *
 * AFTER THIS RUNS
 * The application refuses to reconcile or refund a legacy row through
 * Cashfree (see refund.service.js and the reconcile controllers) — those have
 * to be handled in the old provider's own dashboard, which is the truthful
 * answer rather than a silent failure.
 *
 * NOTE ON PROVIDER NAMES
 * This file mentions the previous provider's field names because it is the
 * one place that must: it is the documented historical migration path
 * referenced by the migration report. No runtime code path reads them.
 */
const mongoose = require("mongoose");

require("../src/config/env");
const { env } = require("../src/config/env");

const DRY_RUN = process.argv.includes("--dry-run");

// Old field name -> new neutral field name.
const FIELD_MAP = {
  razorpayOrderId: "gatewayOrderId",
  razorpayPaymentId: "gatewayPaymentId",
  razorpayStatus: "gatewayStatus",
  razorpayRefundId: "gatewayRefundId",
};
// Archived for audit but intentionally NOT promoted to a first-class column:
// the signature was only ever an artefact of the old provider's client-side
// verification handshake, and re-deriving it is impossible without that
// provider's key secret. It is kept purely so an old record can be explained.
const ARCHIVE_ONLY = ["razorpaySignature"];

async function main() {
  await mongoose.connect(env.mongoUri);
  const payments = mongoose.connection.collection("payments");

  // Anything still carrying the old order-id column has not been migrated.
  const filter = { razorpayOrderId: { $exists: true } };
  const total = await payments.countDocuments(filter);
  console.log(`${total} legacy payment row(s) to migrate.${DRY_RUN ? " (dry run — nothing will be written)" : ""}`);
  if (total === 0) {
    await mongoose.disconnect();
    return;
  }

  let migrated = 0;
  let skipped = 0;
  const cursor = payments.find(filter);

  while (await cursor.hasNext()) {
    const doc = await cursor.next();

    const set = { gateway: "legacy" };
    const archive = {};
    for (const [oldField, newField] of Object.entries(FIELD_MAP)) {
      if (doc[oldField] !== undefined && doc[oldField] !== null) {
        archive[oldField] = doc[oldField];
        // Never clobber a value that is already present on the neutral column.
        if (doc[newField] === undefined || doc[newField] === null) set[newField] = doc[oldField];
      }
    }
    for (const field of ARCHIVE_ONLY) {
      if (doc[field] !== undefined && doc[field] !== null) archive[field] = doc[field];
    }
    set.legacyGatewayData = { provider: "razorpay", migratedAt: new Date(), fields: archive };

    // gatewayOrderId is unique and required — a legacy row without one cannot
    // be represented on the new schema, so it is left untouched and reported
    // rather than silently mangled.
    if (!set.gatewayOrderId && !doc.gatewayOrderId) {
      console.warn(`  SKIP ${doc._id}: no order identifier to migrate.`);
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  WOULD MIGRATE ${doc._id} -> gatewayOrderId=${set.gatewayOrderId || doc.gatewayOrderId}`);
      migrated += 1;
      continue;
    }

    await payments.updateOne(
      { _id: doc._id },
      {
        $set: set,
        // The old columns are removed from the active document only after
        // their values are safely archived in the same atomic update.
        $unset: { ...Object.fromEntries(Object.keys(FIELD_MAP).map((f) => [f, ""])), razorpaySignature: "" },
      }
    );
    migrated += 1;
  }

  console.log(`Done. Migrated ${migrated}, skipped ${skipped}.`);
  if (!DRY_RUN && skipped > 0) {
    console.log("Skipped rows were left exactly as they were and need a manual look.");
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
