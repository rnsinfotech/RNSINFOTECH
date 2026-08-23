import { useEffect, useState } from "react";
import { apiRequest, normalizeProduct } from "./api";
import { getFaqContent } from "./contentApi";

// Pages that aren't otherwise represented in the catalogue data but
// are still reasonable things to land on from a site-wide search.
const STATIC_PAGES = [
  {
    title: "About RNS INFOTECH",
    subtitle: "Our story, mission, and the team behind RNS INFOTECH.",
    href: "/about",
    keywords: "about us company story mission team",
  },
  {
    title: "Book a demo",
    subtitle: "Try a pen display or tablet hands-on, in-store or on a call.",
    href: "/demo",
    keywords: "demo trial book appointment try before you buy",
  },
  {
    title: "Request a quote",
    subtitle: "Bulk pricing for studios, schools, and offices.",
    href: "/request-quote",
    keywords: "quote bulk pricing institution studio school office order",
  },
  {
    title: "Help & support",
    subtitle: "Contact us, browse FAQs, or start a chat with our team.",
    href: "/help",
    keywords: "help support contact chat warranty claim",
  },
  {
    title: "Return & refund policy",
    subtitle: "Return window, eligibility, refunds, and exchanges.",
    href: "/return-policy",
    keywords: "return refund exchange policy replace damaged defective",
  },
];

export const TYPE_LABELS = {
  product: "Products",
  category: "Categories",
  service: "Services",
  faq: "Help & FAQs",
  page: "Pages",
};

// Static (non-catalogue, non-API) part of the index — just internal
// page links with no live data source.
function buildStaticIndex() {
  return STATIC_PAGES.map((pg, i) => ({
    type: "page",
    id: `page-${i}`,
    title: pg.title,
    subtitle: pg.subtitle,
    href: pg.href,
    keywords: pg.keywords,
  }));
}

function solutionToItem(s, i) {
  return {
    type: "service",
    id: `solution-${i}`,
    title: s.title,
    subtitle: s.body,
    href: "/#solutions",
    keywords: `${s.title} ${s.body}`.toLowerCase(),
  };
}

function faqToItem(f, i) {
  return {
    type: "faq",
    id: `faq-${i}`,
    title: f.q,
    subtitle: f.a,
    href: "/help#faqs",
    keywords: `${f.q} ${f.a}`.toLowerCase(),
  };
}

function productToItem(raw) {
  const p = normalizeProduct(raw);
  return {
    type: "product",
    id: p.id,
    title: p.name,
    subtitle: `${p.category} · ₹${p.price.toLocaleString("en-IN")}`,
    image: p.image,
    href: `/products/${p.slug}`,
    keywords: [p.name, p.category, p.sku, p.shortDescription].filter(Boolean).join(" ").toLowerCase(),
  };
}

function categoryToItem(c) {
  const id = c.slug || c._id || c.id;
  return {
    type: "category",
    id,
    title: c.name,
    subtitle: `Browse the ${c.name} category`,
    image: c.image?.url || c.image || "",
    href: `/products?category=${id}`,
    keywords: (c.name || "").toLowerCase(),
  };
}

// Catalogue (products + categories) plus solutions + FAQs all come from
// live APIs. Fetched once, cached at module scope, and shared by every
// caller (the navbar search-as-you-type dropdown and the full results
// page) so we don't refetch on every keystroke.
let catalogItems = null;
let catalogPromise = null;

function loadCatalogIndex() {
  if (catalogPromise) return catalogPromise;
  catalogPromise = Promise.all([
    apiRequest("/categories").catch(() => ({ items: [] })),
    apiRequest("/products?page=1&limit=200").catch(() => ({ items: [] })),
    apiRequest("/website").catch(() => ({ website: { solutions: [] } })),
    getFaqContent().catch(() => []),
  ])
    .then(([categoriesRes, productsRes, websiteRes, faqsRes]) => {
      catalogItems = [
        ...(productsRes?.items || []).map(productToItem),
        ...(categoriesRes?.items || []).map(categoryToItem),
        ...(websiteRes?.website?.solutions || []).map(solutionToItem),
        ...(faqsRes || []).map(faqToItem),
      ];
      return catalogItems;
    })
    .catch(() => {
      catalogItems = catalogItems || [];
      return catalogItems;
    });
  return catalogPromise;
}

// Kick the fetch off immediately (module load), so the catalogue is
// often already warm by the time someone focuses the search box.
loadCatalogIndex();

/**
 * useSearchIndex — live product/category catalogue + static site
 * content, combined into one searchable index. Triggers a re-render
 * once the catalogue finishes loading (or fails, in which case the
 * index just falls back to static content only).
 */
export function useSearchIndex() {
  const [, setReady] = useState(Boolean(catalogItems));

  useEffect(() => {
    if (catalogItems) return;
    let ignore = false;
    loadCatalogIndex().then(() => {
      if (!ignore) setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, []);

  return [...(catalogItems || []), ...buildStaticIndex()];
}

/**
 * searchSite — plain-text search across a supplied index (see
 * useSearchIndex). Every query word must appear somewhere in the
 * item; results are ranked with title matches weighted above
 * description matches.
 */
export function searchSite(query, index, { limit } = {}) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);

  const results = (index || [])
    .map((item) => {
      const titleLower = item.title.toLowerCase();
      const haystack = `${titleLower} ${item.subtitle || ""} ${item.keywords || ""}`.toLowerCase();
      const matchesAll = terms.every((t) => haystack.includes(t));
      if (!matchesAll) return null;

      let score = 0;
      if (titleLower === q) score += 20;
      else if (titleLower.startsWith(q)) score += 12;
      else if (titleLower.includes(q)) score += 8;
      terms.forEach((t) => {
        if (titleLower.includes(t)) score += 3;
      });

      return { ...item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return typeof limit === "number" ? results.slice(0, limit) : results;
}
