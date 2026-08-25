import React, { useEffect, useState } from "react";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import FeaturedCategories from "./components/FeaturedCategories";
import ProductGrid from "./components/ProductGrid";
import WhyChooseUs from "./components/WhyChooseUs";
import Solutions from "./components/Solutions";
import PromoBanner from "./components/PromoBanner";
import Testimonials from "./components/Testimonials";
import FAQs from "./components/FAQs";
import CTASection from "./components/CTASection";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import PageLoader from "./components/PageLoader";
import Reveal from "./components/ui/Reveal";
import { Trace } from "./components/SectionHeader";
import { apiRequest, getHomepageProducts } from "./lib/api";
import { getFaqContent } from "./lib/contentApi";

import { nav, footer } from "./data/siteData";

// How long the branded loader stays up at minimum, so it reads as an
// intentional splash instead of a flash — even on a fast connection or
// warm cache. The loader still waits past this if the backend is slower.
const MIN_LOADER_MS = 1100;

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "RNS INFOTECH",
  url: typeof window !== "undefined" ? window.location.origin : undefined,
  logo: "https://www.rnsinfotech.co.in/assets/favicon/web-app-manifest-512x512.png",
  description:
    "Authorized dealer of pen tablets, pen displays, and stylus hardware for artists, designers, and creators.",
  sameAs: [],
};

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  // Four independent, pre-filtered rails from GET /homepage-products —
  // replaces the old single `products` array that got the same 8
  // products reused (and re-filtered by a since-removed single `tag`
  // field) across all three sections. See HOMEPAGE_CURATION_PROGRESS.md
  // for the root-cause writeup.
  const [homepageProducts, setHomepageProducts] = useState({ featured: [], bestSellers: [], newArrivals: [], discounted: [] });
  const [website, setWebsite] = useState({ hero: null, promo: null, whyChooseUs: [], solutions: [], testimonials: [] });
  const [faqs, setFaqs] = useState([]);
  // Loader hides once BOTH the homepage data has arrived AND the minimum
  // splash time has elapsed — whichever finishes last. Data resolves via
  // Promise.allSettled below so one slow/failed section (e.g. the FAQ
  // fetch) can never leave the loader stuck forever.
  const [dataReady, setDataReady] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_LOADER_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      const [catalogResult, websiteResult] = await Promise.allSettled([
        Promise.all([apiRequest("/categories"), getHomepageProducts()]),
        Promise.all([apiRequest("/website"), getFaqContent()]),
      ]);

      if (ignore) return;

      if (catalogResult.status === "fulfilled") {
        const [categoriesRes, homepageProductsRes] = catalogResult.value;
        const nextCategories = (categoriesRes?.items || []).map((category) => ({
          id: category.slug || category._id,
          name: category.name,
          image: category.image?.url || category.image || "/assets/categories/pentablets.jpg",
          icon: category.icon || "layers",
        }));
        setCategories(nextCategories);
        setHomepageProducts(homepageProductsRes);
      }

      if (websiteResult.status === "fulfilled") {
        const [websiteResponse, faqResponse] = websiteResult.value;
        setWebsite(websiteResponse?.website || { hero: null, promo: null, whyChooseUs: [], solutions: [], testimonials: [] });
        setFaqs(faqResponse || []);
      }

      if (!ignore) setDataReady(true);
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <>
      <PageLoader visible={!(dataReady && minTimeElapsed)} />
      <SEO
        title="Pen Tablets, Pen Displays & Stylus Hardware"
        description="RNS INFOTECH is an authorized dealer of pen tablets, pen displays, and stylus hardware — genuine products, manufacturer warranty, and fast dispatch for artists, studios, and businesses."
        jsonLd={ORGANIZATION_JSON_LD}
      />
      <AnnouncementBar />
      <Navbar {...nav} />
      {website.hero && <Hero {...website.hero} />}

      <FeaturedCategories categories={categories} />

      <ProductGrid
        id="products"
        eyebrow="Catalogue"
        title="Featured products"
        subtitle="A cross-section of what businesses order most this quarter."
        products={homepageProducts.featured}
        altBg
        action={{ label: "View full catalogue", href: "/products" }}
      />

      <WhyChooseUs items={website.whyChooseUs} />
      <Solutions items={website.solutions} />

      <div className="rns-container" style={{ padding: "0 24px" }}>
        <Trace nodes={4} />
      </div>

      <Reveal as="div">
        {website.promo && <PromoBanner {...website.promo} />}
      </Reveal>

      <ProductGrid
        id="new-arrivals"
        eyebrow="Just in"
        title="New arrivals"
        subtitle="Recently added to the catalogue — first stock windows move fastest."
        products={homepageProducts.newArrivals}
        action={{ label: "View all new arrivals", href: "/products?tag=new" }}
      />

      <ProductGrid
        id="best-sellers"
        eyebrow="Most ordered"
        title="Best sellers"
        subtitle="What creators and studios keep reordering."
        products={homepageProducts.bestSellers}
        altBg
        action={{ label: "View all best sellers", href: "/products?tag=best-seller" }}
      />

      <ProductGrid
        id="deals"
        eyebrow="Limited time"
        title="On sale"
        subtitle="The steepest discounts in the catalogue right now, biggest cut first."
        products={homepageProducts.discounted}
        action={{ label: "View all deals", href: "/products?tag=discounted" }}
      />

      <Testimonials items={website.testimonials} />
      <FAQs items={faqs} />

      <Reveal as="div">
        <CTASection
          eyebrow="Buying for a team?"
          title="Get bulk pricing for studios, offices, and institutions"
          body="Tell us what you need and how many — we'll come back with a line-item quote, typically within one business day."
          primaryCta={{ label: "See corporate sales", href: "/corporate-sales" }}
          secondaryCta={{ label: "Book a demo", href: "/demo" }}
        />
      </Reveal>
      <Footer logo={nav.logo} {...footer} whyChooseUs={website.whyChooseUs} />
    </>
  );
}