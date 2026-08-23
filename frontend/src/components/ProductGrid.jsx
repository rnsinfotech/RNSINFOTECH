import React from "react";
import { SectionHeader } from "./SectionHeader";
import ProductCard from "./ProductCard";
import Reveal from "./ui/Reveal";
import { EmptyState } from "./ui/Stateviews";

/**
 * ProductGrid — one section component reused for Featured Products, New
 * Arrivals, Best Sellers, and related-product rails. On the homepage,
 * each rail is passed its own pre-filtered array straight from
 * GET /homepage-products (no filterTag needed — the array is already
 * the right slice). Pass `filterTag` only when handing this component a
 * single flat product list it needs to slice itself (e.g. elsewhere in
 * the app). "featured"/"best-seller" match the curated boolean flags;
 * anything else matches against the product's freeform `tags[]`. Renders
 * an EmptyState instead of a blank grid if nothing matches, so a bad
 * filter fails visibly instead of silently.
 */
export default function ProductGrid({
  id,
  eyebrow,
  title,
  subtitle,
  products = [],
  filterTag,
  limit,
  altBg = false,
  action,
}) {
  let list = Array.isArray(products) ? [...products] : [];
  if (filterTag) {
    list = list.filter((p) => {
      if (filterTag === "featured") return Boolean(p.isFeatured);
      if (filterTag === "best-seller") return Boolean(p.isBestSeller);
      return Array.isArray(p.tags) && p.tags.includes(filterTag);
    });
  }
  if (limit) list = list.slice(0, limit);

  return (
    <section id={id} className={`rns-section ${altBg ? "rns-section--alt" : ""}`}>
      <div className="rns-container">
        <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} action={action} />
        {list.length === 0 ? (
          <EmptyState
            icon="layers"
            title="Nothing in this collection yet"
            message="Check back soon, or browse the full catalogue in the meantime."
            action={{ label: "Browse catalogue", href: "/products" }}
          />
        ) : (
          <div className="rns-grid rns-grid--4">
            {list.map((p, i) => (
              <Reveal key={p.id} delay={Math.min(i, 3)} style={{ height: "100%" }}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
