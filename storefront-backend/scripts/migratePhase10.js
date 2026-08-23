const mongoose = require("mongoose");
const { env } = require("../src/config/env");
const SiteSettings = require("../src/models/SiteSettings");

async function main() {
  await mongoose.connect(env.mongoUri);
  const settings = await SiteSettings.findOneAndUpdate(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        storeProfile: SiteSettings.DEFAULT_STORE_PROFILE,
        commerce: SiteSettings.DEFAULT_COMMERCE,
      },
    },
    { upsert: true, new: true }
  );

  const profile = settings.storeProfile || {};
  const fallback = SiteSettings.DEFAULT_STORE_PROFILE;
  let changed = false;
  for (const field of ["state", "city", "pincode", "country", "line1", "line2"]) {
    if (!profile[field]) {
      profile[field] = fallback[field] || "";
      changed = true;
    }
  }
  if (changed) {
    settings.storeProfile = profile;
    await settings.save();
  }

  console.log("Phase 10 store profile tax fields initialized:", {
    state: settings.storeProfile?.state,
    city: settings.storeProfile?.city,
    pincode: settings.storeProfile?.pincode,
    gstinConfigured: Boolean(settings.storeProfile?.gstin),
  });
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
