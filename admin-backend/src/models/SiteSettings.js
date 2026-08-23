const mongoose = require("mongoose");

const DEFAULT_STORE_PROFILE = {
  name: "RNS INFOTECH",
  legalName: "RNS INFOTECH Pvt. Ltd.",
  email: "support@rnsinfotech.in",
  phone: "+91 98765 43210",
  whatsapp: "919876543210",
  hours: "Mon–Sat, 10:00 AM – 7:00 PM IST",
  address: "RNS INFOTECH, MG Road, Bengaluru, Karnataka 560001",
  gstin: "",
  state: "Karnataka",
  city: "Bengaluru",
  pincode: "560001",
  country: "India",
  line1: "",
  line2: "",
};

const DEFAULT_COMMERCE = {
  freeShippingThreshold: 5000,
  flatShippingFee: 199,
  lowStockThreshold: 8,
  taxRate: 0,
  standardDeliveryFee: 0,
};

const DEFAULT_HOMEPAGE = {
  hero: {
    title: "Pen tablets and pen displays for artists, designers, and creators.",
    subtitle: "RNS INFOTECH stocks pen displays, pen tablets, stylus pens, and accessories from leading creative-hardware brands — with genuine warranty support and fast dispatch.",
    primaryCta: { label: "Browse catalogue", href: "#products" },
    secondaryCta: { label: "Book a demo", href: "/demo" },
    stats: [
      { label: "Years in operation", value: "12" },
      { label: "Creators served", value: "18,000+" },
      { label: "Avg. dispatch time", value: "2–3 days" },
    ],
  },
  promo: {
    eyebrow: "Festive offer",
    title: "Upgrade to a pro pen display before the festive season ends.",
    body: "Bundle a pen display, stylus, and screen protector — priced as one line item, with EMI available.",
    cta: { label: "View pen display bundles", href: "#products" },
  },
  whyChooseUs: [
    { id: "wcu_truck", icon: "truck", title: "Fastest delivery", body: "Orders reach your doorstep within 2–3 working days across the region." },
    { id: "wcu_headset", icon: "headset", title: "Great customer support", body: "Professional technical assistance from a team that actually knows pen tablets and displays, not a generic call center." },
    { id: "wcu_layers", icon: "layers", title: "Wide compatibility", body: "Devices work across Windows, macOS, and select Android & Linux setups, tested against commonly used creative software." },
    { id: "wcu_shield", icon: "shield", title: "Authentic & genuine", body: "We are an authorized dealer — every unit sold is 100% genuine, with full manufacturer warranty honored." },
  ],
  solutions: [
    { id: "sol_pen", icon: "pen", title: "Digital Illustration & Concept Art", body: "Pressure-sensitive pen tablets and displays tuned for line work, inking, and painting." },
    { id: "sol_display", icon: "display", title: "Animation & VFX", body: "Larger pen displays and tilt-sensitive styluses for frame-by-frame and rigging work." },
    { id: "sol_tablet", icon: "tablet", title: "Photo & Video Editing", body: "Precise cursor control for retouching, color grading, and timeline editing." },
    { id: "sol_chip", icon: "chip", title: "Architecture & CAD", body: "Accurate pen input for drafting, annotation, and design review workflows." },
    { id: "sol_disc", icon: "disc", title: "Education & Online Teaching", body: "Affordable pen tablets for whiteboard-style teaching and remote classes." },
  ],
  testimonials: [
    { id: "test_1", quote: "The pen display arrived in two days and the calibration guide got me set up in Photoshop within minutes. Genuine warranty card included.", name: "Ananya Sharma", role: "Freelance Illustrator", rating: 5 },
    { id: "test_2", quote: "We equipped our entire animation team with pen tablets through RNS. Bulk pricing was straightforward and support has stayed responsive since.", name: "Karan Mehta", role: "Studio Lead, Framewright Animation", rating: 5 },
    { id: "test_3", quote: "Picked up a compact pen tablet for our design intern's onboarding kit. Setup was simple and the support team answered every question I had.", name: "Divya Iyer", role: "Branch Operations, Novon Finance", rating: 4 },
  ],
};

const siteSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: "global", index: true },
    storeProfile: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_STORE_PROFILE },
    commerce: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_COMMERCE },
    homepage: { type: mongoose.Schema.Types.Mixed, default: DEFAULT_HOMEPAGE },
    homepagePublished: { type: mongoose.Schema.Types.Mixed, default: null },
    homepagePublishedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: "site_settings",
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

siteSettingsSchema.statics.DEFAULT_STORE_PROFILE = DEFAULT_STORE_PROFILE;
siteSettingsSchema.statics.DEFAULT_COMMERCE = DEFAULT_COMMERCE;
siteSettingsSchema.statics.DEFAULT_HOMEPAGE = DEFAULT_HOMEPAGE;

module.exports = mongoose.model("SiteSettings", siteSettingsSchema);
