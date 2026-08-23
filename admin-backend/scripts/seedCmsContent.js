require("dotenv").config();
const mongoose = require("mongoose");
const Faq = require("../src/models/Faq");
const BlogPost = require("../src/models/BlogPost");
const Policy = require("../src/models/Policy");

const faqs = [
  ["Are these genuine, authorized products?", "Yes — RNS INFOTECH is an authorized dealer, and every pen tablet, pen display, and stylus we sell is 100% genuine with full manufacturer warranty."],
  ["Which operating systems and software are these compatible with?", "Most pen tablets and displays work across Windows, macOS, and select Android & Linux setups, and are tested against commonly used creative software such as Photoshop, Clip Studio Paint, and Blender."],
  ["How long does delivery take?", "In-stock orders are dispatched within 2–3 working days, with tracking shared on shipment."],
  ["Do you offer bulk pricing for studios or institutions?", "Yes, bulk quotes are available for animation studios, design schools, and offices ordering multiple pen tablets or displays."],
  ["What's covered under warranty, and how do I claim it?", "Manufacturer warranty applies as standard (typically 1–2 years depending on model), and we handle the claim process on your behalf rather than redirecting you to the brand directly."],
  ["Can I try a pen display before buying?", "Yes, select models can be experienced at our demo center — book a slot and our team will walk you through calibration and pen feel."],
].map(([question, answer], sortOrder) => ({ question, answer, sortOrder, isPublished: true }));

const blogPosts = [
  {
    slug: "pen-tablet-vs-pen-display", title: "Pen tablet vs. pen display: which one actually fits your workflow?", excerpt: "Screen or no screen — the two most common creative-hardware formats solve different problems. Here's how to tell which one is right for you.", image: "/assets/categories/pendisplays.jpg", categoryId: "pen-displays", category: "Pen Displays", author: "RNS Editorial", date: "2026-07-02", publicationDate: new Date("2026-07-02T00:00:00.000Z"), readTime: "5 min read", status: "published", content: ["The pen-tablet-vs-pen-display question comes up in almost every first conversation we have with a new customer, and the honest answer is: it depends less on budget than people expect, and more on where you're looking while you draw.", "A pen tablet — the kind without a built-in screen — has you looking at your monitor while your hand moves on a separate surface. It takes a few hours to get used to, but once the hand-eye mapping clicks, most people find it fast, light on the desk, and easy to travel with.", "A pen display puts the drawing surface and the screen in the same place, so you're drawing directly on the image. That direct feedback is why so many people prefer it once they've tried both.", "If you're new to digital art, we usually suggest starting on a pen tablet. If you already know digital art is part of your daily work, a pen display tends to be worth the jump."]
  },
  {
    slug: "stylus-nib-care-guide", title: "Getting more life out of your stylus nibs", excerpt: "Nibs are a wear part, not a defect — a bit of care and knowing when to swap keeps your pen feeling consistent for longer.", image: "/assets/categories/stylus.jpg", categoryId: "stylus", category: "Stylus & Pens", author: "RNS Editorial", date: "2026-06-18", publicationDate: new Date("2026-06-18T00:00:00.000Z"), readTime: "3 min read", status: "published", content: ["Every stylus nib wears down eventually — it's the part of the pen actually touching the surface thousands of times a session, so some wear is normal.", "The clearest sign it's time to swap is a change in how the pen sounds and feels against the surface.", "Keep the drawing surface free of dust and grit, avoid pressing much harder than the pressure curve needs, and store the pen somewhere safe."]
  },
  {
    slug: "understanding-pressure-sensitivity", title: "What pressure sensitivity levels actually mean", excerpt: "8,192 levels sounds impressive on a spec sheet — here's what the number actually changes about how a line feels.", image: "/assets/categories/pentablets.jpg", categoryId: "pen-tablets", category: "Pen Tablets", author: "RNS Editorial", date: "2026-05-30", publicationDate: new Date("2026-05-30T00:00:00.000Z"), readTime: "4 min read", status: "published", content: ["Pressure sensitivity is how finely a tablet or display can distinguish between a light touch and a hard press.", "Most current hardware sits at 8,192 levels, which is enough headroom that very few artists will feel a ceiling in practice.", "What matters more day to day is the pressure curve — how quickly the software ramps from light to heavy pressure."]
  },
  {
    slug: "multi-monitor-pen-display-setup", title: "Setting up a pen display alongside a second monitor", excerpt: "A pen display doesn't have to replace your main monitor — here's how most studios actually wire the two together.", image: "/assets/categories/pendisplays.jpg", categoryId: "pen-displays", category: "Pen Displays", author: "RNS Editorial", date: "2026-05-10", publicationDate: new Date("2026-05-10T00:00:00.000Z"), readTime: "4 min read", status: "published", content: ["Most setups keep the regular monitor for reference material and use the pen display purely as the canvas.", "On Windows and macOS, the pen display shows up as a second display in your display settings.", "Make sure the pen display is mapped to itself in your tablet driver so the pen tip lines up with the cursor exactly where you touch."]
  },
  {
    slug: "buying-for-a-studio-bulk-guide", title: "A studio's guide to buying pen tablets in bulk", excerpt: "Outfitting a whole team is a different exercise than a single purchase — a few things worth deciding before you request a quote.", image: "/assets/categories/accessories.jpg", categoryId: null, category: "Guides", author: "RNS Editorial", date: "2026-04-22", publicationDate: new Date("2026-04-22T00:00:00.000Z"), readTime: "4 min read", status: "published", content: ["Buying one pen tablet is mostly about picking the right model. Buying twelve for a studio adds a few more questions worth settling upfront.", "Standardize on one or two models so driver support, spare parts, and onboarding stay simple.", "Budget for spares and think about delivery timing before you order."]
  },
].map((post) => ({ ...post, coverImage: post.image, publishedAt: post.publicationDate }));

const policies = {
  privacy: {
    updated: "August 2026",
    intro: "This policy explains what information RNS INFOTECH collects when you use this site, how it's used, and the choices you have.",
    sections: [
      { title: "Information we collect", body: "Contact details you submit through forms, order and shipping information, and basic usage data such as pages visited and device/browser type." },
      { title: "How we use it", body: "To respond to enquiries and quote requests, process and ship orders, manage warranty claims, and improve the site. We do not sell personal information to third parties." },
      { title: "Sharing", body: "Information is shared only where needed to fulfil an order or where required by law." },
      { title: "Cookies", body: "The site may use cookies to keep you signed in and remember items in your cart." },
      { title: "Your choices", body: "You can request a copy of the information we hold about you, ask us to correct it, or ask us to delete it by emailing support@rnsinfotech.in." },
      { title: "Contact", body: "Questions about this policy can be sent to support@rnsinfotech.in." },
    ],
  },
  returns: {
    updated: "August 2026",
    intro: "RNS INFOTECH does not offer returns, exchanges, or refunds for change of mind. If something's wrong with your product, contact us directly and we'll sort it out with you.",
    sections: [
      { title: "No change-of-mind returns", body: "Once an order is placed, it can't be returned or exchanged simply because you changed your mind. Please check specifications and compatibility carefully before ordering." },
      { title: "Something wrong with your product?", body: "Damaged in transit, not working as expected, or arrived incorrect — email support@rnsinfotech.in with your order ID and a description of the issue (photos or a short video help). We'll respond directly and work out the right fix with you." },
      { title: "How we resolve issues", body: "Depending on the issue, we'll arrange a repair, a replacement part, or another fix suited to the situation — worked out with you directly rather than through a fixed return process." },
      { title: "Manufacturer warranty", body: "Every product carries the manufacturer's standard warranty, and we handle the claim on your behalf. See the Warranty policy for coverage details." },
      { title: "Refunds", body: "We don't run a standard refund process for delivered orders. Where a refund is the right resolution for a specific issue, our support team will handle it with you case by case." },
      { title: "Get in touch", body: "For anything related to an order or a product issue, email support@rnsinfotech.in with your order ID — that's the fastest way to reach us." },
    ],
  },
  terms: {
    updated: "August 2026",
    intro: "These terms govern your use of the RNS INFOTECH website and any orders placed through it.",
    sections: [
      { title: "Orders and pricing", body: "Prices are shown in INR and may change without notice. An order is confirmed only once payment is received or RNS INFOTECH confirms an offline arrangement in writing." },
      { title: "Payments", body: "Online payments are processed through a third-party payment gateway. RNS INFOTECH does not store your card details." },
      { title: "Shipping", body: "Dispatch times shown on product pages are estimates. Risk in the goods passes to the courier on dispatch and to you on delivery." },
      { title: "Warranty", body: "Products carry the manufacturer's standard warranty (typically 1–2 years depending on model). RNS INFOTECH handles the claim on your behalf." },
      { title: "Returns", body: "RNS INFOTECH does not offer returns, exchanges, or refunds for change of mind. If there's an issue with your product, contact support directly — see the Returns policy for how we handle that." },
      { title: "Limitation of liability", body: "RNS INFOTECH's liability for any claim relating to an order is limited to the amount paid for that order." },
      { title: "Governing law", body: "These terms are governed by the laws of India, and disputes are subject to the courts of Bengaluru, Karnataka." },
    ],
  },
  warranty: {
    updated: "August 2026",
    intro: "RNS INFOTECH is an authorized dealer, so every unit we sell carries the manufacturer's standard warranty — and we handle the claim directly rather than redirecting you to the brand.",
    coverage: [
      { categoryId: "pen-displays", categoryLabel: "Pen Displays", duration: "2 years", note: "Covers the panel, digitizer, and included stand." },
      { categoryId: "pen-tablets", categoryLabel: "Pen Tablets", duration: "1 year", note: "Covers the tablet body and digitizer." },
      { categoryId: "stylus", categoryLabel: "Stylus & Pens", duration: "1 year", note: "Covers the pen electronics; included nibs are wear parts." },
      { categoryId: "accessories", categoryLabel: "Accessories", duration: "Not applicable", note: "Consumables are not covered once opened." },
    ],
    sections: [
      { title: "What's covered", body: "Manufacturing defects and hardware failures under normal use, including qualifying panel, digitizer, pressure-sensitivity, and connectivity faults." },
      { title: "What's not covered", body: "Accidental damage, unauthorized repairs or modifications, cosmetic wear, and consumable parts like stylus nibs once opened." },
      { title: "How to file a claim", body: "Email support with your order ID, product serial number, and a description of the issue. We'll confirm coverage and next steps within one business day." },
      { title: "Turnaround", body: "Most claims are resolved by mail-in repair or replacement. Repairs typically take 7–10 business days; straightforward replacements usually ship within 2–3 business days of approval." },
      { title: "Registering your product", body: "Registration isn't required to claim warranty — your order ID is proof of purchase and coverage start date." },
    ],
  },
};

async function main() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);

  if (await Faq.countDocuments() === 0) await Faq.insertMany(faqs);
  if (await BlogPost.countDocuments() === 0) await BlogPost.insertMany(blogPosts);
  for (const [key, content] of Object.entries(policies)) {
    await Policy.updateOne(
      { key },
      { $setOnInsert: { key, status: "published", publishedAt: new Date(), draft: content, published: content, ...content } },
      { upsert: true }
    );
  }

  console.log("CMS content seed completed.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
