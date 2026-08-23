import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import ProductGrid from "../components/ProductGrid";
import { CompareProvider } from "../context/CompareContext";
import { ToastProvider } from "../context/ToastContext";
import { normalizeProduct } from "../lib/api";

// Regression coverage for the bug this whole 6-phase build fixed: the
// storefront homepage's Featured / New Arrivals / Best Sellers rails
// all showed the same 8 products, because (a) every rail was built by
// re-filtering ONE fetched array by a single `tag` string, and (b)
// normalizeProduct() kept only tags[0], so a product could never match
// more than one rail even in principle. See HOMEPAGE_CURATION_PROGRESS.md
// for the full root-cause writeup.

function renderGrid(props) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <CompareProvider>
          <ProductGrid id="test-grid" title="Test" products={props.products} filterTag={props.filterTag} />
        </CompareProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

function makeProduct(overrides) {
  return normalizeProduct({
    _id: overrides.id,
    name: overrides.name,
    price: 100,
    mrp: 100,
    stock: 5,
    tags: overrides.tags || [],
    isFeatured: overrides.isFeatured || false,
    isBestSeller: overrides.isBestSeller || false,
  });
}

describe("normalizeProduct — homepage curation fields", () => {
  it("keeps the full tags[] array instead of collapsing to a single tag", () => {
    const product = makeProduct({ id: "p1", name: "Widget", tags: ["bundle", "limited"] });
    expect(product.tags).toEqual(["bundle", "limited"]);
  });

  it("carries isFeatured and isBestSeller as independent booleans", () => {
    const product = makeProduct({ id: "p1", name: "Widget", isFeatured: true, isBestSeller: true });
    // The old model funneled curation through one `tag` string, so a
    // product could be "featured" OR "best-seller" OR "new" — never
    // more than one. These must be free to both be true at once.
    expect(product.isFeatured).toBe(true);
    expect(product.isBestSeller).toBe(true);
  });
});

describe("ProductGrid — a product can appear in more than one rail", () => {
  const featuredOnly = makeProduct({ id: "featured-only", name: "Featured Only Pen", isFeatured: true });
  const bestSellerOnly = makeProduct({ id: "best-seller-only", name: "Best Seller Only Pen", isBestSeller: true });
  const both = makeProduct({ id: "both", name: "Featured And Best Seller Pen", isFeatured: true, isBestSeller: true });
  const neither = makeProduct({ id: "neither", name: "Plain Pen" });

  const allProducts = [featuredOnly, bestSellerOnly, both, neither];

  it('filterTag="featured" shows every isFeatured product, including one that is ALSO a best seller', () => {
    renderGrid({ products: allProducts, filterTag: "featured" });
    expect(screen.getByText("Featured Only Pen")).toBeInTheDocument();
    expect(screen.getByText("Featured And Best Seller Pen")).toBeInTheDocument();
    expect(screen.queryByText("Best Seller Only Pen")).not.toBeInTheDocument();
    expect(screen.queryByText("Plain Pen")).not.toBeInTheDocument();
  });

  it('filterTag="best-seller" shows every isBestSeller product, including one that is ALSO featured — this is the exact case the old single-tag model could never render', () => {
    renderGrid({ products: allProducts, filterTag: "best-seller" });
    expect(screen.getByText("Best Seller Only Pen")).toBeInTheDocument();
    expect(screen.getByText("Featured And Best Seller Pen")).toBeInTheDocument();
    expect(screen.queryByText("Featured Only Pen")).not.toBeInTheDocument();
    expect(screen.queryByText("Plain Pen")).not.toBeInTheDocument();
  });

  it("passing each rail's own pre-filtered array (the HomePage.jsx approach) with no filterTag renders exactly that array", () => {
    // This is how HomePage.jsx actually calls ProductGrid post-Phase-5:
    // each rail already comes pre-filtered from GET /homepage-products,
    // so no client-side filterTag is passed at all.
    renderGrid({ products: [bestSellerOnly, both] });
    expect(screen.getByText("Best Seller Only Pen")).toBeInTheDocument();
    expect(screen.getByText("Featured And Best Seller Pen")).toBeInTheDocument();
    expect(screen.queryByText("Featured Only Pen")).not.toBeInTheDocument();
    expect(screen.queryByText("Plain Pen")).not.toBeInTheDocument();
  });

  it("different rails given different arrays never show identical product sets (the reported bug)", () => {
    const featuredRail = allProducts.filter((p) => p.isFeatured);
    const bestSellerRail = allProducts.filter((p) => p.isBestSeller);
    const featuredIds = featuredRail.map((p) => p.id).sort();
    const bestSellerIds = bestSellerRail.map((p) => p.id).sort();
    expect(featuredIds).not.toEqual(bestSellerIds);
  });
});
